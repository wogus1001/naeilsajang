import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { currentId, newId, name, companyName, oldPassword, newPassword } = body;

        if (!currentId) {
            return NextResponse.json({ error: 'Current ID is required' }, { status: 400 });
        }

        const supabaseAdmin = await getSupabaseAdmin();
        const email = currentId.includes('@') ? currentId : `${currentId}@example.com`;

        // 1. Get User by Email (to find UID)
        // Robust Resolution of currentId (which could be UUID, short ID, or email)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentId);

        let profile = null;

        if (isUuid) {
            const { data } = await supabaseAdmin.from('profiles').select('id, email, password_hash').eq('id', currentId).single();
            profile = data;
        } else {
            // Try assuming it's a short ID -> email
            const emailAttempt1 = currentId.includes('@') ? currentId : `${currentId}@example.com`;
            const { data: p1 } = await supabaseAdmin.from('profiles').select('id, email, password_hash').eq('email', emailAttempt1).single();
            if (p1) profile = p1;
            else if (currentId.includes('@')) {
                // Try exact match in case regex failed or format oddity
                const { data: p2 } = await supabaseAdmin.from('profiles').select('id, email, password_hash').eq('email', currentId).single();
                profile = p2;
            }
        }

        if (!profile) {
            console.error(`User extraction failed for id: ${currentId}`);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userId = profile.id;
        const email = profile.email;

        // 2. Handle ID (Email) Change
        if (newId && newId !== currentId) {
            const newEmail = newId.includes('@') ? newId : `${newId}@example.com`;

            // Check duplicate
            const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers();
            if (existingUsers.some(u => u.email === newEmail)) {
                return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
            }

            const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail });
            if (updateEmailError) throw updateEmailError;

            // Profile email should update automatically or manually?
            // Helper function `handle_new_user` handles insert. Updates might need manual sync or triggers.
            // We should update profile email manually to be safe.
            await supabaseAdmin.from('profiles').update({ email: newEmail }).eq('id', userId);
        }

        // 3. Handle Password Change
        if (newPassword) {
            if (!oldPassword) {
                return NextResponse.json({ error: '기존 비밀번호를 입력해주세요.' }, { status: 401 });
            }

            // Verify old password (expensive but necessary?)
            // We can't verify old password easily as admin without signing in.
            // So we try sign in.
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            const supabase = createClient(supabaseUrl, supabaseAnonKey);

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email, // use current email
                password: oldPassword
            });

            if (signInError) {
                return NextResponse.json({ error: '기존 비밀번호가 일치하지 않습니다.' }, { status: 401 });
            }

            // Update password
            const { error: updatePwdError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
            if (updatePwdError) throw updatePwdError;
        }

        // 4. Update Profile Info
        const updates: any = {};
        if (name) updates.name = name;
        // Company name update? Usually not allowed directly, implies company change?
        // Let's ignore company name change for now or handle company logic if needed. 
        // Legacy code: if (companyName) user.companyName = companyName;
        // In DB, company is linked by ID. Changing name of COMPANY? Or changing User's Company?
        // Assuming just User's Name update for now. Changing company is complex (safety).

        if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
        }

        // Return updated object
        const { data: finalProfile } = await supabaseAdmin
            .from('profiles')
            .select(`*, company:companies(name)`)
            .eq('id', userId)
            .single();

        return NextResponse.json({
            user: {
                id: newId || currentId, // Keep display ID
                name: finalProfile.name,
                email: finalProfile.email,
                role: finalProfile.role,
                status: finalProfile.status,
                companyName: finalProfile.company?.name || '',
                companyId: finalProfile.company_id
            }
        });

    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
