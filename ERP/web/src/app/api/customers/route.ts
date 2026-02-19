import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Service Role Client
// Service Role Client
// Removed top level

const scheduleFilePath = path.join(process.cwd(), 'src/data/schedules.json');

// Helper: Resolve UUIDs
async function resolveIds(legacyCompany: string | null, legacyManager: string | null) {
    let companyId = null;
    let managerId = null;
    const supabaseAdmin = await getSupabaseAdmin();

    if (legacyCompany) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('name', legacyCompany).single();
        if (c) companyId = c.id;
    }

    if (legacyManager) {
        const email = `${legacyManager}@example.com`;
        const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
        if (u) managerId = u.id;
    }
    return { companyId, managerId };
}

// Helper: Transform
function transformCustomer(row: any) {
    if (!row) return null;
    const { data, ...core } = row;
    return {
        ...data,
        ...core,
        companyId: core.company_id,
        // Map new explicit columns to frontend fields
        memoInterest: core.memo_interest,
        memoHistory: core.memo_history,
        progressSteps: core.progress_steps || [], // Ensure array
        wantedFeature: core.wanted_feature,

        // Range Fields
        // Range Fields (DB Column || JSONB Data fallback)
        // Use || instead of ?? because DB columns might be empty string '' which ?? treats as valid
        wantedDepositMin: core.wanted_deposit_min || data?.wantedDepositMin,
        wantedDepositMax: core.wanted_deposit_max || data?.wantedDepositMax,
        wantedRentMin: core.wanted_rent_min || data?.wantedRentMin,
        wantedRentMax: core.wanted_rent_max || data?.wantedRentMax,
        wantedAreaMin: core.wanted_area_min || data?.wantedAreaMin,
        wantedAreaMax: core.wanted_area_max || data?.wantedAreaMax,
        wantedFloorMin: core.wanted_floor_min || data?.wantedFloorMin,
        wantedFloorMax: core.wanted_floor_max || data?.wantedFloorMax,

        // Ensure legacy fields if needed by frontend
        createdAt: core.created_at,
        updatedAt: core.updated_at,

        // Safeguard JSONB arrays
        history: data?.history || [],
        promotedProperties: data?.promotedProperties || [],

        // Map isFavorite
        isFavorite: core.is_favorite
    };
}

