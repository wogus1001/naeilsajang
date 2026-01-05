import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');

        if (!query || query.length < 1) {
            return NextResponse.json({ data: [] });
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // Search for companies containing the query string (case-insensitive)
        // using 'ilike' filter
        const { data: companies, error } = await supabaseAdmin
            .from('companies')
            .select(`
                id,
                name,
                created_at,
                manager_id
            `)
            .ilike('name', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(10); // Limit results for performance

        if (error) {
            console.error('Search company error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch manager names for these companies
        // We do this manually or via join if relation exists. 
        // For simplicity and safety against RLS/relations, let's just return the company info first.
        // If we want manager name, we can fetch profiles.

        // Let's enhance the data with manager name if needed.
        const enhancedCompanies = await Promise.all(companies.map(async (company) => {
            let managerName = '없음';
            if (company.manager_id) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name')
                    .eq('id', company.manager_id)
                    .single();
                if (profile) {
                    managerName = profile.name;
                }
            }
            return {
                ...company,
                manager_name: managerName
            };
        }));

        return NextResponse.json({ data: enhancedCompanies });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
