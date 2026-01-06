import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client (Bypasses RLS for migration/support)
// because the API Request doesn't carry the Supabase Session yet (hybrid mode)
// Service Role Client (Bypasses RLS for migration/support)
// because the API Request doesn't carry the Supabase Session yet (hybrid mode)
// Removed top level

// GET: Fetch user's memo
export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    try {
        const email = `${userId}@example.com`;
        const { data: user } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();

        if (!user) return NextResponse.json({ content: '' });

        const { data: memo } = await supabaseAdmin
            .from('memos')
            .select('content')
            .eq('user_id', user.id)
            .single();

        return NextResponse.json({ content: memo ? memo.content : '' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch memo' }, { status: 500 });
    }
}

// POST: Save user's memo
export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { userId, content } = await request.json();

        const email = `${userId}@sajang.app`;
        // Use admin client to lookup profile
        const { data: user } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Upsert Memo
        // Check existence
        const { data: existing } = await supabaseAdmin.from('memos').select('id').eq('user_id', user.id).single();

        if (existing) {
            const { error } = await supabaseAdmin.from('memos').update({ content, updated_at: new Date() }).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin.from('memos').insert({ user_id: user.id, content });
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Memo save error:', error);
        return NextResponse.json({ error: 'Failed to save memo' }, { status: 500 });
    }
}
