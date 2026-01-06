import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { data: templates, error } = await supabase
        .from('contract_templates')
        .select('*')
        .order('is_system', { ascending: false }) // System first
        .order('name', { ascending: true });

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

    // Map camelCase (Frontend) to snake_case (DB)
    const dbData = {
        id: body.id || `t-${Date.now()}`,
        name: body.name,
        category: body.category,
        description: body.description,
        form_schema: body.formSchema || [],
        html_content: body.htmlTemplate || '',
        is_system: body.is_system || false,
        created_by: user.id
    };

    const { data, error } = await supabase
        .from('contract_templates')
        .insert(dbData)
        .select()
        .single();

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
