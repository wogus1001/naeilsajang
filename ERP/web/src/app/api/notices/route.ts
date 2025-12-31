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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyName = searchParams.get('companyName');
        const limit = searchParams.get('limit');
        const id = searchParams.get('id'); // Optional: fetch single notice by ID in list API or separate? Let's use separate route for Clean URL properly, but this can serve filtering.

        const notices = getNotices();

        let filteredNotices = notices;

        // Filter valid notices for this user
        if (companyName) {
            // Include SYSTEM notices AND TEAM notices for this company
            filteredNotices = notices.filter((n: any) =>
                n.type === 'system' || (n.type === 'team' && n.companyName === companyName)
            );
        } else {
            // If no company name provided, maybe just return system notices? Or all? 
            // For now, return system notices only to be safe, unless user is admin?
            // Let's assume dashboard might call without company if generic.
            // But usually we pass companyName.
            filteredNotices = notices.filter((n: any) => n.type === 'system');
        }

        // Sort by isPinned desc, then date desc
        filteredNotices.sort((a: any, b: any) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (limit) {
            filteredNotices = filteredNotices.slice(0, parseInt(limit));
        }

        return NextResponse.json(filteredNotices);
    } catch (error) {
        console.error('Fetch notices error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, content, type, authorName, authorRole, companyName, authorId, isPinned } = body;

        if (!title || !content || !type || !authorName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const notices = getNotices();
        const newNotice = {
            id: `notice_${Date.now()}`,
            title,
            content,
            type, // 'system' or 'team'
            authorName,
            authorRole,
            authorId,
            companyName: type === 'team' ? companyName : undefined,
            isPinned: isPinned || false,
            createdAt: new Date().toISOString().split('T')[0].replace(/-/g, '.'), // YYYY.MM.DD format
            views: 0
        };

        notices.unshift(newNotice);
        saveNotices(notices);

        return NextResponse.json(newNotice);
    } catch (error) {
        console.error('Create notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
