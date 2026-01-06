
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        // 1. Check if requester is Admin
        const supabase = await createClient();

        // DEBUG: Header Check
        const authHeader = request.headers.get('Authorization');
        console.log('[DEBUG-API] ResetPassword Auth Header:', authHeader ? 'Header present' : 'Header missing');

        let user;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
            if (!error && authUser) {
                user = authUser;
            }
        }

        if (!user) {
            // Fallback to cookie session if header fails (though header is preferred for admin actions)
            const { data: { session } } = await supabase.auth.getSession();
            user = session?.user;
        }

        console.log('[DEBUG-API] ResetPassword User ID:', user?.id || 'No User');

        if (!user) {
            return NextResponse.json({
                error: 'Unauthorized: Invalid token or session',
                debug: {
                    details: 'User verification failed',
                    authHeaderPresent: !!authHeader,
                    authHeaderLength: authHeader?.length || 0,
                    tokenPreview: authHeader ? authHeader.substring(0, 15) + '...' : 'N/A',
                }
            }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
        }

        // 2. Perform Password Reset using Admin Client
        const body = await request.json();
        const { userId, newPassword } = body;

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'Missing userId or newPassword' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Password reset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
