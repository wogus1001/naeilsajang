import { NextResponse } from 'next/server';
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
        // Since input is ID/Email, we need to resolve to UUID.
        // We can search profiles or auth via admin listUsers (filtered).
        // Let's assume currentId is the email or we can construct it.
        // Actually, efficiently we should query `profiles` by email if possible or just use listUsers.

        // Let's try to query profiles first.
        // Profiles has email column? Yes.
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, password_hash') // password_hash not available? Auth manages password.
            .eq('email', email)
            .single();

        if (findError || !profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userId = profile.id;

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
        // Re-fetch to return clean state
        const { data: updatedProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();

        return NextResponse.json({
            user: {
                id: newId || currentId,
                name: updatedProfile.name,
                // ... other fields
            }
        });

    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
