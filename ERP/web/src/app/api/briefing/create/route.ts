import { createClient } from '@/utils/supabase/server';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient(); // Await if createClient is async
        const body = await req.json();
        console.log('[BriefingCreate] Request Body:', body);

        const { property_id, options, expires_in_days, expiresAt: clientExpiresAt } = body;

        const {
            data: { user },
        } = await supabase.auth.getUser();

        console.log('[BriefingCreate] User:', user?.id);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized: No user found' }, { status: 401 });
        }

        // Get user's profile to find company_id
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        console.log('[BriefingCreate] Profile:', profile, 'Error:', profileError);

        if (!profile?.company_id) {
            return NextResponse.json({ error: 'Company not found/User has no company' }, { status: 400 });
        }

        const token = nanoid(10); // 10 chars should be enough for uniqueness

        // Use client-provided expiresAt if available (for precise testing), otherwise calculate from days
        let expires_at = clientExpiresAt;

        if (!expires_at && expires_in_days) {
            expires_at = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString();
        }

        const { data, error } = await supabase
            .from('share_links')
            .insert({
                token,
                property_id,
                consultant_id: user.id,
                company_id: profile.company_id,
                options,
                expires_at,
            })
            .select()
            .single();

        if (error) {
            console.error('[BriefingCreate] Insert Error:', error);
            return NextResponse.json({ error: `DB Insert Failed: ${error.message} (Code: ${error.code})` }, { status: 500 });
        }

        const shareUrl = `${req.nextUrl.origin}/share/${token}`;

        return NextResponse.json({ token, shareUrl, expires_at });
    } catch (e: any) {
        console.error('[BriefingCreate] Unexpected Error:', e);
        return NextResponse.json({ error: `Server Error: ${e.message}` }, { status: 500 });
    }
}
