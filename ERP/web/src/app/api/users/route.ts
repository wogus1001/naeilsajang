import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src/data/users.json');

// Helper to read users
const getUsers = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(fileContent);
};

// Helper to write users
const saveUsers = (users: any[]) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
};

export async function GET(request: Request) {
    try {
        // In a real app, we would verify the session/token here.
        // For MVP, we'll trust the client-side check or add a basic header check if needed.
        // But since we are using localStorage, we can't easily verify on server without a cookie.
        // We will return the list and let the client handle display protection.

        const { searchParams } = new URL(request.url);
        const companyFilter = searchParams.get('company');

        const users = getUsers();
        let filteredUsers = users;

        if (companyFilter) {
            filteredUsers = users.filter((u: any) => u.companyName === companyFilter);
        }

        // Don't return passwords
        const safeUsers = filteredUsers.map(({ password, ...user }: any) => user);
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

        console.log(`[API] DELETE request for user ID: ${idToDelete}`);

        if (!idToDelete) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (idToDelete === 'admin') {
            return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 403 });
        }

        let users = getUsers();
        const initialLength = users.length;
        const userToDelete = users.find((u: any) => u.id === idToDelete);

        if (!userToDelete) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (userToDelete.role === 'manager') {
            const companyUsers = users.filter((u: any) => u.companyName === userToDelete.companyName && u.id !== idToDelete);

            // If there are ANY other users (managers or staff) in the company, a manager cannot just leave.
            // They must downgrade to staff first (unless they are the ONLY user left in the company).
            if (companyUsers.length > 0) {
                return NextResponse.json({
                    error: '팀장 권한을 보유한 상태에서는 탈퇴할 수 없습니다. 직원 관리 페이지에서 권한을 변경(직원으로 강등)하거나, 다른 팀장에게 모든 권한을 위임한 후 다시 시도해주세요.'
                }, { status: 400 });
            }
        }

        users = users.filter((u: any) => u.id !== idToDelete);

        if (users.length === initialLength) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        saveUsers(users);
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

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        let users = getUsers();
        const userIndex = users.findIndex((u: any) => u.id === id);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update fields
        if (status) users[userIndex].status = status;
        if (role) users[userIndex].role = role;
        if (companyName) users[userIndex].companyName = companyName;

        // If upgrading to manager, double check if another manager exists (optional, but good for consistency)
        // For now, admin has override power, so we allow it.

        saveUsers(users);
        return NextResponse.json({ success: true, user: users[userIndex] });

    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
