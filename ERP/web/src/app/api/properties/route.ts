import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client moved to handlers

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
        // Also fallback: if manager found but no company yet, maybe infer company?
    }

    return { companyId, managerId };
}

// Helper: Transform DB Row -> Frontend Object
function transformProperty(row: any) {
    if (!row) return null;
    const { data, ...core } = row;
    // CamelCase conversion for core fields if needed?
    // DB: status, operation_type, is_favorite, address, name
    // Frontend expects: status, operationType, isFavorite, address, name
    // We must map snake_case core cols back to camelCase if frontend expects camelCase.
    // Based on `properties.json`: operationType, isFavorite are used.

    return {
        ...data, // Spread JSONB first (defaults)
        ...core, // Overwrite with Core columns (validated)
        // Manual map for snake_case -> camelCase override
        operationType: core.operation_type,
        isFavorite: core.is_favorite,
        companyId: core.company_id,
        managerId: row.manager_id, // keep snake? No, frontend likely uses `managerId`.
        // We need to fetch manager Legacy ID? Or just use what's in `data` if preserved? 
        // The migration script put everything remaining into `data`.
        // So `managerId` (legacy string) is likely inside `data` if we didn't filter it out?
        // Wait, splitData removed 'managerId' from data.
        // So we might lose the legacy "test1" string if we only return UUID.
        // Frontend might display manager Name.
        // For now, let's trust the `data` blob or better yet, generic object spread.
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
            return NextResponse.json(transformProperty(prop));
        }

        let query = supabaseAdmin.from('properties').select('*').order('created_at', { ascending: false });

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

        return NextResponse.json(properties.map(transformProperty));

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

        const { companyId, managerId: mgrUuid } = await resolveIds(companyName, managerId);

        if (!companyId) return NextResponse.json({ error: 'Invalid Company' }, { status: 400 });

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

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // 1. Fetch existing to merge JSONB
        const { data: existing, error: fetchError } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
        if (fetchError || !existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

        // 2. Prepare updates
        const { companyName, managerId, name, status, operationType, address, isFavorite, ...rest } = body;

        // Resolve refs if changed
        let updates: any = { updated_at: new Date().toISOString() };

        if (companyName) {
            const { companyId } = await resolveIds(companyName, '');
            if (companyId) updates.company_id = companyId;
            updates.data = { ...existing.data, ...rest, companyName }; // Update data.companyName too
        } else {
            updates.data = { ...existing.data, ...rest };
        }

        if (managerId) {
            const { managerId: mgrUuid } = await resolveIds('', managerId);
            if (mgrUuid) updates.manager_id = mgrUuid;
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

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabaseAdmin.from('properties').delete().eq('id', id);

        if (error) throw error;

        return NextResponse.json({ message: 'Deleted successfully' });

    } catch (error) {
        console.error('Properties DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
}
