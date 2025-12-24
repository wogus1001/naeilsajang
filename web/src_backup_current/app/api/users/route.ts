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
