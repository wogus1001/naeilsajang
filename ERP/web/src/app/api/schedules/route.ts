import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import {
    canAccessCompanyScope,
    getRequesterProfile,
    isAdmin,
    resolveCompanyIdByName,
    resolveUserUuid,
    type RequesterProfile
} from '@/lib/api-auth';
import { fail, ok } from '@/lib/api-response';

function transformSchedule(row: any) {
    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        date: row.date,
        scope: row.scope,
        status: row.status,
        type: row.type,
        color: row.color,
        details: row.details,
        customerId: row.customer_id,
        propertyId: row.property_id,
        businessCardId: row.business_card_id,
        userId: row.user_id,
        userName: row.user?.name || 'Unknown',
        companyName: row.company?.name || '',
        createdAt: row.created_at
    };
}

function canReadSchedule(requester: RequesterProfile, schedule: { company_id: string | null; user_id: string | null; scope: string | null }) {
    if (isAdmin(requester)) return true;

    if (schedule.scope === 'personal') {
        return !!schedule.user_id && schedule.user_id === requester.id;
    }

    if (requester.company_id && schedule.company_id && requester.company_id === schedule.company_id) {
        return true;
    }

    return !!schedule.user_id && schedule.user_id === requester.id;
}

function canWriteSchedule(requester: RequesterProfile, schedule: { company_id: string | null; user_id: string | null; scope: string | null }) {
    if (isAdmin(requester)) return true;

    if (schedule.scope === 'personal') {
        return !!schedule.user_id && schedule.user_id === requester.id;
    }

    if (requester.company_id && schedule.company_id && requester.company_id === schedule.company_id) {
        return true;
    }

    return !!schedule.user_id && schedule.user_id === requester.id;
}

export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const company = searchParams.get('company');
        const userIdParam = searchParams.get('userId');

        const requesterProfile = await getRequesterProfile(supabaseAdmin, request);
        if (!requesterProfile) {
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const requestedUserId = userIdParam ? await resolveUserUuid(supabaseAdmin, userIdParam) : null;
        if (requestedUserId && !isAdmin(requesterProfile) && requestedUserId !== requesterProfile.id) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cannot query another user personal schedule');
        }

        let targetCompanyId: string | null = null;
        if (company) {
            targetCompanyId = await resolveCompanyIdByName(supabaseAdmin, company);
            if (!targetCompanyId) {
                return ok([]);
            }

            if (!isAdmin(requesterProfile) && requesterProfile.company_id !== targetCompanyId) {
                return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
            }
        }

        let query = supabaseAdmin
            .from('schedules')
            .select('*, user:profiles(name), company:companies(name)')
            .order('date', { ascending: true })
            .order('created_at', { ascending: true });

        if (isAdmin(requesterProfile)) {
            if (targetCompanyId) {
                query = query.eq('company_id', targetCompanyId);
            }
        } else if (requesterProfile.company_id) {
            query = query.eq('company_id', requesterProfile.company_id);
        } else {
            query = query.eq('user_id', requesterProfile.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        let result = (data || []).filter((row: any) => canReadSchedule(requesterProfile, row));

        if (requestedUserId) {
            result = result.filter((row: any) => {
                if (row.scope === 'personal') {
                    return row.user_id === requestedUserId;
                }
                return true;
            });
        }

        return ok(result.map(transformSchedule));
    } catch (e) {
        console.error('Schedules GET Error:', e);
        return fail(500, 'INTERNAL_ERROR', 'Failed to fetch schedules');
    }
}

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body.requesterId || body.userId || null
        );
        if (!requesterProfile) {
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const { companyName, userId, customerId, propertyId, businessCardId, companyId: directCompanyId, ...rest } = body;

        const userUuid = await resolveUserUuid(supabaseAdmin, userId || requesterProfile.id);
        let companyId = directCompanyId || null;

        if (!companyId && companyName) {
            companyId = await resolveCompanyIdByName(supabaseAdmin, companyName);
        }
        if (!companyId) {
            companyId = requesterProfile.company_id;
        }

        if (!companyId) {
            return fail(400, 'VALIDATION_ERROR', 'Invalid Company');
        }

        if (!isAdmin(requesterProfile) && !canAccessCompanyScope(requesterProfile, companyId)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company create denied');
        }

        if (!userUuid) {
            return fail(400, 'VALIDATION_ERROR', 'Valid userId is required');
        }

        const { data: ownerProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', userUuid)
            .single();

        if (!ownerProfile || ownerProfile.company_id !== companyId) {
            return fail(403, 'FORBIDDEN', 'Forbidden: user/company mismatch');
        }

        if (!isAdmin(requesterProfile) && rest.scope === 'personal' && userUuid !== requesterProfile.id) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cannot create personal schedule for another user');
        }

        const { data, error } = await supabaseAdmin
            .from('schedules')
            .insert({
                id: randomUUID(),
                company_id: companyId,
                user_id: userUuid,
                customer_id: customerId || null,
                property_id: propertyId || null,
                business_card_id: businessCardId || null,
                ...rest,
                created_at: new Date().toISOString()
            })
            .select('*, user:profiles(name), company:companies(name)')
            .single();

        if (error) {
            console.error('Schedules Insert DB Error:', error);
            throw error;
        }

        return ok(transformSchedule(data), 201);
    } catch (e: any) {
        console.error('Schedules POST Error:', e);
        return fail(500, 'INTERNAL_ERROR', 'Failed to create schedule');
    }
}

