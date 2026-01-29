// @ts-nocheck
import { NextResponse } from 'next/server';
import { viewDocumentEmbedding } from '@/lib/ucansign/client';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function resolveUserId(legacyId: string) {
    if (!legacyId) return null;
    if (legacyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return legacyId;

    const supabaseAdmin = getSupabaseAdmin();
    const email = `${legacyId}@example.com`;
    const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
    if (u) return u.id;

    if (legacyId === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

export async function POST(
    request: Request,
    context: any
) {
    try {
        await context.params; // Await params to satisfy Next.js 15+ requirement if strictly checked at runtime
        const body = await request.json();
        const { userId: rawUserId, documentId, ...data } = body;

        if (!rawUserId || !documentId || !data.redirectUrl) {
            return NextResponse.json({ error: 'User ID, Document ID, and Redirect URL are required' }, { status: 400 });
        }

        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
        }

        console.log('[API] View Embedding Params:', { userId, documentId, ...data });
        const result = await viewDocumentEmbedding(userId, documentId, data);
        console.log('[API] View Embedding Response:', JSON.stringify(result, null, 2));

        if (result && (result.result || result.url)) {
            return NextResponse.json(result.result || result);
        } else {
            return NextResponse.json({ error: 'Failed to create embedding link', details: result }, { status: 500 });
        }
    } catch (error: any) {
        console.error('View Embedding Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create embedding' }, { status: 500 });
    }
}
