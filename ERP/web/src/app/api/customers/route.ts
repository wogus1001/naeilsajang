import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import {
    canAccessCompanyResource,
    canAccessCompanyScope,
    getRequesterProfile,
    isAdmin,
    resolveCompanyIdByName,
    resolveUserUuid
} from '@/lib/api-auth';
import { fail, ok } from '@/lib/api-response';

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
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        if (id) {
            const { data: customer, error } = await supabaseAdmin
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !customer) {
                return fail(404, 'NOT_FOUND', 'Customer not found');
            }

            if (!canAccessCompanyResource(requesterProfile, customer)) {
                return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
            }

            return ok(transformCustomer(customer));
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
                return ok([]);
            }
        }

        let scopeMode: 'admin' | 'company' | 'owner' = 'owner';
        let effectiveCompanyId: string | null = null;

        if (isAdmin(requesterProfile)) {
            scopeMode = 'admin';
            effectiveCompanyId = requestedCompanyId;
        } else if (requesterProfile.company_id) {
            if (requestedCompanyId && requestedCompanyId !== requesterProfile.company_id) {
                return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
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

        return ok(result);
    } catch (error) {
        console.error('Customers GET error:', error);
        return fail(500, 'INTERNAL_ERROR', 'Failed to fetch customers');
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
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
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
            return fail(400, 'VALIDATION_ERROR', 'Valid managerId and company scope are required');
        }

        const { data: managerProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', mgrUuid)
            .single();

        if (!managerProfile || managerProfile.company_id !== companyId) {
            return fail(403, 'FORBIDDEN', 'Forbidden: manager/company mismatch');
        }

        if (!isAdmin(requesterProfile) && !canAccessCompanyScope(requesterProfile, companyId)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company create denied');
        }

        const newId = randomUUID();
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
                    id: randomUUID(),
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

        return ok(newCustomer);
    } catch (error) {
        console.error('Customers POST error:', error);
        return fail(500, 'INTERNAL_ERROR', 'Failed to create customer');
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
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const {
            id, companyName, managerId, name, grade, mobile, isFavorite,
            memoInterest, memoHistory, progressSteps, wantedFeature,
            wantedDepositMin, wantedDepositMax, wantedRentMin, wantedRentMax,
            wantedAreaMin, wantedAreaMax, wantedFloorMin, wantedFloorMax,
            ...rest
        } = body;

        if (!id) {
            return fail(400, 'VALIDATION_ERROR', 'ID required');
        }

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            return fail(404, 'NOT_FOUND', 'Customer not found');
        }

        if (!canAccessCompanyResource(requesterProfile, existing)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
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
                return fail(400, 'VALIDATION_ERROR', 'Invalid managerId');
            }

            const { data: managerProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', mgrUuid)
                .single();

            if (!managerProfile || (targetCompanyId && managerProfile.company_id !== targetCompanyId)) {
                return fail(403, 'FORBIDDEN', 'Forbidden: manager/company mismatch');
            }

            updates.manager_id = mgrUuid;
            targetData.managerId = managerId;
        }

        if (!isAdmin(requesterProfile) && targetCompanyId && !canAccessCompanyScope(requesterProfile, targetCompanyId)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company update denied');
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

        return ok(transformCustomer(updated));
    } catch (error) {
        console.error('Customers PUT error:', error);
        return fail(500, 'INTERNAL_ERROR', 'Failed to update customer');
    }
}

export async function DELETE(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        let body: any = null;
        try {
            body = await request.json();
        } catch {
            body = null;
        }

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body?.requesterId || body?.userId || body?.managerId || null
        );
        if (!requesterProfile) {
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const bodyIds: string[] = body && Array.isArray(body.ids) ? body.ids : [];

        if (bodyIds.length > 0) {
            // 대량 삭제 시 .in() 쿼리 URL 길이 제한을 피하기 위해 청크 단위로 처리
            const CHUNK_SIZE = 200;
            let allTargets: any[] = [];

            for (let i = 0; i < bodyIds.length; i += CHUNK_SIZE) {
                const chunk = bodyIds.slice(i, i + CHUNK_SIZE);
                const { data: chunkData, error: chunkError } = await supabaseAdmin
                    .from('customers')
                    .select('id, company_id, manager_id')
                    .in('id', chunk);

                if (chunkError) throw chunkError;
                if (chunkData) allTargets = allTargets.concat(chunkData);
            }

            // 권한 검사 (찾아진 항목에 한해서만 수행, 미존재 항목은 무시)
            const forbidden = allTargets.some((target) => !canAccessCompanyResource(requesterProfile, target));
            if (forbidden) {
                return fail(403, 'FORBIDDEN', 'Forbidden: cross-company delete denied');
            }

            // 청크 단위로 삭제 수행
            const BATCH_SIZE = 200;
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

            return ok({ success: true, count: totalDeleted });
        }

        if (!id) {
            return fail(400, 'VALIDATION_ERROR', 'ID or IDs required');
        }

        const { data: target, error: targetError } = await supabaseAdmin
            .from('customers')
            .select('id, company_id, manager_id')
            .eq('id', id)
            .single();

        if (targetError || !target) {
            return fail(404, 'NOT_FOUND', 'Customer not found');
        }

        if (!canAccessCompanyResource(requesterProfile, target)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company delete denied');
        }

        const { error } = await supabaseAdmin
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return ok({ success: true });
    } catch (error: any) {
        console.error('Customers DELETE error:', error);
        const message = error?.message || error?.details || 'Failed to delete customer';
        return fail(500, 'INTERNAL_ERROR', message);
    }
}
