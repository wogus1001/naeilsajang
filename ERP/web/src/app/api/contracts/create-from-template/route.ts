import { NextResponse } from 'next/server';
import { createContractFromTemplate } from '@/lib/ucansign/client';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, templateId, ...data } = body;

        if (!userId || !templateId) {
            return NextResponse.json({ error: 'User ID and Template ID are required' }, { status: 400 });
        }

        const result = await createContractFromTemplate(userId, templateId, data);

        // Response format check
        if (result && result.code === 0) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ error: result?.msg || 'Failed to create contract' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Contract Creation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create contract' }, { status: 500 });
    }
}
