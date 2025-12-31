import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Helper to resolve ID (Simplified duplication)
async function resolveId(id: string) {
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return id;

    const supabaseAdmin = getSupabaseAdmin();
    // Legacy -> Email
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', `${id}@example.com`).single();
    if (data) return data.id;

    if (id === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    if (!userIdParam) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const userId = await resolveId(userIdParam);

        if (!userId) {
            // If user not found in DB, return not connected instead of 404 to prevent UI crash
            return NextResponse.json({ connected: false });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ucansign_access_token')
            .eq('id', userId)
            .single();

        if (profile && profile.ucansign_access_token) {
            return NextResponse.json({ connected: true });
        } else {
            return NextResponse.json({ connected: false });
        }

    } catch (e) {
        console.error('Error checking user status:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
