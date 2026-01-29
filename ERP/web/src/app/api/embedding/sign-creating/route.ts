import { NextResponse } from 'next/server';
import { createSignEmbedding } from '@/lib/ucansign/client';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function resolveUserId(legacyId: string) {
    if (!legacyId) return null;
    // Check if UUID
    if (legacyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return legacyId;

    const supabaseAdmin = getSupabaseAdmin();
    // 1. Try Email
    const email = `${legacyId}@example.com`;
    const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
    if (u) return u.id;

    // 2. Try Admin
    if (legacyId === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId: rawUserId, ...data } = body;

        if (!rawUserId || !data.redirectUrl) {
            return NextResponse.json({ error: 'User ID and Redirect URL are required' }, { status: 400 });
        }

        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
        }

        console.log('[API] Sign Embedding Params:', { userId, ...data });
        const result = await createSignEmbedding(userId, data);
        console.log('[API] Sign Embedding Response:', JSON.stringify(result, null, 2));

        // Response format from UCanSign: { msg: "success", result: { url, expiration }, code: 0 }
        // Check for common variations if 'result' is missing
        if (result && (result.result || result.url)) {
            // Sometimes result is direct, sometimes nested.
            return NextResponse.json(result.result || result);
        } else {
            return NextResponse.json({ error: 'Failed to create embedding link', details: result }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Sign Embedding Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create embedding' }, { status: 500 });
    }
}
