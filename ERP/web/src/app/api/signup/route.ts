import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password, name, companyName, role: requestedRole } = body; // id here is treated as email/loginId

        if (!id || !password || !name || !companyName) {
            return NextResponse.json({ error: '필수 정보를 모두 입력해주세요.' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
        }

        const trimmedCompanyName = companyName.trim().normalize('NFC');
        const email = id.includes('@') ? id : `${id}@example.com`;
        const supabaseAdmin = await getSupabaseAdmin();

        console.log(`[Signup] Attempting to join/create company: "${trimmedCompanyName}"`);

        // 2. Company Logic
        let companyId: string | null = null;
        let finalRole = requestedRole || 'staff';
        let finalStatus = 'active';
        let message = '회원가입이 완료되었습니다.';

        // Check if company exists
        const { data: companyResults, error: findError } = await supabaseAdmin
            .from('companies')
            .select('id, manager_id')
            .eq('name', trimmedCompanyName)
            .order('created_at', { ascending: true });

        if (findError) {
            console.error('[Signup] Find company error:', findError);
        }

        let existingCompany = companyResults && companyResults.length > 0 ? companyResults[0] : null;

        if (!existingCompany) {
            // New Company -> Create it
            const { data: newCompany, error: createCompanyError } = await supabaseAdmin
                .from('companies')
                .insert({ name: trimmedCompanyName, status: 'active' })
                .select()
                .single();

            if (createCompanyError) {
                // RACE CONDITION: If it failed because another request created it simultaneously
                if (createCompanyError.code === '23505') {
                    const { data: retryFetch } = await supabaseAdmin
                        .from('companies')
                        .select('id, manager_id')
                        .eq('name', trimmedCompanyName)
                        .single();

                    if (retryFetch) {
                        existingCompany = retryFetch;
                        companyId = existingCompany.id;
                        // Proceed as existing company
                    } else {
                        return NextResponse.json({ error: `회사를 찾는 데 실패했습니다: ${createCompanyError.message}` }, { status: 500 });
                    }
                } else {
                    console.error('Company creation failed:', createCompanyError);
                    return NextResponse.json({
                        error: `회사 등록 실패: ${createCompanyError.message}`
                    }, { status: 500 });
                }
            } else {
                companyId = newCompany.id;
                finalRole = 'manager';
                finalStatus = 'active';
                if (requestedRole === 'staff') {
                    message = '처음 등록되는 회사의 경우 가입자가 팀장이 됩니다.';
                }
            }
        }

        // If we found an existing company (either first time or after retry)
        if (existingCompany && !companyId) {
            companyId = existingCompany.id;

            // Check how many managers already exist
            const { count: managerCount } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('role', 'manager');

            const currentManagers = managerCount || 0;

            if (requestedRole === 'manager') {
                if (currentManagers >= 2) {
                    return NextResponse.json({ error: '이미 팀장이 2명 존재합니다. 직원으로 가입해주세요.' }, { status: 400 });
                }
                finalRole = 'manager';
                finalStatus = 'active';
            } else {
                finalRole = 'staff';
                finalStatus = 'pending_approval';
                message = '가입 요청이 완료되었습니다. 팀장의 승인 후 로그인이 가능합니다.';
            }
        }

        // 3. Create Auth User
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto confirm since we are using admin
            user_metadata: { name: name }
        });

        if (authError) {
            console.error('Auth create error:', authError);
            const msg = authError.message.toLowerCase();
            if (msg.includes('unique constraint') ||
                msg.includes('already registered') ||
                msg.includes('a user with this email address has already been registered')) {
                return NextResponse.json({ error: '이미 존재하는 ID(이메일)입니다.' }, { status: 409 });
            }
            if (msg.includes('password should be at least')) {
                return NextResponse.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
            }
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        if (!authUser.user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        const userId = authUser.user.id;

        // 4. Update Profile (created by trigger) with correct Role/Company/Status
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                company_id: companyId,
                role: finalRole,
                status: finalStatus,
                name: name
            })
            .eq('id', userId);

        if (profileError) {
            console.error('Profile update error:', profileError);
            // Cleanup auth user?
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        // 5. If Manager, update Company manager_id (Only if currently null)
        if (finalRole === 'manager' && companyId) {
            const { data: comp } = await supabaseAdmin.from('companies').select('manager_id').eq('id', companyId).single();
            if (comp && !comp.manager_id) {
                await supabaseAdmin
                    .from('companies')
                    .update({ manager_id: userId })
                    .eq('id', companyId);
            }
        }

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                name,
                email, // useful for display
                role: finalRole,
                status: finalStatus,
                companyName: companyName, // Ensure frontend has this!
                companyId: companyId
            },
            message
        });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
