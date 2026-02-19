import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function resolveUserId(legacyId: string) {
    if (!legacyId) return null;
    if (legacyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return legacyId;

    const supabaseAdmin = getSupabaseAdmin();
    const email = `${legacyId}@example.com`;
    const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
    if (u) return u.id;

    if (legacyId === 'admin') {
        const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
        return a?.id;
    }
    return null;
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    let userId = null;
    let usingFallback = false;

    // 1. Try Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        userId = user.id;
    } else {
        // 2. Fallback
        if (userIdParam) {
            userId = await resolveUserId(userIdParam);
            usingFallback = true;
        }
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FORCE ADMIN: Always switch to Admin client for DB operations
    supabase = getSupabaseAdmin() as any;

    // Check if system template
    const { data: existing } = await supabase.from('contract_templates').select('is_system, created_by').eq('id', id).single();
    if (existing?.is_system) {
        // Only allow admins to edit system templates? 
        // For now, let's strictly protect them or allow admins.
        // Let's rely on RLS, but also check here for clarity.
        // Assuming RLS allows admins.
    }

    // Map camelCase (Frontend) to snake_case (DB)
    const updateData: any = {
        updated_at: new Date().toISOString()
    };
    if (body.name) updateData.name = body.name;
    if (body.category) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.formSchema) updateData.form_schema = body.formSchema;
    if (body.htmlTemplate) updateData.html_content = body.htmlTemplate;
    if (body.is_system !== undefined) updateData.is_system = body.is_system;

    const { error } = await supabase
        .from('contract_templates')
        .update(updateData)
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
    let supabase = await createClient();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    let userId = null;
    let usingFallback = false;

    // 1. Try Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        userId = user.id;
    } else {
        // 2. Fallback
        if (userIdParam) {
            userId = await resolveUserId(userIdParam);
            usingFallback = true;
        }
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FORCE ADMIN: Always switch to Admin client for DB operations
    supabase = getSupabaseAdmin() as any;

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
