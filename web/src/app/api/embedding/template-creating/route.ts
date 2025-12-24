import { NextResponse } from 'next/server';
import { createTemplateEmbedding } from '@/lib/ucansign/client';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, ...data } = body;

        if (!userId || !data.redirectUrl) {
            return NextResponse.json({ error: 'User ID and Redirect URL are required' }, { status: 400 });
        }

        const result = await createTemplateEmbedding(userId, data);

        if (result && result.result) {
            return NextResponse.json(result.result);
        } else {
            return NextResponse.json({ error: 'Failed to create embedding link' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Template Create Embedding Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create embedding' }, { status: 500 });
    }
}
