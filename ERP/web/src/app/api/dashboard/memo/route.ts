import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MEMO_FILE = path.join(process.cwd(), 'src/data', 'memos.json');

const readMemos = () => {
    if (!fs.existsSync(MEMO_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(MEMO_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const saveMemos = (memos: any[]) => {
    fs.writeFileSync(MEMO_FILE, JSON.stringify(memos, null, 2), 'utf8');
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const memos = readMemos();
    const userMemo = memos.find((m: any) => m.userId === userId);

    return NextResponse.json({ content: userMemo ? userMemo.content : '' });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, content } = body;

        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        const memos = readMemos();
        const existingIndex = memos.findIndex((m: any) => m.userId === userId);

        if (existingIndex > -1) {
            memos[existingIndex].content = content;
            memos[existingIndex].updatedAt = new Date().toISOString();
        } else {
            memos.push({
                userId,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        saveMemos(memos);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save memo' }, { status: 500 });
    }
}
