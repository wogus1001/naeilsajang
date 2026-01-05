import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const supabaseAdmin = await getSupabaseAdmin();
        const email = id.includes('@') ? id : `${id}@example.com`;

        // Check auth users
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

        // This is inefficient for large user base but fine for now. Better to try-catch createUser? NO, that's invasive.
        // Actually, searching by email in profiles is better if triggers work reliably.

        // Let's use listUsers for Auth check (definitive).
        const exists = users.some(u => u.email === email);

        if (exists) {
            return NextResponse.json({ available: false, message: '이미 사용 중인 아이디입니다.' });
        } else {
            return NextResponse.json({ available: true, message: '사용 가능한 아이디입니다.' });
        }
    } catch (error) {
        console.error('Check ID error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
