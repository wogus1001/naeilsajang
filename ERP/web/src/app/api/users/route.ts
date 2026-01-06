import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Force rebuild: Fix ambiguous relationship
    try {
        const { searchParams } = new URL(request.url);
        const isDebug = searchParams.get('debug') === 'true';

        const supabaseAdmin = await getSupabaseAdmin();

        if (isDebug) {
            const debugInfo = {
                envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                count: 0,
                error: null as any,
                data: [] as any[]
            };

            const { data, error, count } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: false });

            debugInfo.count = count || 0;
            debugInfo.data = data || [];
            debugInfo.error = error;

            return NextResponse.json(debugInfo);
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // Build query
        // Update: explicitly specify foreign key 'company_id' because we now have multiple relationships
        // (profiles.company_id -> companies.id AND companies.manager_id -> profiles.id)
        let query = supabaseAdmin
            .from('profiles')
            .select(`
                *,
                company:companies!company_id(name)
            `)
            .order('created_at', { ascending: false });

        if (companyFilter) {
            // Explicit FK here too!
            query = supabaseAdmin
                .from('profiles')
                .select(`*, company:companies!company_id!inner(name)`)
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

    } catch (error: any) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: `[DEBUG-GET] 서버 오류: ${error.message || error}` }, { status: 500 });
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
                // Try searching by exact match just in case
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
                    // Count other managers
                    const { count: otherManagersCount } = await supabaseAdmin
                        .from('profiles')
                        .select('*', { count: 'exact', head: true })
                        .eq('company_id', profile.company_id)
                        .eq('role', 'manager')
                        .neq('id', targetUuid);

                    // Count total other members (including staff)
                    const { count: otherMembersCount } = await supabaseAdmin
                        .from('profiles')
                        .select('*', { count: 'exact', head: true })
                        .eq('company_id', profile.company_id)
                        .neq('id', targetUuid);

                    const otherManagers = otherManagersCount || 0;
                    const otherMembers = otherMembersCount || 0;

                    // Block if: I am the ONLY manager, but there are other staff members left.
                    // (The company cannot be left without a manager if staff exist)
                    if (otherManagers === 0 && otherMembers > 0) {
                        return NextResponse.json({
                            error: '남은 직원이 있는 경우, 팀장은 최소 1명 이상 유지되어야 합니다. 다른 직원에게 팀장 권한을 위임하거나, 모든 직원을 정리한 후 다시 시도해주세요.'
                        }, { status: 400 });
                    }
                }
            }
        }

        // 1. Unlink references (Foreign Key Cleanup) to prevent constraint violations
        await Promise.all([
            supabaseAdmin.from('properties').update({ manager_id: null }).eq('manager_id', targetUuid),
            supabaseAdmin.from('customers').update({ manager_id: null }).eq('manager_id', targetUuid),
            supabaseAdmin.from('contracts').update({ user_id: null }).eq('user_id', targetUuid),
            supabaseAdmin.from('schedules').update({ user_id: null }).eq('user_id', targetUuid),
            supabaseAdmin.from('notices').update({ author_id: null }).eq('author_id', targetUuid),
        ]);

        // Pre-fetch company_id for cleanup check
        const { data: profileForCleanup } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', targetUuid)
            .single();

        const companyIdToClean = profileForCleanup?.company_id;

        // 2. Delete User (Auth) -> Trigger cascades to Profile
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUuid);

        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            if (deleteError.message.includes('foreign key constraint')) {
                return NextResponse.json({
                    error: `[DEBUG-FINAL] 이 사용자와 연결된 데이터(계약서, 공지사항 등)가 있어 삭제할 수 없습니다. 데이터 연결을 먼저 해제해주세요. (${deleteError.message})`
                }, { status: 409 });
            }
            // Check if user not found (already deleted from Auth but maybe profile exists?)
            if (!deleteError.message.includes('User not found')) {
                throw deleteError;
            }
        }

        // [CRITICAL FIX] Explicitly delete from profiles to ensure no "ghost" users remain
        await supabaseAdmin.from('profiles').delete().eq('id', targetUuid);

        // 3. Automatic Company Cleanup: Delete company if no members left
        if (companyIdToClean) {
            const { count } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyIdToClean);

            if (count === 0) {
                console.log(`[CLEANUP] Deleting empty company: ${companyIdToClean}`);
                // Delete company (cascades to other tables should be handled by DB or manual cleanup if needed)
                await supabaseAdmin.from('companies').delete().eq('id', companyIdToClean);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: `[DEBUG-DELETE] 서버 오류: ${error.message || error}` }, { status: 500 });
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

    } catch (error: any) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: `[DEBUG-UPDATE] 서버 오류: ${error.message || error}` }, { status: 500 });
    }
}