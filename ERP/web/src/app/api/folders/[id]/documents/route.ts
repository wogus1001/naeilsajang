// @ts-nocheck
import { NextResponse } from 'next/server';
import { moveDocumentsToFolder } from '@/lib/ucansign/client';

export async function PUT(
    request: Request,
    context: any
) {
    try {
        const { id } = await context.params;
        const { userId, documentIds } = await request.json();
        console.log(`[API] Move to Folder request. FolderId: ${id}, UserId: ${userId}, DocIds:`, documentIds);

        if (!userId || !Array.isArray(documentIds)) {
            console.error('[API] Invalid payload:', { userId, documentIds });
            return NextResponse.json({ error: 'User ID and DocumentIDs array are required' }, { status: 400 });
        }

        await moveDocumentsToFolder(userId, params.id, documentIds);
        console.log('[API] Move success');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Move Documents Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to move documents' }, { status: 500 });
    }
}
