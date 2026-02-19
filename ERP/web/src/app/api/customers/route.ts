import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
    canAccessCompanyResource,
    canAccessCompanyScope,
    getRequesterProfile,
    isAdmin,
    resolveCompanyIdByName,
    resolveUserUuid
} from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function transformCustomer(row: any) {
    if (!row) return null;

    const data = row.data || {};
    const core = row;

    return {
        ...data,
        ...core,
        companyId: core.company_id,
        memoInterest: core.memo_interest,
        memoHistory: core.memo_history,
        progressSteps: core.progress_steps || [],
        wantedFeature: core.wanted_feature,
        wantedDepositMin: core.wanted_deposit_min || data?.wantedDepositMin,
        wantedDepositMax: core.wanted_deposit_max || data?.wantedDepositMax,
        wantedRentMin: core.wanted_rent_min || data?.wantedRentMin,
        wantedRentMax: core.wanted_rent_max || data?.wantedRentMax,
        wantedAreaMin: core.wanted_area_min || data?.wantedAreaMin,
        wantedAreaMax: core.wanted_area_max || data?.wantedAreaMax,
        wantedFloorMin: core.wanted_floor_min || data?.wantedFloorMin,
        wantedFloorMax: core.wanted_floor_max || data?.wantedFloorMax,
        createdAt: core.created_at,
        updatedAt: core.updated_at,
        history: data?.history || [],
        promotedProperties: data?.promotedProperties || [],
        isFavorite: core.is_favorite
    };
}

