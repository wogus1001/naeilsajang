import { NextResponse } from 'next/server';
import { createContractFromTemplate } from '@/lib/ucansign/client';

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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId: rawUserId, templateId, ...data } = body;

        if (!rawUserId || !templateId) {
            return NextResponse.json({ error: 'User ID and Template ID are required' }, { status: 400 });
        }

        const userId = await resolveUserId(rawUserId);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
        }

        const result = await createContractFromTemplate(userId, templateId, data);

        // Response format check
        if (result && result.code === 0) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ error: result?.msg || 'Failed to create contract' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Contract Creation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create contract' }, { status: 500 });
    }
}
