import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    // 1. Get current user's company_id
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

    // 2. Fetch templates (System OR Shared Company)
    // Note: RLS policies generally handle this, but explicit query is safer for logic transparency
    let query = supabase
        .from('contract_templates')
        .select('*')
        .or(`is_system.eq.true,company_id.eq.${profile?.company_id},created_by.eq.${user.id}`)
        .order('is_system', { ascending: false }) // System first
        .order('name', { ascending: true });

    const { data: templates, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map snake_case (DB) to camelCase (Frontend)
    const mappedTemplates = templates.map(t => ({
        ...t,
        formSchema: t.form_schema,
        htmlTemplate: t.html_content, // Corrected from html_template
    }));

    return NextResponse.json(mappedTemplates);
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();

    // Basic validation
    if (!body.name || !body.category) {
        return NextResponse.json({ error: 'Name and Category are required' }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Company ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

    // Map camelCase (Frontend) to snake_case (DB)
    const dbData = {
        id: body.id || `t-${Date.now()}`,
        name: body.name,
        category: body.category,
        description: body.description,
        form_schema: body.formSchema || [],
        html_content: body.htmlTemplate || '',
        is_system: body.is_system || false,
        company_id: profile?.company_id, // Company Association
        created_by: user.id
    };

    const { data, error } = await supabase
        .from('contract_templates')
        .insert(dbData)
        .select()
        .single();

    console.log('[DEBUG-SAVE] User:', user.id);
    console.log('[DEBUG-SAVE] Company:', profile?.company_id);
    console.log('[DEBUG-SAVE] Insert Result:', data, 'Error:', error);
    console.log('[DEBUG-SAVE] DB URL Segment:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(8, 20)); // Check which project

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map back for response
    const mappedData = {
        ...data,
        formSchema: data.form_schema,
        htmlTemplate: data.html_content,
    };

    return NextResponse.json(mappedData);
}
