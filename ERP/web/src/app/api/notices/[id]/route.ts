// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;

        // Fetch notice with author info
        const { data: notice, error } = await supabaseAdmin
            .from('notices')
            .select(`
                *,
                author:profiles!author_id(name, role)
            `)
            .eq('id', id)
            .single();

        if (error || !notice) {
            return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
        }

        // Increment views (Non-blocking or simple await)
        await supabaseAdmin.from('notices').update({ views: (notice.views || 0) + 1 }).eq('id', id);

        // Transform
        const formatted = {
            ...notice,
            createdAt: new Date(notice.created_at).toLocaleDateString().replace(/-/g, '.'),
            authorName: notice.author?.name || '관리자',
            authorRole: notice.author?.role || 'admin',
            isPinned: notice.is_pinned
        };

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Fetch notice detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;

        const { error } = await supabaseAdmin.from('notices').delete().eq('id', id);

        if (error) {
            console.error('Delete error', error);
            return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request, context: any) {
    try {
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        const { title, content, type, isPinned } = body;

        const updates: any = {};
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (type !== undefined) updates.type = type;
        if (isPinned !== undefined) updates.is_pinned = isPinned;

        if (Object.keys(updates).length > 0) {
            const { error } = await supabaseAdmin
                .from('notices')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        }

        // Return updated object
        const { data: updated } = await supabaseAdmin.from('notices').select('*').eq('id', id).single();

        return NextResponse.json({
            ...updated,
            isPinned: updated?.is_pinned // backward compat
        });
    } catch (error) {
        console.error('Update notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
