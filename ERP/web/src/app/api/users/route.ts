import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Force rebuild: Fix ambiguous relationship
    try {
        const { searchParams } = new URL(request.url);
        const isDebug = searchParams.get('debug') === 'true';
        const companyFilter = searchParams.get('company');

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
        // 1. Unlink references (Foreign Key Cleanup) sequentially to identify failure
        const cleanupTables = [
            { table: 'properties', col: 'manager_id' },
            { table: 'customers', col: 'manager_id' },
            { table: 'contracts', col: 'user_id' },
            { table: 'schedules', col: 'user_id' },
            { table: 'notices', col: 'author_id' },
            { table: 'projects', col: 'created_by' },
            { table: 'contract_templates', col: 'created_by' },
            { table: 'companies', col: 'owner_id' },
            { table: 'companies', col: 'manager_id' } // Fix: Unlink company manager
        ];

        for (const { table, col } of cleanupTables) {
            try {
                console.log(`[DEBUG-DELETE] Unlinking ${table}.${col}...`);
                const { error } = await supabaseAdmin.from(table).update({ [col]: null }).eq(col, targetUuid);
                if (error) {
                    console.error(`[DEBUG-DELETE] Failed to unlink ${table}: ${error.message}`);
                    return NextResponse.json({ error: `[DEBUG-DELETE] Failed to unlink ${table}: ${error.message}` }, { status: 500 });
                }
            } catch (err: any) {
                console.error(`[DEBUG-DELETE] Exception unlinking ${table}:`, err);
                return NextResponse.json({ error: `[DEBUG-DELETE] Exception unlinking ${table}: ${err.message}` }, { status: 500 });
            }
        }

        // VERIFICATION: Check if cleanup actually worked
        const { count: projectCount } = await supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('created_by', targetUuid);
        const { count: templateCount } = await supabaseAdmin.from('contract_templates').select('id', { count: 'exact', head: true }).eq('created_by', targetUuid);
        const { count: companyCount } = await supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('owner_id', targetUuid);

        console.log(`[DEBUG-DELETE] Cleanup Verification - Projects: ${projectCount}, Templates: ${templateCount}, Companies: ${companyCount}`);

        if ((projectCount || 0) > 0 || (templateCount || 0) > 0 || (companyCount || 0) > 0) {
            return NextResponse.json({
                error: `데이터 연결 해제 실패. 프로젝트: ${projectCount}, 템플릿: ${templateCount}, 회사소유: ${companyCount}. (DB 제약조건으로 인해 업데이트가 무시되었을 수 있습니다.)`
            }, { status: 409 });
        }

        // Pre-fetch company_id for cleanup check
        const { data: profileForCleanup } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', targetUuid)
            .single();

        const companyIdToClean = profileForCleanup?.company_id;

        // [CYCLE 5] Handle Storage Objects (Files)
        // Scenario A: User uploaded files but others need them -> Set owner to NULL (Anonymize)
        // Scenario B: User is solo -> Files will eventually be cleaned up by company deletion or manual GC, but for now NULL is safe.
        // This prevents the "Foreign Key Violation" from storage.objects blocking deletion.
        try {
            // explicit schema('storage') access is required for storage tables
            console.log('[DEBUG-DELETE] Anonymizing storage objects...');
            const { error: storageError } = await supabaseAdmin
                .schema('storage')
                .from('objects')
                .update({ owner: null })
                .eq('owner', targetUuid);

            if (storageError) {
                console.error('[DEBUG-DELETE] Storage unlink failed (will try ignore):', storageError);
            } else {
                console.log('[DEBUG-DELETE] Storage objects anonymized successfully.');
            }
        } catch (e) {
            console.error('[DEBUG-DELETE] Failed to access storage schema:', e);
            // Verify if 'storage' schema access is enabled for this client
        }

        // [CYCLE 4] Strategy: Explicitly delete from 'profiles' first to reveal hidden constraints
        // Postgres will throw specific error (e.g., table name, constraint name) here, unlike auth.admin.deleteUser
        try {
            const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', targetUuid);
            if (profileDeleteError) {
                console.error('[DEBUG-DELETE] Profile delete failed:', profileDeleteError);
                throw profileDeleteError; // This will go to outer catch with full Postgres details
            }
        } catch (error: any) {
            console.error('[DEBUG-DELETE] Captured profile delete error:', error);
            throw error;
        }

        // 2. Delete User (Auth)
        // Profile is already deleted, so this cleans up the Auth User row
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUuid);

        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            if (!deleteError.message.includes('User not found')) {
                throw deleteError;
            }
        }

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

        // Capture specific Postgres error details that are often non-enumerable
        const errorDetails = {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            constraint: error.constraint,
            tableName: error.table,
            columnName: error.column,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        };

        return NextResponse.json({
            error: `[DEBUG-DELETE] 서버 오류: ${error.message}`,
            debug: errorDetails
        }, { status: 500 });
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