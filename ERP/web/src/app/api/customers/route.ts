import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
        wantedDepositMin: core.wanted_deposit_min,
        wantedDepositMax: core.wanted_deposit_max,
        wantedRentMin: core.wanted_rent_min,
        wantedRentMax: core.wanted_rent_max,
        wantedAreaMin: core.wanted_area_min,
        wantedAreaMax: core.wanted_area_max,
        wantedFloorMin: core.wanted_floor_min,
        wantedFloorMax: core.wanted_floor_max,

        // Ensure legacy fields if needed by frontend
        createdAt: core.created_at,
        updatedAt: core.updated_at,

        // Safeguard JSONB arrays
        history: data?.history || [],
        promotedProperties: data?.promotedProperties || []
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

        let query = supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false });

        if (company) {
            const { companyId } = await resolveIds(company, '');
            if (companyId) query = query.eq('company_id', companyId);
            else return NextResponse.json([]);
        }

        const { data: customers, error } = await query;
        if (error) throw error;

        let result = customers.map(transformCustomer);

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

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabaseAdmin.from('customers').delete().eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Customers DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
