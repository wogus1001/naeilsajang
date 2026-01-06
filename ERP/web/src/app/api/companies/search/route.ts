import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawQuery = searchParams.get('query');

        if (!rawQuery || rawQuery.length < 1) {
            return NextResponse.json({ data: [] });
        }

        const supabaseAdmin = await getSupabaseAdmin();

        // Prepare search terms
        const nfcQuery = rawQuery.trim().normalize('NFC');
        const nfdQuery = rawQuery.trim().normalize('NFD');

        console.log(`[Search] Raw: "${rawQuery}", NFC: "${nfcQuery}", NFD: "${nfdQuery}"`);

        // We will perform parallel searches to be sure we catch everything
        // 1. NFC Search
        const searchNFC = supabaseAdmin
            .from('companies')
            .select('id, name, created_at, manager_id')
            .ilike('name', `%${nfcQuery}%`)
            .order('created_at', { ascending: false })
            .limit(10);

        // 2. NFD Search (Only if different)
        let searchNFD = Promise.resolve({ data: [], error: null });
        if (nfcQuery !== nfdQuery) {
            searchNFD = supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${nfdQuery}%`)
                .order('created_at', { ascending: false })
                .limit(10) as any;
        }

        // 3. Raw Search (Only if different from both)
        let searchRaw = Promise.resolve({ data: [], error: null });
        if (rawQuery !== nfcQuery && rawQuery !== nfdQuery) {
            searchRaw = supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${rawQuery}%`)
                .order('created_at', { ascending: false })
                .limit(10) as any;
        }

        const [resNFC, resNFD, resRaw] = await Promise.all([searchNFC, searchNFD, searchRaw]);

        if (resNFC.error) console.error('NFC Search Error:', resNFC.error);
        if (resNFD.error) console.error('NFD Search Error:', resNFD.error);

        // Combine and deduplicate
        const allResults = [
            ...(resNFC.data || []),
            ...(resNFD.data || []),
            ...(resRaw.data || [])
        ];

        // Also search for "name without spaces" if nothing found but we have suspicious candidates
        if (allResults.length === 0 && rawQuery.length > 2) {
            // Fallback: search for first 2-3 characters to catch weird variations
            const firstPart = rawQuery.substring(0, 3);
            const { data: fallbackData } = await supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${firstPart}%`)
                .limit(20);

            if (fallbackData) {
                allResults.push(...fallbackData);
            }
        }

        const seenIds = new Set();
        const uniqueCompanies = [];

        const cleanRawQuery = nfcQuery.replace(/\s+/g, '');

        for (const company of allResults) {
            if (!seenIds.has(company.id)) {

                // If we performed a fallback search, check if it's actually relevant
                const cleanName = company.name.replace(/\s+/g, '').normalize('NFC');
                if (cleanName.includes(cleanRawQuery) || cleanRawQuery.includes(cleanName)) {
                    seenIds.add(company.id);
                    uniqueCompanies.push(company);
                }
            }
        }

        // Fetch manager names
        const enhancedCompanies = await Promise.all(uniqueCompanies.map(async (company) => {
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

        console.log(`[Search] Found ${enhancedCompanies.length} matches.`);

        return NextResponse.json({ data: enhancedCompanies });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
