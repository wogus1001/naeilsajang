import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, password, name, companyName, role: requestedRole } = body;

        if (!id || !password || !name || !companyName) {
            return NextResponse.json({ error: 'ID, password, name, and company name are required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/users.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'User database not found' }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const users = JSON.parse(fileContent);

        // Check if ID already exists
        if (users.find((u: any) => u.id === id)) {
            return NextResponse.json({ error: 'User ID already exists' }, { status: 409 });
        }

        // Logic for Role and Status
        const companyUsers = users.filter((u: any) => u.companyName === companyName);
        const existingManager = companyUsers.find((u: any) => u.role === 'manager');

        let finalRole = requestedRole || 'staff';
        let finalStatus = 'active';
        let message = '회원가입이 완료되었습니다.';

        if (companyUsers.length === 0) {
            // Case 1: New Company -> Force Manager
            finalRole = 'manager';
            finalStatus = 'active';
            if (requestedRole === 'staff') {
                message = '처음 등록되는 회사의 경우 가입자가 팀장이 됩니다.';
            }
        } else {
            // Case 2: Existing Company
            if (finalRole === 'manager') {
                if (existingManager) {
                    return NextResponse.json({ error: '이미 팀장이 존재하는 회사입니다. 직원으로 가입해주세요.' }, { status: 400 });
                }
                // If no manager exists (e.g. left), allow new manager
                finalStatus = 'active';
            } else {
                // Staff joining
                finalRole = 'staff';
                if (existingManager) {
                    finalStatus = 'pending_approval';
                    message = '가입 요청이 완료되었습니다. 팀장의 승인 후 로그인이 가능합니다.';
                } else {
                    // Edge case: Staff joining but no manager? Maybe allow active or force manager.
                    // Spec says "If joining as staff, wait for manager approval".
                    // But if no manager, they can't be approved.
                    // For safety, warn them or force manager.
                    // Let's stick to "User asked for Staff", but warn no manager?
                    // Or maybe just let them in as pending and wait for a manager to join later?
                    // Actually spec rule 1 says "First user is ALWAYS manager".
                    // But here companyUsers > 0, so it's not first user relative to company name, 
                    // but maybe previous users were deleted?
                    // Let's assume standard path: Manager exists -> Staff pending.

                    // Explicit requirement 2: "If manager exists -> join as staff. If they chose manager -> alert."
                    // Implies if manager does NOT exist, maybe they should be manager?
                    // Let's keep it simple: Staff always pending if not manager.
                    finalStatus = 'pending_approval';
                    message = '가입 요청이 완료되었습니다. 팀장의 승인 후 로그인이 가능합니다.';
                }
            }
        }

        // Add new user
        const newUser = {
            id,
            password,
            name,
            companyName,
            role: finalRole,
            status: finalStatus,
            joinedAt: new Date().toISOString()
        };

        users.push(newUser);
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');

        return NextResponse.json({ success: true, user: { id, name, role: finalRole, status: finalStatus }, message });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
