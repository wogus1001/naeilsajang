import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyId = searchParams.get('companyId');
        const type = searchParams.get('type') || 'industry_detail';

        if (!companyId) {
            return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('custom_categories')
            .select('*')
            .eq('company_id', companyId)
            .eq('category_type', type);

        if (error) throw error;

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Categories GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyId, categoryType, parentCategory, subCategory, name, createdBy } = body;

        if (!companyId || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('custom_categories')
            .insert({
                company_id: companyId,
                category_type: categoryType || 'industry_detail',
                parent_category: parentCategory,
                sub_category: subCategory,
                name: name.trim(),
                created_by: createdBy
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Categories POST error:', error);
        return NextResponse.json({ error: `Failed to create category: ${error.message || JSON.stringify(error)}` }, { status: 500 });
    }
}
