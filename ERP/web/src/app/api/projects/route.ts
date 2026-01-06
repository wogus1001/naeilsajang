
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user's company and profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, id')
            .eq('id', session.user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        let query = supabase.from('projects').select('*');

        // Filter: My Company OR Created By Me (if no company)
        if (profile.company_id) {
            query = query.eq('company_id', profile.company_id);
        } else {
            query = query.eq('created_by', profile.id);
        }

        const { data: projects, error } = await query.order('updated_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch projects:', error);
            throw error;
        }

        return NextResponse.json({ projects });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, title, status, category, participants, data } = body;

        // Get user company
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', session.user.id)
            .single();

        const { data: project, error } = await supabase
            .from('projects')
            .insert({
                id,
                title,
                status,
                category,
                participants,
                data,
                company_id: profile?.company_id,
                created_by: session.user.id
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, project });

    } catch (error: any) {
        console.error('Project create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
