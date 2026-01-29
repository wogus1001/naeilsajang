// @ts-nocheck
import { NextResponse } from 'next/server';
import { uCanSignClient } from '@/lib/ucansign/client';

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

export async function GET(
    request: Request,
    context: any
) {
    try {
        const { searchParams } = new URL(request.url);
        const { id } = await context.params;
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        if (!id) {
            return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
        }

        const userId = await resolveUserId(userIdParam);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
        }

        // Call UCanSign API to get document details
        const response = await uCanSignClient(userId, `/documents/${id}`);

        if (response?.code !== 0) {
            // Some error from UCanSign
            return NextResponse.json({
                error: response?.msg || 'Failed to fetch document details',
                details: response
            }, { status: 500 });
        }

        const result = response.result || {};
        if (!result.id && result.documentId) {
            result.id = result.documentId;
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Document Detail API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
