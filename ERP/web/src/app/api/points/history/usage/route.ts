import { NextResponse } from 'next/server';
import { getPointUsageHistory } from '@/lib/ucansign/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const history = await getPointUsageHistory(userId);
        return NextResponse.json(history);
    } catch (error: any) {
        console.error('Points Usage History Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch usage history' }, { status: 500 });
    }
}
