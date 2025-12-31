import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyName = searchParams.get('companyName');

        if (!companyName) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');
        if (!fs.existsSync(filePath)) {
            return NextResponse.json([], { status: 200 });
        }

        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const staff = users.filter((u: any) => u.companyName === companyName);

        // Return safe user info
        const safeStaff = staff.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email, // assuming email is id or separate field, using id as fallback
            role: u.role,
            status: u.status,
            joinedAt: u.joinedAt
        }));

        return NextResponse.json(safeStaff);
    } catch (error) {
        console.error('Fetch staff error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { targetUserId, action, requesterId } = body;

        const filePath = path.join(process.cwd(), 'src/data/users.json');
        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const targetIndex = users.findIndex((u: any) => u.id === targetUserId);
        if (targetIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const targetUser = users[targetIndex];
        const companyUsers = users.filter((u: any) => u.companyName === targetUser.companyName);
        const managers = companyUsers.filter((u: any) => u.role === 'manager');

        // Verify requester is a manager of the same company (basic security)
        // ideally handled by session/middleware but doing lightweight check here
        const requester = users.find((u: any) => u.id === requesterId);
        if (!requester || requester.role !== 'manager' || requester.companyName !== targetUser.companyName) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (action === 'approve') {
            users[targetIndex].status = 'active';
        } else if (action === 'promote') {
            if (managers.length >= 2) {
                return NextResponse.json({ error: '팀장은 최대 2명까지만 지정할 수 있습니다.' }, { status: 400 });
            }
            users[targetIndex].role = 'manager';
        } else if (action === 'promote') {
            if (managers.length >= 2) {
                return NextResponse.json({ error: '팀장은 최대 2명까지만 지정할 수 있습니다.' }, { status: 400 });
            }
            users[targetIndex].role = 'manager';
        } else if (action === 'demote') {
            // Demote functionality: Manager -> Staff
            if (targetUser.role !== 'manager') {
                return NextResponse.json({ error: '해당 사용자는 팀장이 아닙니다.' }, { status: 400 });
            }
            // Ensure there is at least one OTHER manager
            const otherManagers = managers.filter((m: any) => m.id !== targetUserId);
            if (otherManagers.length === 0) {
                return NextResponse.json({ error: '최소 1명의 팀장은 유지되어야 합니다. 다른 직원에게 팀장 권한을 위임한 후 시도하세요.' }, { status: 400 });
            }
            users[targetIndex].role = 'staff';
        }

        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');

        return NextResponse.json({ success: true, user: users[targetIndex] });

    } catch (error) {
        console.error('Update staff error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
