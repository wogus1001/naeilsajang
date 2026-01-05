import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyName = searchParams.get('companyName');
        const companyId = searchParams.get('companyId');

        if (!companyName && !companyId) {
            return NextResponse.json({ error: 'Company ID or name is required' }, { status: 400 });
        }

        const supabaseAdmin = await getSupabaseAdmin();
        let targetCompanyId = companyId;

        if (!targetCompanyId && companyName) {
            // Find Company ID by name
            const { data: company } = await supabaseAdmin
                .from('companies')
                .select('id')
                .eq('name', companyName)
                .single();

            if (company) {
                targetCompanyId = company.id;
            }
        }

        if (!targetCompanyId) {
            return NextResponse.json([], { status: 200 });
        }

        // Fetch Profiles
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('company_id', targetCompanyId);

        const safeStaff = profiles?.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            joinedAt: u.created_at
        })) || [];

        return NextResponse.json(safeStaff);
    } catch (error) {
        console.error('Fetch staff error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { targetUserId, action, requesterId } = body; // requesterId is likely local ID (email?) or UUID

        const supabaseAdmin = await getSupabaseAdmin();

        // 1. Resolve Requester to UUID
        // Assuming requesterId passed from frontend is the UUID (since login returns UUID now).
        // If it's email, we need to resolve. Let's assume UUID for new login, but legacy?
        // Our login API returns `uid: authUser.id`. So frontend likely has UUID.

        const { data: requester } = await supabaseAdmin
            .from('profiles')
            .select('*, company:companies(*)')
            .eq('id', requesterId) // Try UUID
            .single();

        // If not found, maybe it's email?
        let realRequester = requester;
        if (!realRequester && requesterId.includes('@')) {
            const { data: reqEmail } = await supabaseAdmin.from('profiles').select('*, company:companies(*)').eq('email', requesterId).single();
            realRequester = reqEmail;
        }

        if (!realRequester || realRequester.role !== 'manager') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // 2. Fetch Target
        const { data: targetUser } = await supabaseAdmin.from('profiles').select('*').eq('id', targetUserId).single();
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (targetUser.company_id !== realRequester.company_id) {
            return NextResponse.json({ error: 'Unauthorized (Different Company)' }, { status: 403 });
        }

        // 3. Logic
        // Count Managers
        const { count: managerCount } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', realRequester.company_id)
            .eq('role', 'manager');

        if (action === 'approve') {
            await supabaseAdmin.from('profiles').update({ status: 'active' }).eq('id', targetUserId);
        } else if (action === 'promote') {
            if ((managerCount || 0) >= 2) {
                return NextResponse.json({ error: '팀장은 최대 2명까지만 지정할 수 있습니다.' }, { status: 400 });
            }
            await supabaseAdmin.from('profiles').update({ role: 'manager' }).eq('id', targetUserId);
        } else if (action === 'demote') {
            if (targetUser.role !== 'manager') {
                return NextResponse.json({ error: '해당 사용자는 팀장이 아닙니다.' }, { status: 400 });
            }

            // Check other managers (excluding target)
            // managerCount includes target if they are manager.
            if ((managerCount || 0) <= 1) {
                return NextResponse.json({ error: '최소 1명의 팀장은 유지되어야 합니다.' }, { status: 400 });
            }
            await supabaseAdmin.from('profiles').update({ role: 'staff' }).eq('id', targetUserId);
        }

        // Return updated user
        const { data: updatedUser } = await supabaseAdmin.from('profiles').select('*').eq('id', targetUserId).single();
        return NextResponse.json({ success: true, user: updatedUser });

    } catch (error) {
        console.error('Update staff error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
