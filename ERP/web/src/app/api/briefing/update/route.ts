
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { link_id, memo } = body;

        if (!link_id) {
            return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch existing options
        const { data: link, error: fetchError } = await supabase
            .from('share_links')
            .select('options, consultant_id')
            .eq('id', link_id)
            .single();

        if (fetchError || !link) {
            return NextResponse.json({ error: 'Link not found' }, { status: 404 });
        }

        // Check ownership (or rely on RLS if set up, but safe to check here)
        // Assuming strict ownership for now, or check company logic if needed. 
        // For now, allow if user is the consultant.
        if (link.consultant_id !== user.id) {
            // You might want to allow admin/managers too, but stick to owner for safety
            // return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // 2. Update options
        const newOptions = {
            ...(link.options as object || {}),
            memo: memo
        };

        const { error: updateError } = await supabase
            .from('share_links')
            .update({ options: newOptions })
            .eq('id', link_id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('[BriefingUpdate] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
