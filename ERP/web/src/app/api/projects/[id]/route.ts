
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const supabase = await createClient();
        const { id } = params;

        const { data: project, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return NextResponse.json(project);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const supabase = await createClient();
        const { id } = params;
        const body = await request.json();

        // Extract fields to update
        const { title, status, category, participants, data } = body;

        const updates: any = { updated_at: new Date().toISOString() };
        if (title !== undefined) updates.title = title;
        if (status !== undefined) updates.status = status;
        if (category !== undefined) updates.category = category;
        if (participants !== undefined) updates.participants = participants;
        if (data !== undefined) updates.data = data;

        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const supabase = await createClient();
        const { id } = params;

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
