// @ts-nocheck
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src/data/notices.json');

const getNotices = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(fileContent);
};

const saveNotices = (notices: any[]) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(notices, null, 2), 'utf8');
};

export async function GET(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        let notices = getNotices();
        const noticeIndex = notices.findIndex((n: any) => n.id === id);

        if (noticeIndex === -1) {
            return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
        }

        const notice = notices[noticeIndex];

        // Increment views (simple logic, maybe check cookie in real app to prevent spam)
        notices[noticeIndex].views = (notices[noticeIndex].views || 0) + 1;
        saveNotices(notices);

        return NextResponse.json(notice);
    } catch (error) {
        console.error('Fetch notice detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        let notices = getNotices();

        // In real app, check user permission here via session/token

        const initialLength = notices.length;
        notices = notices.filter((n: any) => n.id !== id);

        if (notices.length === initialLength) {
            return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
        }

        saveNotices(notices);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        const { title, content, type, isPinned } = body;

        let notices = getNotices();
        const noticeIndex = notices.findIndex((n: any) => n.id === id);

        if (noticeIndex === -1) {
            return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
        }

        // Update fields - allow partial update
        if (title !== undefined) notices[noticeIndex].title = title;
        if (content !== undefined) notices[noticeIndex].content = content;
        if (type !== undefined) notices[noticeIndex].type = type;
        if (isPinned !== undefined) notices[noticeIndex].isPinned = isPinned;

        saveNotices(notices);
        return NextResponse.json(notices[noticeIndex]);
    } catch (error) {
        console.error('Update notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