export async function PUT(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            body.requesterId || body.userId || null
        );
        if (!requesterProfile) {
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const { id, companyName, userId, companyId: directCompanyId, customerId, propertyId, businessCardId, ...rest } = body;

        if (!id) {
            return fail(400, 'VALIDATION_ERROR', 'ID required');
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('schedules')
            .select('id, company_id, user_id, scope')
            .eq('id', id)
            .single();

        if (existingError || !existing) {
            return fail(404, 'NOT_FOUND', 'Schedule not found');
        }

        if (!canWriteSchedule(requesterProfile, existing)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
        }

        let targetCompanyId = existing.company_id;
        if (directCompanyId) {
            targetCompanyId = directCompanyId;
        } else if (companyName) {
            targetCompanyId = await resolveCompanyIdByName(supabaseAdmin, companyName);
        }

        const targetUserId = userId ? await resolveUserUuid(supabaseAdmin, userId) : existing.user_id;

        if (!isAdmin(requesterProfile) && targetCompanyId && !canAccessCompanyScope(requesterProfile, targetCompanyId)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company update denied');
        }

        const nextScope = rest.scope || existing.scope;
        if (!isAdmin(requesterProfile) && nextScope === 'personal' && targetUserId !== requesterProfile.id) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cannot manage another user personal schedule');
        }

        if (targetUserId && targetCompanyId) {
            const { data: targetUserProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', targetUserId)
                .single();

            if (!targetUserProfile || targetUserProfile.company_id !== targetCompanyId) {
                return fail(403, 'FORBIDDEN', 'Forbidden: user/company mismatch');
            }
        }

        const updates: any = {
            ...rest,
            customer_id: customerId,
            property_id: propertyId,
            business_card_id: businessCardId,
            updated_at: new Date().toISOString()
        };

        if (targetCompanyId) updates.company_id = targetCompanyId;
        if (targetUserId) updates.user_id = targetUserId;

        const { data, error } = await supabaseAdmin
            .from('schedules')
            .update(updates)
            .eq('id', id)
            .select('*, user:profiles(name), company:companies(name)')
            .single();

        if (error) throw error;

        return ok(transformSchedule(data));
    } catch (e) {
        console.error('Schedules PUT Error:', e);
        return fail(500, 'INTERNAL_ERROR', 'Failed to update schedule');
    }
}

export async function DELETE(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return fail(400, 'VALIDATION_ERROR', 'ID required');
        }

        const requesterProfile = await getRequesterProfile(
            supabaseAdmin,
            request,
            searchParams.get('requesterId') || searchParams.get('userId') || null
        );

        if (!requesterProfile) {
            return fail(401, 'AUTH_REQUIRED', 'requesterId is required');
        }

        const { data: target, error: targetError } = await supabaseAdmin
            .from('schedules')
            .select('id, company_id, user_id, scope')
            .eq('id', id)
            .single();

        if (targetError || !target) {
            return fail(404, 'NOT_FOUND', 'Schedule not found');
        }

        if (!canWriteSchedule(requesterProfile, target)) {
            return fail(403, 'FORBIDDEN', 'Forbidden: cross-company access denied');
        }

        const { error } = await supabaseAdmin
            .from('schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return ok({ success: true });
    } catch (e) {
        console.error('Schedules DELETE Error:', e);
        return fail(500, 'INTERNAL_ERROR', 'Failed to delete schedule');
    }
}
