import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'src/data/users.json');
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ connected: false });
    }

    try {
        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const user = users.find((u: any) => u.id === userId);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.ucansign && user.ucansign.accessToken) {
            return NextResponse.json({
                connected: true,
                linkedAt: user.ucansign.linkedAt
            });
        } else {
            return NextResponse.json({ connected: false });
        }

    } catch (e) {
        console.error('Error reading user status:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
