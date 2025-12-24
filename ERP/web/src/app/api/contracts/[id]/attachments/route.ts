import { NextResponse } from 'next/server';
import { getAttachments } from '@/lib/ucansign/client';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const attachments = await getAttachments(userId, params.id);
        return NextResponse.json(attachments);
    } catch (error: any) {
        console.error('Attachments Fetch Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch attachments' }, { status: 500 });
    }
}
