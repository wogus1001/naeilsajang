import { NextResponse } from 'next/server';
import { getPointChargeHistory } from '@/lib/ucansign/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const history = await getPointChargeHistory(userId);
        return NextResponse.json(history);
    } catch (error: any) {
        console.error('Points Charge History Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch charge history' }, { status: 500 });
    }
}
