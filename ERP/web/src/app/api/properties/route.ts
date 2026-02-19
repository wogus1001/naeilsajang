import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import {
    canAccessCompanyResource,
    canAccessCompanyScope,
    getRequesterProfile,
    isAdmin,
    resolveCompanyIdByName,
    resolveUserUuid,
    type RequesterProfile
} from '@/lib/api-auth';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request
const SHARED_TOP_LEVEL_BLOCKLIST = new Set([
    'companyId',
    'company_id',
    'managerId',
    'manager_id',
    'createdBy',
    'updatedBy'
]);
const SHARED_DATA_BLOCKLIST = new Set([
    'memo',
    'internalMemo',
    'privateMemo',
    'landlordContact',
    'landlordPhone',
    'landlordMobile',
    'ownerContact',
    'ownerPhone',
    'ownerMobile',
    'lessorPhone',
    'purchaseCost',
    'originalCost',
    'costPrice',
    '원가',
    '내부메모',
    '임대인연락처',
    '임대인전화',
    '소유주연락처',
    '소유주전화',
    '비공개메모'
]);

async function getSharedPropertyIdByToken(supabaseAdmin: any, shareToken: string) {
    if (!shareToken) return null;
    const { data: shareLink } = await supabaseAdmin
        .from('share_links')
        .select('property_id, expires_at')
        .eq('token', shareToken)
        .single();

    if (!shareLink?.property_id) return null;
    if (shareLink.expires_at) {
        const expiresAt = new Date(shareLink.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) return null;
    }
    return shareLink.property_id as string;
}

function canAccessProperty(
    requester: RequesterProfile | null,
    property: { company_id: string | null; manager_id: string | null }
) {
    return canAccessCompanyResource(requester, property);
}

function requesterFallbackFromBody(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const payload = body as Record<string, unknown>;
    const rawRequester = payload.requesterId || payload.userId || payload.managerId || null;
    if (!rawRequester) return null;
    const normalized = String(rawRequester).trim();
    return normalized.length > 0 ? normalized : null;
}

// Helper: Transform DB Row -> Frontend Object
function transformProperty(row: any) {
    if (!row) return null;
    const { data, ...core } = row;
    return {
        ...data, // Spread JSONB first (defaults)
        ...core, // Overwrite with Core columns (validated)
        // Manual map for snake_case -> camelCase override
        operationType: core.operation_type,
        isFavorite: core.is_favorite,
        companyId: core.company_id,
        managerId: row.manager_id,
        createdAt: core.created_at,
        updatedAt: core.updated_at
    };
}

function sanitizeSharedValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sanitizeSharedValue);
    }

    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};

        Object.entries(source).forEach(([key, entry]) => {
            if (SHARED_DATA_BLOCKLIST.has(key)) return;
            sanitized[key] = sanitizeSharedValue(entry);
        });

        return sanitized;
    }

    return value;
}

function transformSharedProperty(row: any) {
    const transformed = transformProperty(row) as Record<string, unknown> | null;
    if (!transformed) return null;

    const sanitized: Record<string, unknown> = {};
    Object.entries(transformed).forEach(([key, value]) => {
        if (SHARED_TOP_LEVEL_BLOCKLIST.has(key)) return;
        sanitized[key] = key === 'data' ? sanitizeSharedValue(value) : value;
    });

    return sanitized;
}

