import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password } = body;

        if (!id || !password) {
            return NextResponse.json({ error: 'ID and password are required' }, { status: 400 });
        }

        // Use a standard client for login validation (signInWithPassword)
        // We need the anon key for this.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const email = id.includes('@') ? id : `${id}@example.com`;

        // 1. Verify Credentials
        const { data: { user: authUser }, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError || !authUser) {
            return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }

        // 2. Fetch Profile Info (Role, Company, Status)
        // We use admin client here to bypass RLS if needed, or just ensuring we get the data reliably.
        const supabaseAdmin = await getSupabaseAdmin();
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select(`
                *,
                company:companies(name)
            `)
            .eq('id', authUser.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        // 3. Check Status
        if (profile.status === 'pending_approval') {
            return NextResponse.json({ error: '팀장의 승인 대기 중입니다. 승인 후 로그인이 가능합니다.' }, { status: 403 });
        }
        if (profile.status !== 'active') {
            return NextResponse.json({ error: '로그인이 제한된 계정입니다.' }, { status: 403 });
        }

        // 4. Return User Info (Match legacy format)
        const userInfo = {
            id: id, // Return the input ID (or email if desirable, but legacy used username sometimes)
            name: profile.name,
            role: profile.role,
            companyName: profile.company?.name || 'Unknown',
            status: profile.status,
            email: authUser.email,
            uid: authUser.id // Helpful for frontend to have the UUID
        };

        // Note: We are NOT returning the session/token here because the app seems to use its own session management 
        // or just stores user info in localStorage. If it needs the token, we should return `session` from signInWithPassword.
        // For minimal breakage, we return `user` object.

        return NextResponse.json({ user: userInfo });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
