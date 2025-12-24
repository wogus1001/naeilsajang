import { NextResponse } from 'next/server';
import { getTemplates } from '@/lib/ucansign/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const templates = await getTemplates(userId);
        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Template API Error:', error);
        if (error.message.includes('User is not connected')) {
            return NextResponse.json({ error: '유캔싸인 연동이 필요합니다.', code: 'NEED_AUTH' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}
