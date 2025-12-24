import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const clientId = process.env.UCANSIGN_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/ucansign/callback`;
    const state = Math.random().toString(36).substring(7); // Simple state for now

    // Store userId in cookie to know who is linking
    const cookieStore = await cookies();
    cookieStore.set('ucansign_pending_user', userId, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 5 // 5 minutes
    });

    const authUrl = `https://app.ucansign.com/user/oauth/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.redirect(authUrl);
}
