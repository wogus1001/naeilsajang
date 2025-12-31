import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'src/data/schedules.json');
const usersFilePath = path.join(process.cwd(), 'src/data/users.json');

// Helper to get users mapping
function getUserMap() {
    if (!fs.existsSync(usersFilePath)) return {};
    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        return users.reduce((acc: any, user: any) => {
            acc[user.id] = user.name;
            return acc;
        }, {});
    } catch {
        return {};
    }
}

// Helper to read data
function getSchedules() {
    if (!fs.existsSync(dataFilePath)) {
        return [];
    }
    const fileContent = fs.readFileSync(dataFilePath, 'utf8');
    try {
        return JSON.parse(fileContent);
    } catch (error) {
        return [];
    }
}

// Helper to write data
function saveSchedules(schedules: any[]) {
    fs.writeFileSync(dataFilePath, JSON.stringify(schedules, null, 2), 'utf8');
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');
    const userId = searchParams.get('userId');

    let schedules = getSchedules();

    if (company || userId) {
        schedules = schedules.filter((event: any) => {
            // Work/Public scope -> Share with company
            if (event.scope === 'work' || event.scope === 'public') {
                return event.companyName === company;
            }
            // Personal/Other scope -> Private to user
            // Also include events created by user if no scope defined (legacy)
            return event.userId === userId;
        });
    }

    // Inject User Names
    const userMap = getUserMap();
    schedules = schedules.map((s: any) => ({
        ...s,
        userName: userMap[s.userId] || s.userId || 'Unknown'
    }));

    return NextResponse.json(schedules);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const schedules = getSchedules();

        const newSchedule = {
            id: Date.now().toString(), // Simple ID generation
            ...body,
            companyName: body.companyName, // Ensure these are saved
            userId: body.userId,
            createdAt: new Date().toISOString()
        };

        schedules.push(newSchedule);
        saveSchedules(schedules);

        return NextResponse.json(newSchedule, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
        }

        let schedules = getSchedules();
        const index = schedules.findIndex((s: any) => s.id === id);

        if (index === -1) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        schedules[index] = { ...schedules[index], ...updateData };
        saveSchedules(schedules);

        return NextResponse.json(schedules[index]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
        }

        let schedules = getSchedules();
        const initialLength = schedules.length;
        // Ensure both IDs are treated as strings for comparison
        schedules = schedules.filter((s: any) => String(s.id) !== String(id));

        if (schedules.length === initialLength) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        saveSchedules(schedules);

        return NextResponse.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }
}
