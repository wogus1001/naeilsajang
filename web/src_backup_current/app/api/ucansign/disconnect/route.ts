
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'User DB not found' }, { status: 500 });
        }

        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const userIndex = users.findIndex((u: any) => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Remove UCanSign data
        if (users[userIndex].ucansign) {
            delete users[userIndex].ucansign;
        }

        fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Disconnect API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
