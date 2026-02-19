import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper Query: Resolve Company/User UUIDs
async function resolveIds(legacyCompany: string | null, legacyManager: string | null) {
    const supabaseAdmin = getSupabaseAdmin();
    let companyId = null;
    let managerId = null;

    if (legacyCompany) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('name', legacyCompany).single();
        if (c) companyId = c.id;
    }

    if (legacyManager) {
        // Fix: If explicitly email, use it. Else append @example.com for legacy usernames.
        const email = legacyManager.includes('@') ? legacyManager : `${legacyManager}@example.com`;
        const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
        if (u) managerId = u.id;
    }

    return { companyId, managerId };
}

async function resolveManagerUuid(legacyManager: string | null) {
    if (!legacyManager) return null;
    if (UUID_REGEX.test(legacyManager)) return legacyManager;
    const { managerId } = await resolveIds(null, legacyManager);
    return managerId;
}

async function getRequesterProfile(supabaseAdmin: any, request: Request, fallbackRaw?: string | null) {
    const { searchParams } = new URL(request.url);
    const requesterRaw =
        searchParams.get('requesterId') ||
        request.headers.get('x-user-id') ||
        fallbackRaw ||
        null;
    const requesterId = await resolveManagerUuid(requesterRaw);
    if (!requesterId) return null;

    const { data: requester } = await supabaseAdmin
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', requesterId)
        .single();

    return requester || null;
}

function canAccessProperty(
    requester: any,
    property: { company_id: string | null; manager_id: string | null }
) {
    if (!requester) return false;
    if (requester.role === 'admin') return true;
    if (requester.company_id && property.company_id && requester.company_id === property.company_id) return true;
    if (requester.id && property.manager_id && requester.id === property.manager_id) return true;
    return false;
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

// GET
export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const company = searchParams.get('company');
    const min = searchParams.get('min') === 'true';

    try {
        if (id) {
            const { data: prop, error } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
            if (error || !prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

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

            return NextResponse.json(transformProperty(prop));
        }

        let query = supabaseAdmin.from('properties').select('*').order('created_at', { ascending: false }).range(0, 9999);

        if (company) {
            // Resolve company name -> UUID
            const { companyId } = await resolveIds(company, '');
            if (companyId) {
                query = query.eq('company_id', companyId);
            } else {
                return NextResponse.json([]); // Company not found
            }
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
        const requesterProfile = await getRequesterProfile(supabaseAdmin, request, managerId || body.manager_id || null);

        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const { companyId, managerId: mgrUuid } = await resolveIds(companyName, managerId);

        if (!companyId || !mgrUuid) {
            return NextResponse.json({ error: 'Valid companyName and managerId are required' }, { status: 400 });
        }

        const { data: managerProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', mgrUuid)
            .single();

        if (!managerProfile || managerProfile.company_id !== companyId) {
            return NextResponse.json({ error: 'Forbidden: manager/company mismatch' }, { status: 403 });
        }

        if (requesterProfile.role !== 'admin') {
            if (!requesterProfile.company_id || requesterProfile.company_id !== companyId) {
                return NextResponse.json({ error: 'Forbidden: cross-company create denied' }, { status: 403 });
            }
        }

        const newId = Date.now().toString(); // Consistent ID gen

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
        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body.requesterId || body.managerId || body.manager_id || null
        );

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
        let updates: any = { updated_at: new Date().toISOString() };
        let targetCompanyId = existing.company_id;

        if (companyName) {
            const { companyId } = await resolveIds(companyName, '');
            if (companyId) {
                updates.company_id = companyId;
                targetCompanyId = companyId;
            }
            updates.data = { ...existing.data, ...rest, companyName }; // Update data.companyName too
        } else {
            updates.data = { ...existing.data, ...rest };
        }

        if (managerId) {
            const mgrUuid = await resolveManagerUuid(managerId);
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
            updates.data.managerId = managerId;
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
        if (!company) return NextResponse.json({ error: 'company is required' }, { status: 400 });

        const requesterProfile = await getRequesterProfile(supabaseAdmin, request, null);
        if (!requesterProfile) return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });

        const { companyId } = await resolveIds(company, null);
        if (!companyId) return NextResponse.json({ error: 'Invalid company' }, { status: 400 });

        const { data: targetProperty, error: targetError } = await supabaseAdmin
            .from('properties')
            .select('id, company_id, manager_id')
            .eq('id', id)
            .single();
        if (targetError || !targetProperty) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }
        if (targetProperty.company_id !== companyId) {
            return NextResponse.json({ error: 'company mismatch for target property' }, { status: 403 });
        }
        if (!canAccessProperty(requesterProfile, targetProperty)) {
            return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('properties')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);

        if (error) throw error;

        return NextResponse.json({ message: 'Deleted successfully' });

    } catch (error) {
        console.error('Properties DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
}
