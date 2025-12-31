import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password, name, companyName, role: requestedRole } = body; // id here is treated as email/loginId

        if (!id || !password || !name || !companyName) {
            return NextResponse.json({ error: 'ID, password, name, and company name are required' }, { status: 400 });
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // 1. Check if email already exists
        const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();

        const email = id.includes('@') ? id : `${id}@example.com`; // Fallback if id is not email

        // 2. Company Logic
        let companyId: string | null = null;
        let finalRole = requestedRole || 'staff';
        let finalStatus = 'active';
        let message = '회원가입이 완료되었습니다.';

        // Check if company exists
        const { data: existingCompany } = await supabaseAdmin
            .from('companies')
            .select('id, manager_id')
            .eq('name', companyName)
            .single();

        if (!existingCompany) {
            // New Company -> Create it
            const { data: newCompany, error: createCompanyError } = await supabaseAdmin
                .from('companies')
                .insert({ name: companyName, status: 'active' })
                .select()
                .single();

            if (createCompanyError || !newCompany) {
                console.error('Company creation failed:', createCompanyError);
                return NextResponse.json({ error: 'Company creation failed' }, { status: 500 });
            }
            companyId = newCompany.id;

            // First user is always manager
            finalRole = 'manager';
            finalStatus = 'active';
            if (requestedRole === 'staff') {
                message = '처음 등록되는 회사의 경우 가입자가 팀장이 됩니다.';
            }

        } else {
            // Existing Company
            companyId = existingCompany.id;

            if (finalRole === 'manager') {
                if (existingCompany.manager_id) {
                    return NextResponse.json({ error: '이미 팀장이 존재하는 회사입니다. 직원으로 가입해주세요.' }, { status: 400 });
                }
                // No manager -> Allow becoming manager
                finalStatus = 'active';
            } else {
                // Staff joining
                finalRole = 'staff';
                if (existingCompany.manager_id) {
                    finalStatus = 'pending_approval';
                    message = '가입 요청이 완료되었습니다. 팀장의 승인 후 로그인이 가능합니다.';
                } else {
                    finalStatus = 'pending_approval';
                    message = '가입 요청이 완료되었습니다. 팀장의 승인 후 로그인이 가능합니다.';
                }
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
            if (authError.message.includes('unique constraint') || authError.message.includes('already registered')) {
                return NextResponse.json({ error: '이미 존재하는 ID(이메일)입니다.' }, { status: 409 });
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

        // 5. If Manager, update Company manager_id
        if (finalRole === 'manager' && companyId) {
            await supabaseAdmin
                .from('companies')
                .update({ manager_id: userId })
                .eq('id', companyId);
        }

        return NextResponse.json({ success: true, user: { id: userId, name, role: finalRole, status: finalStatus }, message });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
