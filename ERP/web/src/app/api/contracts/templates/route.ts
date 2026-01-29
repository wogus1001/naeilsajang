import { NextResponse } from 'next/server';
import { getTemplates } from '@/lib/ucansign/client';

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const userId = await resolveUserId(userIdParam);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected', code: 'NEED_AUTH' }, { status: 401 });
        }

        const templates = await getTemplates(userId);
        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Template API Error:', error);
        if (error.message.includes('User is not connected')) {
            return NextResponse.json({ error: '유캔싸인 연동이 필요합니다.', code: 'NEED_AUTH' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}