export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const company = searchParams.get('company');
        const name = searchParams.get('name'); // search

        if (id) {
            const { data: cust, error } = await supabaseAdmin.from('customers').select('*').eq('id', id).single();
            if (error || !cust) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            return NextResponse.json(transformCustomer(cust));
        }

        // Limit Handling
        const limitParam = searchParams.get('limit'); // limit=100 or 'all'
        // If 'all' -> 10000 (Safety Cap), Else -> parsed limit or default 10000 (if not specified, original logic was 1000 page size but loop until done)
        // Original logic: "Chunked Fetching to bypass 1000 row limit" -> fetched ALL until 10000.
        // New logic: If limit specified, fetch UP TO that limit.
        // Default (no limit param) -> keep existing behavior (fetch up to 10000).
        const maxLimit = limitParam === 'all' ? 10000 : (limitParam ? parseInt(limitParam, 10) : 10000);

        // Chunked Fetching to bypass 1000 row limit
        let allCustomers: any[] = [];
        const PAGE_SIZE = 1000;
        let page = 0;
        let hasMore = true;

        // Resolve Company ID once
        let targetCompanyId: string | null = null;
        if (company) {
            const { companyId } = await resolveIds(company, '');
            if (companyId) targetCompanyId = companyId;
            else return NextResponse.json([]);
        }

        while (hasMore) {
            let query = supabaseAdmin
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (targetCompanyId) {
                query = query.eq('company_id', targetCompanyId);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allCustomers = [...allCustomers, ...data];
                if (data.length < PAGE_SIZE) hasMore = false;
                page++;
            } else {
                hasMore = false;
            }

            // Safety Cap or User Limit
            if (allCustomers.length >= maxLimit) {
                hasMore = false;
                // Truncate if we over-fetched in the last chunk
                if (allCustomers.length > maxLimit) {
                    allCustomers = allCustomers.slice(0, maxLimit);
                }
            }
        }

        let result = allCustomers.map(transformCustomer);

        if (name) {
            result = result.filter(c => c.name?.includes(name));
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Customers GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();

        // Check for Bulk Delete Action (POST /api/customers with specific action, or just use DELETE method)
        // But since we are inside POST, we handle creation.
        // Wait, standard REST implies DELETE method for deletion.
        // Let's keep POST for creation.

        const {
            companyName, managerId, name, grade, mobile, isFavorite,
            memoInterest, memoHistory, progressSteps, wantedFeature,
            wantedDepositMin, wantedDepositMax, wantedRentMin, wantedRentMax,
            wantedAreaMin, wantedAreaMax, wantedFloorMin, wantedFloorMax,
            ...rest
        } = body;

        const { companyId, managerId: mgrUuid } = await resolveIds(companyName, managerId);
        if (!companyId) return NextResponse.json({ error: 'Invalid Company' }, { status: 400 });

        const newId = String(Date.now());
        const timestamp = new Date().toISOString();

        const corePayload = {
            id: newId,
            company_id: companyId,
            manager_id: mgrUuid,
            name,
            grade,
            mobile,
            is_favorite: isFavorite || false,
            // New Explicit Columns
            memo_interest: memoInterest,
            memo_history: memoHistory,
            progress_steps: progressSteps,
            wanted_feature: wantedFeature,

            // Range Columns
            wanted_deposit_min: wantedDepositMin,
            wanted_deposit_max: wantedDepositMax,
            wanted_rent_min: wantedRentMin,
            wanted_rent_max: wantedRentMax,
            wanted_area_min: wantedAreaMin,
            wanted_area_max: wantedAreaMax,
            wanted_floor_min: wantedFloorMin,
            wanted_floor_max: wantedFloorMax,

            created_at: timestamp,
            updated_at: timestamp,
            data: { ...rest, companyName, managerId }
        };

        const { data: inserted, error } = await supabaseAdmin
            .from('customers')
            .insert(corePayload)
            .select()
            .single();

        if (error) throw error;

        const newCustomer = transformCustomer(inserted);

        // Legacy Side-effect: Create Schedule (Work History) - Migrated to Supabase (Phase 4)
        try {
            const { error: scheduleError } = await supabaseAdmin.from('schedules').insert({
                id: String(Date.now() + 1),
                title: `[고객등록] ${newCustomer.name}`,
                date: newCustomer.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                scope: 'work',
                status: 'progress',
                type: 'work',
                color: '#51cf66',
                details: '신규 고객 등록',
                customer_id: newCustomer.id,
                user_id: mgrUuid, // Use resolved UUID
                company_id: companyId, // Use resolved UUID
                created_at: new Date().toISOString()
            });

            if (scheduleError) console.error('Failed to create schedule entry in DB:', scheduleError);
        } catch (scheduleError) {
            console.error('Failed to create schedule entry:', scheduleError);
        }

        return NextResponse.json(newCustomer);
    } catch (error) {
        console.error('Customers POST error:', error);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const {
            id, companyName, managerId, name, grade, mobile, isFavorite,
            memoInterest, memoHistory, progressSteps, wantedFeature,
            wantedDepositMin, wantedDepositMax, wantedRentMin, wantedRentMax,
            wantedAreaMin, wantedAreaMax, wantedFloorMin, wantedFloorMax,
            ...rest
        } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { data: existing, error: fetchError } = await supabaseAdmin.from('customers').select('*').eq('id', id).single();
        if (fetchError || !existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        let updates: any = { updated_at: new Date().toISOString() };

        let targetData = { ...existing.data, ...rest };

        if (companyName) {
            const { companyId } = await resolveIds(companyName, '');
            if (companyId) updates.company_id = companyId;
            targetData.companyName = companyName;
        }

        if (managerId) {
            const { managerId: mgrUuid } = await resolveIds('', managerId);
            if (mgrUuid) updates.manager_id = mgrUuid;
            targetData.managerId = managerId;
        }

        updates.data = targetData;

        if (name !== undefined) updates.name = name;
        if (grade !== undefined) updates.grade = grade;
        if (mobile !== undefined) updates.mobile = mobile;
        if (isFavorite !== undefined) updates.is_favorite = isFavorite;

        // Update New Explicit Columns
        if (memoInterest !== undefined) updates.memo_interest = memoInterest;
        if (memoHistory !== undefined) updates.memo_history = memoHistory;
        if (progressSteps !== undefined) updates.progress_steps = progressSteps;
        if (wantedFeature !== undefined) updates.wanted_feature = wantedFeature;

        // Update Range Columns
        if (wantedDepositMin !== undefined) updates.wanted_deposit_min = wantedDepositMin;
        if (wantedDepositMax !== undefined) updates.wanted_deposit_max = wantedDepositMax;
        if (wantedRentMin !== undefined) updates.wanted_rent_min = wantedRentMin;
        if (wantedRentMax !== undefined) updates.wanted_rent_max = wantedRentMax;
        if (wantedAreaMin !== undefined) updates.wanted_area_min = wantedAreaMin;
        if (wantedAreaMax !== undefined) updates.wanted_area_max = wantedAreaMax;
        if (wantedFloorMin !== undefined) updates.wanted_floor_min = wantedFloorMin;
        if (wantedFloorMax !== undefined) updates.wanted_floor_max = wantedFloorMax;

        const { data: updated, error } = await supabaseAdmin
            .from('customers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // [PUSH SYNC] Active Sync to Properties
        try {
            let propQuery = supabaseAdmin.from('properties').select('id, data').contains('data', { promotedCustomers: [{ targetId: id }] });

            if (updates.company_id || existing.company_id) {
                propQuery = propQuery.eq('company_id', updates.company_id || existing.company_id);
            }

            const { data: linkedProps } = await propQuery;

            if (linkedProps && linkedProps.length > 0) {
                console.log(`[PushSync] Updating ${linkedProps.length} properties for Customer ${id}`);
                const customer = transformCustomer(updated);

                for (const prop of linkedProps) {
                    const pList = prop.data.promotedCustomers || [];
                    let modified = false;

                    const newList = pList.map((item: any) => {
                        if (item.targetId === id && item.type === 'customer') {
                            modified = true;
                            // Update Snapshot
                            return {
                                ...item,
                                name: customer.name,
                                contact: customer.mobile,
                                classification: customer.grade || item.classification,
                                budget: customer.budget || item.budget,
                                features: customer.feature || customer.wantedFeature || item.features // UI: Customer Info (feature) > Store Customer (wantedFeature)
                            };
                        }
                        return item;
                    });

                    if (modified) {
                        await supabaseAdmin
                            .from('properties')
                            .update({ data: { ...prop.data, promotedCustomers: newList } })
                            .eq('id', prop.id);
                    }
                }
            }
        } catch (syncError) {
            console.error('[PushSync] Failed to sync to properties:', syncError);
        }

        return NextResponse.json(transformCustomer(updated));

    } catch (error) {
        console.error('Customers PUT error:', error);
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // Retrieve BODY for Bulk Delete (optional)
        // Note: DELETE with body is not strictly standard but supported by Next.js/fetch
        let bodyIds: string[] = [];
        try {
            const body = await request.json();
            if (body && Array.isArray(body.ids)) {
                bodyIds = body.ids;
            }
        } catch (e) {
            // Body might be empty
        }

        if (bodyIds.length > 0) {
            // 대량 삭제 시 Supabase .in() URL 길이 제한 방지 → 100개씩 배치 삭제
            const BATCH_SIZE = 100;
            let totalDeleted = 0;

            for (let i = 0; i < bodyIds.length; i += BATCH_SIZE) {
                const batch = bodyIds.slice(i, i + BATCH_SIZE);
                const { error, count } = await supabaseAdmin
                    .from('customers')
                    .delete({ count: 'exact' })
                    .in('id', batch);
                if (error) throw error;
                totalDeleted += (count || 0);
            }

            return NextResponse.json({ success: true, count: totalDeleted });
        }

        if (!id) return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 });

        const { error } = await supabaseAdmin.from('customers').delete().eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Customers DELETE error:', error);
        // Supabase 에러 상세 메시지 포함
        const message = error?.message || error?.details || 'Failed to delete customer';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
