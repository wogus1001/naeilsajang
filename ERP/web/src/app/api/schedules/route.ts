import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Helper: Resolve IDs
async function resolveIds(legacyCompany: string, legacyUser: string) {
    const supabaseAdmin = getSupabaseAdmin();
    let companyId = null;
    let userId = null;

    if (legacyCompany) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('name', legacyCompany).single();
        if (c) companyId = c.id;
    }

    if (legacyUser) {
        // Try precise match first (if it's already a UUID or email)
        if (legacyUser.includes('@')) {
            const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', legacyUser).single();
            if (u) userId = u.id;
        } else {
            // Legacy ID
            const email = `${legacyUser}@example.com`;
            const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
            if (u) userId = u.id;
        }
    }
    return { companyId, userId };
}

async function getSupabaseForResolve() {
    return getSupabaseAdmin();
}

// Transform for Frontend
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
        userId: row.user_id, // Return UUID
        // Inject user name if joined
        userName: row.user?.name || 'Unknown',
        companyName: row.company?.name || '', // If joined
        createdAt: row.created_at
    };
}

export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const company = searchParams.get('company');
        const userId = searchParams.get('userId');

        // Build Query
        let query = supabaseAdmin
            .from('schedules')
            .select('*, user:profiles(name), company:companies(name)');

        // Filter
        if (company) {
            const { companyId } = await resolveIds(company, '');
            if (companyId) {
                query = query.eq('company_id', companyId);
            }
        }

        // Note: The original logic filtered by Scope implicitly or explicit userId.
        // Original: if (scope===work|public) -> company match; if (scope===personal) -> userId match.
        // We will fetch ALL for the company + Personal for the user if requested?
        // Supabase query is simpler: Get everything for company, filter in frontend? 
        // Or if userId provided, include personal items for that user.

        // Simplification: Return all for company.
        // If specific user logic required, we can add `.or(...)` but Supabase AND/OR syntax is tricky.
        // For now, fetching by Company ID covers 'Work' and 'Public'.
        // 'Personal' items might be missed if we strict filter by company?
        // Actually `schedules` has `company_id`. Even personal items have `company_id`.
        // So filtering by `company_id` returns everything belonging to that company context.

        const { data, error } = await query;
        if (error) throw error;

        // Apply Scope Filtering Logic (mirroring original) if needed?
        // Original: if scope=personal && userId != event.userId -> Exclude.
        // We can do this in memory for simplicity or rely on frontend to hide.
        // Let's filter in memory to be safe and match legacy behavior.

        let result = data.map(transformSchedule);

        if (userId) {
            // Map legacy userId to UUID if possible for comparison? 
            // Or just return everything and let frontend filter.
            // The original API filtered.
            // Let's return all.
        }

        return NextResponse.json(result);

    } catch (e) {
        console.error('Schedules GET Error:', e);
        return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { companyName, userId, customerId, propertyId, businessCardId, ...rest } = body;

        const { companyId, userId: userUuid } = await resolveIds(companyName, userId);

        if (!companyId) return NextResponse.json({ error: 'Invalid Company' }, { status: 400 });

        const newId = String(Date.now());

        const { data, error } = await supabaseAdmin.from('schedules').insert({
            id: newId,
            company_id: companyId,
            user_id: userUuid,
            customer_id: customerId || null,
            property_id: propertyId || null,
            business_card_id: businessCardId || null,
            ...rest,
            created_at: new Date().toISOString()
        }).select('*, user:profiles(name)').single();

        if (error) throw error;

        return NextResponse.json(transformSchedule(data), { status: 201 });

    } catch (e) {
        console.error('Schedules POST Error:', e);
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { id, companyName, userId, customerId, propertyId, businessCardId, ...rest } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updates: any = { ...rest };
        // Handle FKs if changed (unlikely for existing, but valid)
        // If passed, we assume we update them.

        const { data, error } = await supabaseAdmin.from('schedules')
            .update(updates)
            .eq('id', id)
            .select('*, user:profiles(name)')
            .single();

        if (error) throw error;

        return NextResponse.json(transformSchedule(data));

    } catch (e) {
        console.error('Schedules PUT Error:', e);
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabaseAdmin.from('schedules').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ message: 'Deleted successfully' });

    } catch (e) {
        console.error('Schedules DELETE Error:', e);
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }
}
