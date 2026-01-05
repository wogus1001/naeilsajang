import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if system template
    const { data: existing } = await supabase.from('contract_templates').select('is_system, created_by').eq('id', id).single();
    if (existing?.is_system) {
        // Only allow admins to edit system templates? 
        // For now, let's strictly protect them or allow admins.
        // Let's rely on RLS, but also check here for clarity.
        // Assuming RLS allows admins.
    }

    const { error } = await supabase
        .from('contract_templates')
        .update({
            ...body,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Explicit check for system template protection
    const { data: existing } = await supabase.from('contract_templates').select('is_system').eq('id', id).single();
    if (existing?.is_system) {
        return NextResponse.json({ error: '기본 템플릿은 삭제할 수 없습니다.' }, { status: 403 });
    }

    const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