// GET
export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const company = searchParams.get('company');
    const min = searchParams.get('min') === 'true';
    const shareToken = searchParams.get('shareToken');

    try {
        const requesterProfile = await getRequesterProfile(supabaseAdmin, request);
        const sharedPropertyId = shareToken
            ? await getSharedPropertyIdByToken(supabaseAdmin, shareToken)
            : null;

        if (!requesterProfile && !sharedPropertyId) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        if (id) {
            const { data: prop, error } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
            if (error || !prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

            const requesterCanAccess = canAccessProperty(requesterProfile, prop);
            const tokenCanAccess = sharedPropertyId === id;

            if (!requesterCanAccess && !tokenCanAccess) {
                if (requesterProfile) {
                    return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
                }
                if (shareToken) {
                    return NextResponse.json({ error: 'Forbidden: invalid share token' }, { status: 403 });
                }
                return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
            }

            // [Hydration] Fetch fresh data for Promoted Customers
            if (prop.data && prop.data.promotedCustomers && prop.data.promotedCustomers.length > 0) {
                const pList = prop.data.promotedCustomers;
                const cardIds = pList.filter((c: any) => c.targetId && c.type === 'businessCard').map((c: any) => c.targetId);
                const custIds = pList.filter((c: any) => c.targetId && c.type === 'customer').map((c: any) => c.targetId);

                // Fetch Maps
                const cardMap = new Map();
                const custMap = new Map();

                if (cardIds.length > 0) {
                    const { data: cards } = await supabaseAdmin.from('business_cards').select('id, name, mobile, etc_memo, category').in('id', cardIds);
                    cards?.forEach(c => cardMap.set(c.id, c));
                }
                if (custIds.length > 0) {
                    // Update: Select ALL columns
                    const { data: custs } = await supabaseAdmin.from('customers').select('id, name, mobile, data, manager_id, wanted_feature, memo_interest').in('id', custIds);

                    // DEBUG LOGGING
                    console.log('[PropertyHydration] Fetched Customers:', custs?.map(c => ({
                        id: c.id,
                        name: c.name,
                        wanted_feature: c.wanted_feature,
                        data_feature: c.data?.feature,
                        data_memo: c.data?.memo
                    })));

                    custs?.forEach(c => custMap.set(c.id, c));
                }

                // Update List with Fresh Data
                prop.data.promotedCustomers = pList.map((item: any) => {
                    if (item.targetId) {
                        if (item.type === 'businessCard' && cardMap.has(item.targetId)) {
                            const c = cardMap.get(item.targetId);
                            return {
                                ...item,
                                name: c.name,
                                contact: c.mobile,
                                classification: c.category || '-',
                                features: c.etc_memo || item.features // Use latest memo
                            };
                        } else if (item.type === 'customer' && custMap.has(item.targetId)) {
                            const c = custMap.get(item.targetId);
                            // Correct mapping for wanted_feature. 
                            // Prioritize feature (Customer Info) over wanted_feature (Store Customer)
                            const syncedFeature = c.data?.feature || c.wanted_feature || c.data?.memo || item.features;

                            return {
                                ...item,
                                name: c.name,
                                contact: c.mobile,
                                classification: c.data?.class || item.classification,
                                budget: c.data?.budget || item.budget,
                                features: syncedFeature // Synced
                            };
                        }
                    }
                    return item;
                });
            }

            if (!requesterCanAccess && tokenCanAccess) {
                return NextResponse.json(transformSharedProperty(prop));
            }

            return NextResponse.json(transformProperty(prop));
        }

        if (!requesterProfile && sharedPropertyId) {
            const { data: sharedProperty, error: sharedError } = await supabaseAdmin
                .from('properties')
                .select('*')
                .eq('id', sharedPropertyId)
                .single();
            if (sharedError || !sharedProperty) {
                return NextResponse.json([]);
            }
            const rows = [sharedProperty];
            if (min) {
                return NextResponse.json(rows.map((p: any) => ({
                    id: p.id,
                    manageId: p.data?.manageId || p.data?.legacyId || p.data?.['관리번호'],
                    name: p.data?.name || p.name
                })));
            }
            return NextResponse.json(rows.map(transformSharedProperty));
        }

        let query = supabaseAdmin.from('properties').select('*').order('created_at', { ascending: false }).range(0, 9999);

        if (isAdmin(requesterProfile)) {
            if (company) {
                const companyId = await resolveCompanyIdByName(supabaseAdmin, company);
                if (companyId) {
                    query = query.eq('company_id', companyId);
                } else {
                    return NextResponse.json([]);
                }
            }
        } else if (requesterProfile?.company_id) {
            if (company) {
                const companyId = await resolveCompanyIdByName(supabaseAdmin, company);
                if (companyId && companyId !== requesterProfile.company_id) {
                    return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
                }
            }
            query = query.eq('company_id', requesterProfile.company_id);
        } else if (requesterProfile?.id) {
            query = query.eq('manager_id', requesterProfile.id);
        } else {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const { data: properties, error } = await query;
        if (error) throw error;

        if (min) {
            return NextResponse.json(properties.map((p: any) => ({
                id: p.id,
                manageId: p.data?.manageId || p.data?.legacyId || p.data?.['관리번호'],
                name: p.data?.name || p.name
            })));
        }

        // Apply Limit if provided
        const limitParam = searchParams.get('limit');
        let resultPosts = properties;

        if (limitParam && limitParam !== 'all') {
            const limitVal = parseInt(limitParam);
            if (!isNaN(limitVal)) {
                resultPosts = resultPosts.slice(0, limitVal);
            }
        } else if (!limitParam) {
            // Default limit if not specified? 
            // Current behavior: returns all (up to 9999 from range(0, 9999))
            // Let's keep it as is (all) unless limit is specified.
        }

        return NextResponse.json(resultPosts.map(transformProperty));

    } catch (error) {
        console.error('Properties GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST
export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { companyName, managerId, name, status, operationType, address, isFavorite, ...rest } = body;
        const requesterProfile = await getRequesterProfile(supabaseAdmin, request, requesterFallbackFromBody(body));

        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const resolvedCompanyId = await resolveCompanyIdByName(supabaseAdmin, companyName || null);
        const mgrUuid = await resolveUserUuid(supabaseAdmin, managerId || requesterProfile.id);
        const companyId = resolvedCompanyId || requesterProfile.company_id;

        if (!companyId || !mgrUuid) {
            return NextResponse.json({ error: 'Valid managerId and company scope are required' }, { status: 400 });
        }

        const { data: managerProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', mgrUuid)
            .single();

        if (!managerProfile || managerProfile.company_id !== companyId) {
            return NextResponse.json({ error: 'Forbidden: manager/company mismatch' }, { status: 403 });
        }

        if (!canAccessCompanyScope(requesterProfile, companyId)) {
            return NextResponse.json({ error: 'Forbidden: cross-company create denied' }, { status: 403 });
        }

        const newId = randomUUID();

        const corePayload = {
            id: newId,
            company_id: companyId,
            manager_id: mgrUuid,
            name,
            status,
            operation_type: operationType,
            address,
            is_favorite: isFavorite || false,
            created_at: body.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            data: {
                ...rest,
                companyName, // Keep legacy fields in JSON for safety
                managerId
            }
        };

        const { data: inserted, error } = await supabaseAdmin
            .from('properties')
            .insert(corePayload)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(transformProperty(inserted), { status: 201 });

    } catch (error) {
        console.error('Properties POST error:', error);
        return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
}

// PUT
export async function PUT(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const body = await request.json();
        const requesterProfile = await getRequesterProfile(supabaseAdmin, request, requesterFallbackFromBody(body));

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        if (!requesterProfile) return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });

        // 1. Fetch existing to merge JSONB
        const { data: existing, error: fetchError } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
        if (fetchError || !existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        if (!canAccessProperty(requesterProfile, existing)) {
            return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
        }

        // 2. Prepare updates
        const { companyName, managerId, name, status, operationType, address, isFavorite, ...rest } = body;

        // Resolve refs if changed
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        let targetCompanyId = existing.company_id;
        const mergedData: Record<string, unknown> = companyName
            ? { ...existing.data, ...rest, companyName }
            : { ...existing.data, ...rest };

        if (companyName) {
            const companyId = await resolveCompanyIdByName(supabaseAdmin, companyName);
            if (!companyId) return NextResponse.json({ error: 'Invalid companyName' }, { status: 400 });
            updates.company_id = companyId;
            targetCompanyId = companyId;
        }
        updates.data = mergedData;

        if (!canAccessCompanyScope(requesterProfile, targetCompanyId)) {
            return NextResponse.json({ error: 'Forbidden: cross-company update denied' }, { status: 403 });
        }

        if (managerId) {
            const mgrUuid = await resolveUserUuid(supabaseAdmin, managerId);
            if (!mgrUuid) return NextResponse.json({ error: 'Invalid managerId' }, { status: 400 });

            const { data: managerProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', mgrUuid)
                .single();

            if (!managerProfile || (targetCompanyId && managerProfile.company_id !== targetCompanyId)) {
                return NextResponse.json({ error: 'Forbidden: manager/company mismatch' }, { status: 403 });
            }

            updates.manager_id = mgrUuid;
            mergedData.managerId = managerId;
        }

        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;
        if (operationType !== undefined) updates.operation_type = operationType;
        if (address !== undefined) updates.address = address;
        if (isFavorite !== undefined) updates.is_favorite = isFavorite;

        // 3. Update
        const { data: updated, error } = await supabaseAdmin
            .from('properties')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(transformProperty(updated));

    } catch (error) {
        console.error('Properties PUT error:', error);
        return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const company = searchParams.get('company');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const requesterProfile = await getRequesterProfile(supabaseAdmin, request);
        if (!requesterProfile) return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });

        const { data: targetProperty, error: targetError } = await supabaseAdmin
            .from('properties')
            .select('id, company_id, manager_id')
            .eq('id', id)
            .single();
        if (targetError || !targetProperty) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }
        if (!canAccessProperty(requesterProfile, targetProperty)) {
            return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
        }

        if (!isAdmin(requesterProfile) && company) {
            const companyId = await resolveCompanyIdByName(supabaseAdmin, company);
            if (!companyId) return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
            if (targetProperty.company_id !== companyId) {
                return NextResponse.json({ error: 'company mismatch for target property' }, { status: 403 });
            }
        }

        const { error } = await supabaseAdmin
            .from('properties')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ message: 'Deleted successfully' });

    } catch (error) {
        console.error('Properties DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
}

