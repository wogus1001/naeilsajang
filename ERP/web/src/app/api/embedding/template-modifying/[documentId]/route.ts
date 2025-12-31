// @ts-nocheck
import { NextResponse } from 'next/server';
import { modifyTemplateEmbedding } from '@/lib/ucansign/client';

export async function POST(
    request: Request,
    context: any
) {
    try {
        const { documentId: paramDocumentId } = await context.params;
        const body = await request.json();
        const { userId, documentId, ...data } = body;

        if (!userId || !documentId || !data.redirectUrl) {
            return NextResponse.json({ error: 'User ID, Document ID, and Redirect URL are required' }, { status: 400 });
        }

        const result = await modifyTemplateEmbedding(userId, documentId, data);

        if (result && result.result) {
            return NextResponse.json(result.result);
        } else {
            return NextResponse.json({ error: 'Failed to create embedding link' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Template Modify Embedding Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create embedding' }, { status: 500 });
    }
}
