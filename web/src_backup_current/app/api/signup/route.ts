import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password, name, companyName } = body;

        if (!id || !password || !name) {
            return NextResponse.json({ error: 'ID, password, and name are required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');

        if (!fs.existsSync(filePath)) {
            // Should not happen if seed/login setup is correct, but handle anyway
            return NextResponse.json({ error: 'User database not found' }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const users = JSON.parse(fileContent);

        // Check if ID already exists
        if (users.find((u: any) => u.id === id)) {
            return NextResponse.json({ error: 'User ID already exists' }, { status: 409 });
        }

        // Add new user
        const newUser = {
            id,
            password,
            name,
            companyName: companyName || '', // Optional or required based on business logic
            role: 'user', // Default role
            joinedAt: new Date().toISOString()
        };

        users.push(newUser);
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');

        return NextResponse.json({ success: true, user: { id, name, role: 'user' } });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
