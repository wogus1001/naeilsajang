// @ts-nocheck
import { NextResponse } from 'next/server';
import { getTemplate } from '@/lib/ucansign/client';

export async function GET(
    request: Request,
    context: any
) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // In Next.js 15+, params is a Promise. We must await it.
        const { id } = await context.params;
        console.log(`Fetching template details for ID: ${id}, UserId: ${userId}`);

        if (!id) {
            return NextResponse.json({ error: 'Template ID is missing' }, { status: 400 });
        }

        const template = await getTemplate(userId, id);
        return NextResponse.json(template || {});
    } catch (error: any) {
        console.error('Template Detail API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch template details' }, { status: 500 });
    }
}
