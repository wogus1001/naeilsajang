import { NextResponse } from 'next/server';
import { renameFolder, deleteFolder } from '@/lib/ucansign/client';

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { userId, name } = await request.json();

        if (!userId || !name) {
            return NextResponse.json({ error: 'User ID and Name are required' }, { status: 400 });
        }

        await renameFolder(userId, params.id, name);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Folder Rename Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to rename folder' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        await deleteFolder(userId, params.id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Folder Delete Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete folder' }, { status: 500 });
    }
}
