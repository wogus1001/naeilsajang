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

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
        }

        const userId = await resolveUserId(userIdParam);
        if (!userId) {
            return NextResponse.json({ error: 'User not found or not connected' }, { status: 404 });
        }

        const body = await request.json();
        const { action, contractId } = body;

        if (!contractId || !action) {
            return NextResponse.json({ error: 'ContractId and Action are required' }, { status: 400 });
        }

        let endpoint = '';
        let method = 'POST';
        let payload: any = { documentId: contractId };

        // Mapping actions to assumed UCanSign Endpoints based on the list
        switch (action) {
            case 'cancel':
                // 11. 서명요청 취소 (POST)
                // Spec: POST /documents/:documentId/request/cancellation
                endpoint = `/documents/${contractId}/request/cancellation`;
                payload = { message: 'User requested cancellation via Dashboard' };
                break;
            case 'remind':
                // 10. 서명 요청 메시지 재전송 (POST)
                // Spec: POST /documents/:documentId/request/reminder
                endpoint = `/documents/${contractId}/request/reminder`;
                payload = {}; // No body shown in CURL, just Auth token header usually? Or empty obj.
                break;
            case 'delete':
                // 12. 문서 리스트 휴지통으로 이동 (PUT /documents/archive)
                // Spec: PUT /documents/archive with body [id, id...]
                endpoint = '/documents/archive';
                method = 'PUT';
                payload = [contractId]; // Array of IDs
                break;
            case 'destroy':
                // 13. 문서 완전히 삭제 (DEL)
                endpoint = `/documents/${contractId}`; // or /documents? check list
                method = 'DELETE';
                break;
            // RESTORE
            case 'restore':
                // Spec: PUT /documents/:documentId/restore
                endpoint = `/documents/${contractId}/restore`;
                method = 'PUT';
                payload = {}; // No body needed
                break;

            // PERMANENT DELETE
            case 'permanent_delete':
                // Spec: DELETE /documents/:documentId/archive
                endpoint = `/documents/${contractId}/archive`;
                method = 'DELETE';
                payload = {};
                break;

            // EXTEND EXPIRY
            case 'extend_expiry':
                // Spec: PUT /documents/:documentId/expiry
                endpoint = `/documents/${contractId}/expiry`;
                // 30 days = 30 * 24 * 60 = 43200 minutes
                payload = {
                    configExpireMinute: 43200,
                    configExpireReminderDay: 1
                };
                method = 'PUT';
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Call UCanSign API
        // Note: Client handles base URL. We just pass endpoint.
        const response = await uCanSignClient(userId, endpoint, {
            method: method,
            body: JSON.stringify(payload)
        });

        if (response?.code === 0 || response?.msg === 'success') {
            return NextResponse.json({ success: true, result: response });
        } else {
            // If it fails, we return the error from upstream
            return NextResponse.json({ success: false, error: response?.msg || 'API Failed' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Action API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
