import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client
// Service Role Client
// Removed top level

const scheduleFilePath = path.join(process.cwd(), 'src/data/schedules.json');

// Helper: Resolve UUIDs
async function resolveIds(legacyCompany: string, legacyManager: string) {
    let companyId = null;
    let managerId = null;

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
        // Ensure legacy fields if needed by frontend
        createdAt: core.created_at,
        updatedAt: core.updated_at
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
        const { companyName, managerId, name, grade, mobile, isFavorite, ...rest } = body;

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
        const { id, companyName, managerId, name, grade, mobile, isFavorite, ...rest } = body;

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
