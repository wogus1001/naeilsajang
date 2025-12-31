import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password } = body;

        if (!id || !password) {
            return NextResponse.json({ error: 'ID and password are required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'User database not found' }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const users = JSON.parse(fileContent);

        const user = users.find((u: any) => u.id === id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.password !== password) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        // Check status
        if (user.status === 'pending_approval') {
            return NextResponse.json({ error: '팀장의 승인 대기 중입니다. 승인 후 로그인이 가능합니다.' }, { status: 403 });
        }

        // Return user info without password
        const { password: _, ...userInfo } = user;
        return NextResponse.json({ user: userInfo });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
