import { NextResponse } from 'next/server';
import { getFolders, createFolder } from '@/lib/ucansign/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const folders = await getFolders(userId);
        return NextResponse.json(folders);
    } catch (error: any) {
        console.error('Folders Fetch Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch folders' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { userId, name } = await request.json();

        if (!userId || !name) {
            return NextResponse.json({ error: 'User ID and Name are required' }, { status: 400 });
        }

        const newFolder = await createFolder(userId, name);
        return NextResponse.json(newFolder);
    } catch (error: any) {
        console.error('Folder Create Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create folder' }, { status: 500 });
    }
}
