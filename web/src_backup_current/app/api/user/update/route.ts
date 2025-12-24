import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { currentId, newId, name, companyName, oldPassword, newPassword } = body;

        if (!currentId) {
            return NextResponse.json({ error: 'Current ID is required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'User database not found' }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        let users = JSON.parse(fileContent);

        const userIndex = users.findIndex((u: any) => u.id === currentId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = users[userIndex];

        // 1. Handle ID Change
        if (newId && newId !== currentId) {
            // Check for duplicate
            const duplicate = users.find((u: any) => u.id === newId);
            if (duplicate) {
                return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
            }
            user.id = newId;
        }

        // 2. Handle Password Change
        if (newPassword) {
            if (!oldPassword) {
                return NextResponse.json({ error: '기존 비밀번호를 입력해주세요.' }, { status: 401 });
            }
            if (user.password !== oldPassword) {
                return NextResponse.json({ error: '기존 비밀번호가 일치하지 않습니다.' }, { status: 401 });
            }
            user.password = newPassword;
        }

        // 3. Update Info
        if (name) user.name = name;
        if (companyName) user.companyName = companyName;

        // Save back to file
        users[userIndex] = user;
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');

        // Return updated info (excluding password)
        const { password: _, ...updatedUserInfo } = user;
        return NextResponse.json({ user: updatedUserInfo });

    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
