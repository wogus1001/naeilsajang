import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client
// Service Role Client
// Removed top level

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const cookieStore = await cookies();
    const userId = cookieStore.get('ucansign_pending_user')?.value;

    if (!userId) {
        return NextResponse.json({ error: 'Session expired or invalid user' }, { status: 400 });
    }
    if (!code) {
        return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
    }

    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://app.ucansign.com/openapi/user/oauth/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grantType: 'code',
                code: code,
                clientId: process.env.UCANSIGN_CLIENT_ID,
                clientSecret: process.env.UCANSIGN_CLIENT_SECRET
            })
        });

        const tokenData = await tokenResponse.json();

        // Check for success (support both "Success" and "success")
        if (tokenData.msg?.toLowerCase() !== 'success' || !tokenData.result) {
            console.error('Token Exchange Error:', tokenData);
            return NextResponse.json({ error: `Token exchange failed: ${JSON.stringify(tokenData)}` }, { status: 500 });
        }

        // Save to Supabase Profiles
        const { error } = await supabaseAdmin.from('profiles').update({
            ucansign_access_token: tokenData.result.accessToken,
            ucansign_refresh_token: tokenData.result.refreshToken,
            ucansign_expires_at: Date.now() + (29 * 60 * 1000) // 29 minutes safe buffer
        }).eq('id', userId);

        if (error) {
            console.error('Failed to update Supabase Profile:', error);
            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
        }

        // Clear cookie
        const cookieStore2 = await cookies(); // Use same store
        cookieStore2.delete('ucansign_pending_user');

        // Redirect to Profile page
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/profile?ucansign=connected`);

    } catch (error: any) {
        console.error('OAuth Callback Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