export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const company = searchParams.get('company');
        const name = searchParams.get('name');

        const requesterProfile = await getRequesterProfile(supabaseAdmin, request);
        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        if (id) {
            const { data: customer, error } = await supabaseAdmin
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !customer) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            if (!canAccessCompanyResource(requesterProfile, customer)) {
                return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
            }

            return NextResponse.json(transformCustomer(customer));
        }

        const limitParam = searchParams.get('limit');
        const maxLimit = limitParam === 'all' ? 10000 : (limitParam ? parseInt(limitParam, 10) : 10000);

        let allCustomers: any[] = [];
        const PAGE_SIZE = 1000;
        let page = 0;
        let hasMore = true;

        let requestedCompanyId: string | null = null;
        if (company) {
            requestedCompanyId = await resolveCompanyIdByName(supabaseAdmin, company);
            if (!requestedCompanyId) {
                return NextResponse.json([]);
            }
        }

        let scopeMode: 'admin' | 'company' | 'owner' = 'owner';
        let effectiveCompanyId: string | null = null;

        if (isAdmin(requesterProfile)) {
            scopeMode = 'admin';
            effectiveCompanyId = requestedCompanyId;
        } else if (requesterProfile.company_id) {
            if (requestedCompanyId && requestedCompanyId !== requesterProfile.company_id) {
                return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
            }
            scopeMode = 'company';
            effectiveCompanyId = requesterProfile.company_id;
        }

        while (hasMore) {
            let query = supabaseAdmin
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (scopeMode === 'company' && effectiveCompanyId) {
                query = query.eq('company_id', effectiveCompanyId);
            }
            if (scopeMode === 'owner') {
                query = query.eq('manager_id', requesterProfile.id);
            }
            if (scopeMode === 'admin' && effectiveCompanyId) {
                query = query.eq('company_id', effectiveCompanyId);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allCustomers = allCustomers.concat(data);
                if (data.length < PAGE_SIZE) hasMore = false;
                page++;
            } else {
                hasMore = false;
            }

            if (allCustomers.length >= maxLimit) {
                hasMore = false;
                if (allCustomers.length > maxLimit) {
                    allCustomers = allCustomers.slice(0, maxLimit);
                }
            }
        }

        let result = allCustomers.map(transformCustomer);

        if (name) {
            result = result.filter((customer) => customer.name?.includes(name));
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

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body.requesterId || body.userId || body.managerId || null
        );
        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const {
            companyName, managerId, name, grade, mobile, isFavorite,
            memoInterest, memoHistory, progressSteps, wantedFeature,
            wantedDepositMin, wantedDepositMax, wantedRentMin, wantedRentMax,
            wantedAreaMin, wantedAreaMax, wantedFloorMin, wantedFloorMax,
            ...rest
        } = body;

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

        if (!isAdmin(requesterProfile) && !canAccessCompanyScope(requesterProfile, companyId)) {
            return NextResponse.json({ error: 'Forbidden: cross-company create denied' }, { status: 403 });
        }

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
            memo_interest: memoInterest,
            memo_history: memoHistory,
            progress_steps: progressSteps,
            wanted_feature: wantedFeature,
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

        try {
            const { error: scheduleError } = await supabaseAdmin
                .from('schedules')
                .insert({
                    id: String(Date.now() + 1),
                    title: `[Customer Register] ${newCustomer.name}`,
                    date: newCustomer.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                    scope: 'work',
                    status: 'progress',
                    type: 'work',
                    color: '#51cf66',
                    details: 'New customer registered',
                    customer_id: newCustomer.id,
                    user_id: mgrUuid,
                    company_id: companyId,
                    created_at: new Date().toISOString()
                });

            if (scheduleError) {
                console.error('Failed to create schedule entry in DB:', scheduleError);
            }
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

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body.requesterId || body.userId || body.managerId || null
        );
        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const {
            id, companyName, managerId, name, grade, mobile, isFavorite,
            memoInterest, memoHistory, progressSteps, wantedFeature,
            wantedDepositMin, wantedDepositMax, wantedRentMin, wantedRentMax,
            wantedAreaMin, wantedAreaMax, wantedFloorMin, wantedFloorMax,
            ...rest
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (!canAccessCompanyResource(requesterProfile, existing)) {
            return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
        }

        const updates: any = { updated_at: new Date().toISOString() };
        const targetData = { ...(existing.data || {}), ...rest };

        let targetCompanyId = existing.company_id;

        if (companyName) {
            const companyId = await resolveCompanyIdByName(supabaseAdmin, companyName);
            if (companyId) {
                updates.company_id = companyId;
                targetCompanyId = companyId;
            }
            targetData.companyName = companyName;
        }

        if (managerId) {
            const mgrUuid = await resolveUserUuid(supabaseAdmin, managerId);
            if (!mgrUuid) {
                return NextResponse.json({ error: 'Invalid managerId' }, { status: 400 });
            }

            const { data: managerProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', mgrUuid)
                .single();

            if (!managerProfile || (targetCompanyId && managerProfile.company_id !== targetCompanyId)) {
                return NextResponse.json({ error: 'Forbidden: manager/company mismatch' }, { status: 403 });
            }

            updates.manager_id = mgrUuid;
            targetData.managerId = managerId;
        }

        if (!isAdmin(requesterProfile) && targetCompanyId && !canAccessCompanyScope(requesterProfile, targetCompanyId)) {
            return NextResponse.json({ error: 'Forbidden: cross-company update denied' }, { status: 403 });
        }

        updates.data = targetData;

        if (name !== undefined) updates.name = name;
        if (grade !== undefined) updates.grade = grade;
        if (mobile !== undefined) updates.mobile = mobile;
        if (isFavorite !== undefined) updates.is_favorite = isFavorite;

        if (memoInterest !== undefined) updates.memo_interest = memoInterest;
        if (memoHistory !== undefined) updates.memo_history = memoHistory;
        if (progressSteps !== undefined) updates.progress_steps = progressSteps;
        if (wantedFeature !== undefined) updates.wanted_feature = wantedFeature;

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

        try {
            let propQuery = supabaseAdmin
                .from('properties')
                .select('id, data')
                .contains('data', { promotedCustomers: [{ targetId: id }] });

            if (updates.company_id || existing.company_id) {
                propQuery = propQuery.eq('company_id', updates.company_id || existing.company_id);
            }

            const { data: linkedProps } = await propQuery;

            if (linkedProps && linkedProps.length > 0) {
                const customer = transformCustomer(updated);

                for (const prop of linkedProps) {
                    const promotedList = prop.data?.promotedCustomers || [];
                    let modified = false;

                    const newList = promotedList.map((item: any) => {
                        if (item.targetId === id && item.type === 'customer') {
                            modified = true;
                            return {
                                ...item,
                                name: customer.name,
                                contact: customer.mobile,
                                classification: customer.grade || item.classification,
                                budget: customer.budget || item.budget,
                                features: customer.feature || customer.wantedFeature || item.features
                            };
                        }
                        return item;
                    });

                    if (modified) {
                        await supabaseAdmin
                            .from('properties')
                            .update({ data: { ...(prop.data || {}), promotedCustomers: newList } })
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

        const requesterProfile = await getRequesterProfile(supabaseAdmin, request);
        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        let bodyIds: string[] = [];
        try {
            const body = await request.json();
            if (body && Array.isArray(body.ids)) {
                bodyIds = body.ids;
            }
        } catch {
            bodyIds = [];
        }

        if (bodyIds.length > 0) {
            const { data: targets, error: targetError } = await supabaseAdmin
                .from('customers')
                .select('id, company_id, manager_id')
                .in('id', bodyIds);

            if (targetError) throw targetError;

            if (!targets || targets.length !== bodyIds.length) {
                return NextResponse.json({ error: 'Some customers were not found' }, { status: 404 });
            }

            const forbidden = targets.some((target) => !canAccessCompanyResource(requesterProfile, target));
            if (forbidden) {
                return NextResponse.json({ error: 'Forbidden: cross-company delete denied' }, { status: 403 });
            }

            const BATCH_SIZE = 100;
            let totalDeleted = 0;

            for (let i = 0; i < bodyIds.length; i += BATCH_SIZE) {
                const batch = bodyIds.slice(i, i + BATCH_SIZE);
                const { error, count } = await supabaseAdmin
                    .from('customers')
                    .delete({ count: 'exact' })
                    .in('id', batch);

                if (error) throw error;
                totalDeleted += count || 0;
            }

            return NextResponse.json({ success: true, count: totalDeleted });
        }

        if (!id) {
            return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 });
        }

        const { data: target, error: targetError } = await supabaseAdmin
            .from('customers')
            .select('id, company_id, manager_id')
            .eq('id', id)
            .single();

        if (targetError || !target) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (!canAccessCompanyResource(requesterProfile, target)) {
            return NextResponse.json({ error: 'Forbidden: cross-company delete denied' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Customers DELETE error:', error);
        const message = error?.message || error?.details || 'Failed to delete customer';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
