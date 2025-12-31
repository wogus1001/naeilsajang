import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');
        if (!fs.existsSync(filePath)) {
            // No users file means no users, so ID is available
            return NextResponse.json({ available: true });
        }

        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const exists = users.some((u: any) => u.id === id);

        if (exists) {
            return NextResponse.json({ available: false, message: '이미 사용 중인 아이디입니다.' });
        } else {
            return NextResponse.json({ available: true, message: '사용 가능한 아이디입니다.' });
        }
    } catch (error) {
        console.error('Check ID error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
