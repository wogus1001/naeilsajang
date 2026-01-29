import { NextResponse } from 'next/server';
import { getContracts, uCanSignClient } from '@/lib/ucansign/client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client removed from top-level

async function resolveUserId(legacyId: string) {
    if (!legacyId) return null;
    const supabaseAdmin = getSupabaseAdmin();
    const email = `${legacyId}@example.com`;
    const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
    if (u) return u.id;
    // fallback for admin if email is different?
    if (legacyId === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

// Transform DB -> Frontend
function transformContract(row: any) {
    if (!row) return null;
    const { data, ...core } = row;
    return {
        ...data,
        ...core,
        // Ensure critical fields
        id: core.id,
        status: core.status,
        name: core.name,
        propertyId: core.property_id,
        createdAt: core.created_at
    };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId'); // Legacy 'admin'
        const supabaseAdmin = getSupabaseAdmin();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const status = searchParams.get('status');
        const userUuid = await resolveUserId(userId);

        // 1. Fetch from External API (Source of Truth for Status)
        // Fix: Use resolved UUID for database lookups in getContracts -> getUserToken
        console.log(`[API] Fetching contracts from uCanSign for ${userId} (UUID: ${userUuid})`);
        let apiContracts: any[] = [];
        try {
            if (userUuid) {
                apiContracts = await getContracts(userUuid, status || undefined) || [];
            }
        } catch (e: any) {
            console.error('External API List Error:', e.message);
            // If error is related to Auth, re-throw to trigger NEED_AUTH response
            const msg = e.message || '';
            if (
                msg.includes('Unauthorized') ||
                msg.includes('reconnect') ||
                msg.includes('Token') ||
                msg.includes('connected') // "User is not connected to UCanSign"
            ) {
                throw e;
            }
            // Proceed with DB only if External fails for other reasons (network, etc)
        }

        // 2. Fetch from DB
        let dbContracts: any[] = [];
        if (userUuid) {
            const { data, error } = await supabaseAdmin
                .from('contracts')
                .select('*')
                .eq('user_id', userUuid);

            if (!error && data) {
                dbContracts = data.map(transformContract);
            }
        }

        // 3. Sync & Refresh DB Statuses
        // Iterate DB contracts. If `ucansignId` exists, fetch fresh detail from External.
        // If status changed, update DB.
        const refreshedDbContracts = await Promise.all(dbContracts.map(async (c) => {
            if (c.ucansignId && userUuid) {
                try {
                    const detail = await uCanSignClient(userUuid, `/documents/${c.ucansignId}`);
                    if (detail?.result) {
                        const freshStatus = detail.result.status;
                        const freshName = detail.result.name;

                        // Check for update
                        if (c.status !== freshStatus || c.name !== freshName) {
                            console.log(`Syncing Contract ${c.id}: ${c.status} -> ${freshStatus}`);
                            await supabaseAdmin
                                .from('contracts')
                                .update({
                                    status: freshStatus,
                                    name: freshName,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', c.id);

                            return { ...c, status: freshStatus, name: freshName, documentName: freshName };
                        }
                        return { ...c, documentName: freshName };
                    }
                } catch (e) {
                    console.error(`Failed to refresh contract ${c.id}`, e);
                }
            }
            return c;
        }));

        // 4. Merge
        const map = new Map();
        // Add External first
        apiContracts.forEach(c => map.set(c.id, c));
        // Overwrite with DB (contains propertyId and synced status)
        refreshedDbContracts.forEach(c => map.set(c.id, { ...map.get(c.id), ...c }));

        const mergedContracts = Array.from(map.values());

        // Sort
        mergedContracts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ contracts: mergedContracts });

    } catch (error: any) {
        console.error('Contracts API Error:', error);
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('unauthorized') || errMsg.includes('reconnect') || errMsg.includes('token') || errMsg.includes('connected')) {
            return NextResponse.json({ code: 'NEED_AUTH', error: 'Authentication required' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
    }
}
