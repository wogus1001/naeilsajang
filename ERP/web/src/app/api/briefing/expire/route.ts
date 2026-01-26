import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { property_id, link_id } = body;

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!property_id && !link_id) {
            return NextResponse.json({ error: 'Property ID or Link ID is required' }, { status: 400 });
        }

        let error;

        if (link_id) {
            // Expire specific link
            const res = await supabase
                .from('share_links')
                .update({ expires_at: new Date().toISOString() })
                .eq('id', link_id);
            error = res.error;
        } else {
            // Expire all for property
            const res = await supabase
                .from('share_links')
                .update({ expires_at: new Date().toISOString() })
                .eq('property_id', property_id);
            error = res.error;
        }

        if (error) {
            console.error('[BriefingExpire] Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'All links expired' });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
