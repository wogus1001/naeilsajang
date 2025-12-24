import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, name, companyName } = body;

        if (!id || !name || !companyName) {
            return NextResponse.json({ error: 'ID, name, and company name are required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'User database not found' }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const users = JSON.parse(fileContent);

        const user = users.find((u: any) => u.id === id && u.name === name && u.companyName === companyName);

        if (user) {
            // MVP: Return password directly (In production, send email/SMS)
            return NextResponse.json({ password: user.password });
        } else {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Find password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
