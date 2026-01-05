import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyFilter = searchParams.get('company');

        const supabaseAdmin = await getSupabaseAdmin();

        // Build query
        let query = supabaseAdmin
            .from('profiles')
            .select(`
                *,
                company:companies(name)
            `)
            .order('created_at', { ascending: false });

        if (companyFilter) {
            // This is tricky because companyFilter is a NAME, but we have company_id.
            // We need to filter by the joined table... Supabase postgrest supports inner join filtering?
            // simpler: Fetch all and filter in memory (not efficient for big data, but OK for now)
            // or: !inner join
            query = supabaseAdmin
                .from('profiles')
                .select(`*, company:companies!inner(name)`)
                .eq('company.name', companyFilter)
                .order('created_at', { ascending: false });
        }

        const { data: profiles, error } = await query;

        if (error) throw error;

        const safeUsers = profiles.map(p => {
            // Restore legacy ID format by stripping default domain
            const displayId = p.email?.endsWith('@example.com')
                ? p.email.split('@')[0]
                : p.email;

            return {
                id: displayId,
                uuid: p.id,
                name: p.name,
                companyName: p.company?.name || '-',
                role: p.role,
                status: p.status,
                joinedAt: p.created_at
            };
        });

        return NextResponse.json(safeUsers);

    } catch (error) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idToDelete = searchParams.get('id');

        if (!idToDelete) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (idToDelete === 'admin' || idToDelete.startsWith('admin@')) {
            return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 403 });
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // Resolve ID to UUID
        let targetUuid = idToDelete;

        // Check if it's already a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToDelete);

        if (!isUuid) {
            // It's a short ID or Email
            let emailToSearch = idToDelete;
            if (!idToDelete.includes('@')) {
                emailToSearch = `${idToDelete}@example.com`;
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, role, company_id')
                .eq('email', emailToSearch)
                .single();

            if (!profile) {
                // Try searching by exact match just in case (legacy data?)
                const { data: profileFallback } = await supabaseAdmin
                    .from('profiles')
                    .select('id, role, company_id')
                    .eq('email', idToDelete)
                    .single();

                if (!profileFallback) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }
                targetUuid = profileFallback.id;
            } else {
                targetUuid = profile.id;

                // Logic Check: Manager Leaving
                if (profile.role === 'manager') {
                    const { count } = await supabaseAdmin
                        .from('profiles')
                        .select('*', { count: 'exact', head: true })
                        .eq('company_id', profile.company_id)
                        .neq('id', targetUuid);

                    if (count && count > 0) {
                        return NextResponse.json({
                            error: '팀장 권한을 보유한 상태에서는 탈퇴할 수 없습니다. 직원 관리 페이지에서 권한을 변경(직원으로 강등)하거나, 다른 팀장에게 모든 권한을 위임한 후 다시 시도해주세요.'
                        }, { status: 400 });
                    }
                }
            }
        }

        // Delete User (Auth) -> Trigger cascades to Profile
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUuid);
        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, status, role, companyName } = body;
        // id is likely email from the frontend list

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // Resolve ID to UUID
        let targetUuid = id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (!isUuid) {
            let emailToSearch = id;
            if (!id.includes('@')) {
                emailToSearch = `${id}@example.com`;
            }

            const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', emailToSearch).single();
            if (!profile) {
                // Try exact match
                const { data: exactProfile } = await supabaseAdmin.from('profiles').select('id').eq('email', id).single();
                if (!exactProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
                targetUuid = exactProfile.id;
            } else {
                targetUuid = profile.id;
            }
        }

        const updates: any = {};
        if (status) updates.status = status;
        if (role) updates.role = role;
        // companyName update is complex (needs company ID resolution), skipping for now as usually admin updates status/role.

        const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', targetUuid);
        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
