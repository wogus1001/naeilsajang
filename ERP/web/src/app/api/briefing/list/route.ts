import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const property_id = searchParams.get('property_id');

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!property_id) {
            return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
        }

        // Fetch links + sender profile info
        // Supabase join syntax: select(*, profiles(name, email))
        const { data, error } = await supabase
            .from('share_links')
            .select(`
                *,
                profiles:consultant_id (
                    name,
                    email
                )
            `)
            .eq('property_id', property_id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ links: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
