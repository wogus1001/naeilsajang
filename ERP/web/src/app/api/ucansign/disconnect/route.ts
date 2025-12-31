
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client
// Service Role Client
// Removed top level

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

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const userId = await resolveId(userIdParam);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Remove UCanSign data
        // Remove UCanSign data
        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin.from('profiles').update({
            ucansign_access_token: null,
            ucansign_refresh_token: null,
            ucansign_expires_at: null
        }).eq('id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Disconnect API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
