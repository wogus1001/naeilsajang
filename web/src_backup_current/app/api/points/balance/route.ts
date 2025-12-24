import { NextResponse } from 'next/server';
import { getPointBalance } from '@/lib/ucansign/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const balance = await getPointBalance(userId);
        return NextResponse.json({ balance });
    } catch (error: any) {
        console.error('Points Balance Fetch Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch points balance' }, { status: 500 });
    }
}
