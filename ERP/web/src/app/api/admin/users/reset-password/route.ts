
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

        const { data: { session } } = await supabase.auth.getSession();
        console.log('[DEBUG-API] ResetPassword Session User:', session?.user?.id || 'No Session');

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized: No valid session found' }, { status: 401 });
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
