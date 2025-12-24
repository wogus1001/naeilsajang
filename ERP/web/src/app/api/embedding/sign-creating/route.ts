import { NextResponse } from 'next/server';
import { createSignEmbedding } from '@/lib/ucansign/client';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, ...data } = body;

        if (!userId || !data.redirectUrl) {
            return NextResponse.json({ error: 'User ID and Redirect URL are required' }, { status: 400 });
        }

        console.log('[API] Sign Embedding Params:', { userId, ...data });
        const result = await createSignEmbedding(userId, data);
        console.log('[API] Sign Embedding Response:', JSON.stringify(result, null, 2));

        // Response format from UCanSign: { msg: "success", result: { url, expiration }, code: 0 }
        // Check for common variations if 'result' is missing
        if (result && (result.result || result.url)) {
            // Sometimes result is direct, sometimes nested.
            return NextResponse.json(result.result || result);
        } else {
            return NextResponse.json({ error: 'Failed to create embedding link', details: result }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Sign Embedding Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create embedding' }, { status: 500 });
    }
}
