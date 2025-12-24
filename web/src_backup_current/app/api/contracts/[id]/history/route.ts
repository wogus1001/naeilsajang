import { NextResponse } from 'next/server';
import { getDocumentHistory } from '@/lib/ucansign/client';

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

        const history = await getDocumentHistory(userId, params.id);
        return NextResponse.json(history);
    } catch (error: any) {
        console.error('History Fetch Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
    }
}
