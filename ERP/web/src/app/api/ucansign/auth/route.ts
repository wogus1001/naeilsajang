import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client
// Removed top level

async function resolveUserId(legacyId: string) {
    // If it looks like a UUID, assume it is
    if (legacyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return legacyId;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const email = `${legacyId}@example.com`;
    const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
    if (u) return u.id;

    // Check if it matches 'admin' partial
    if (legacyId === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }

    // Try finding by name if really desperate? No, risk of collision.
    return null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    if (!userIdParam) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Resolve to UUID
    const userId = await resolveUserId(userIdParam);
    if (!userId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clientId = process.env.UCANSIGN_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({
            error: 'Configuration Error',
            message: 'UCANSIGN_CLIENT_ID is not defined in environment variables.'
        }, { status: 500 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/ucansign/callback`;
    const state = Math.random().toString(36).substring(7); // Simple state for now

    // Store UUID in cookie
    const cookieStore = await cookies();
    cookieStore.set('ucansign_pending_user', userId, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 5 // 5 minutes
    });

    const authUrl = `https://app.ucansign.com/user/oauth/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.redirect(authUrl);
}
