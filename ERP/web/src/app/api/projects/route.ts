import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Helper to resolve ID (Match legacy @example.com)
async function resolveUserId(id: string) {
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return id;

    const supabaseAdmin = getSupabaseAdmin();
    // Try email as is if it has @
    const targetEmail = id.includes('@') ? id : `${id}@example.com`;
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', targetEmail).single();
    if (data) return data.id;

    if (id === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

export async function GET(request: Request) {
    try {
        const supabase = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
        }

        const resolvedUserId = await resolveUserId(userIdParam);
        if (!resolvedUserId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch user's profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, id')
            .eq('id', resolvedUserId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        let query = supabase.from('projects').select('*');

        // Filter: My Company OR Created By Me (exactly like RLS)
        if (profile.company_id) {
            query = query.or(`company_id.eq.${profile.company_id},created_by.eq.${profile.id}`);
        } else {
            query = query.eq('created_by', profile.id);
        }

        const { data: projects, error } = await query.order('updated_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch projects:', error);
            throw error;
        }

        return NextResponse.json({ success: true, data: projects });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        const body = await request.json();
        const { id, title, status, category, participants, data } = body;

        // Use userId from query or body
        const targetUserId = userIdParam || body.userId;
        if (!targetUserId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
        }

        const resolvedUserId = await resolveUserId(targetUserId);
        if (!resolvedUserId) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // Ensure we have a valid UUID for the project id
        let projectId = id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!projectId || !uuidRegex.test(projectId)) {
            projectId = crypto.randomUUID();
            console.log(`Generated new UUID for project: ${projectId} (received: ${id})`);
        }

        // Get user company
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', resolvedUserId)
            .single();

        const { data: project, error } = await supabase
            .from('projects')
            .insert({
                id: projectId,
                title,
                status,
                category,
                participants,
                data,
                company_id: profile?.company_id,
                created_by: resolvedUserId
            })
            .select()
            .single();

        if (error) {
            console.error('Database insert error for project:', error);
            throw error;
        }

        return NextResponse.json({ success: true, project });

    } catch (error: any) {
        console.error('Project create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
