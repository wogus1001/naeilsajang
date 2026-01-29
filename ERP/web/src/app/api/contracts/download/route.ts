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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    const contractId = searchParams.get('contractId');
    const type = searchParams.get('type') || 'document'; // document, audit-trail, full-file, attachment
    const attachmentId = searchParams.get('attachmentId');

    console.log(`[DownloadAPI] Request: type=${type}, contractId=${contractId}, userId=${userIdParam}`);

    if (!userIdParam || !contractId) {
        return NextResponse.json({ error: 'UserId and ContractId are required' }, { status: 400 });
    }

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
        return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
    }

    try {
        let url = '';
        if (type === 'audit-trail') {
            // GET /documents/:id/audit-trail
            const res = await uCanSignClient(userId, `/documents/${contractId}/audit-trail`);
            console.log(`[DownloadAPI] Audit Trail Response:`, JSON.stringify(res, null, 2));
            url = res?.result?.file;
        } else if (type === 'full-file') {
            // GET /documents/:id/full-file
            const res = await uCanSignClient(userId, `/documents/${contractId}/full-file`);
            console.log(`[DownloadAPI] Full File Response:`, JSON.stringify(res, null, 2));
            url = res?.result?.file;
        } else if (type === 'attachment') {
            if (!attachmentId) throw new Error('Attachment ID required');
            // GET /documents/:id/attachments/:attachmentId
            const res = await uCanSignClient(userId, `/documents/${contractId}/attachments/${attachmentId}`);
            console.log(`[DownloadAPI] Attachment Response:`, JSON.stringify(res, null, 2));
            url = res?.result?.file;
        } else {
            // Default: Document File
            const res = await uCanSignClient(userId, `/documents/${contractId}/file`);
            console.log(`[DownloadAPI] Document File Response:`, JSON.stringify(res, null, 2));
            url = res?.result?.file;
        }

        console.log(`[DownloadAPI] Final URL found: ${url}`);

        if (url) {
            return NextResponse.json({ url });
        } else {
            console.warn('[DownloadAPI] File URL not found in response');
            return NextResponse.json({ error: 'File not found or processing' }, { status: 404 });
        }

    } catch (error: any) {
        console.error('Download API Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to get download link' }, { status: 500 });
    }
}
