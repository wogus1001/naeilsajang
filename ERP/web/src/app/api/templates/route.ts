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

    return NextResponse.json(templates);
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

    const { data, error } = await supabase
        .from('contract_templates')
        .insert({
            ...body,
            id: body.id || `t-${Date.now()}`, // Generate ID if not provided (e.g. from local migration)
            created_by: user.id
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
