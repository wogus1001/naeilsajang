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

        const debugInfo: any = {
            rawQuery,
            nfcQuery: rawQuery.trim().normalize('NFC'), // Initialize here for debugInfo
            nfdQuery: rawQuery.trim().normalize('NFD'), // Initialize here for debugInfo
            envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, // Verify DB URL
            steps: []
        };

        // Prepare search terms
        const nfcQuery = rawQuery.trim().normalize('NFC');
        const nfdQuery = rawQuery.trim().normalize('NFD');

        console.log(`[Search] Raw: "${rawQuery}", NFC: "${nfcQuery}", NFD: "${nfdQuery}"`);

        // We will perform parallel searches to be sure we catch everything
        // 1. NFC Search
        debugInfo.steps.push('Starting NFC search');
        const searchNFC = supabaseAdmin
            .from('companies')
            .select('id, name, created_at, manager_id')
            .ilike('name', `%${nfcQuery}%`)
            .order('created_at', { ascending: false })
            .limit(10);

        // 2. NFD Search (Only if different)
        let searchNFD = Promise.resolve({ data: [], error: null });
        if (nfcQuery !== nfdQuery) {
            debugInfo.steps.push('Starting NFD search (different from NFC)');
            searchNFD = supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${nfdQuery}%`)
                .order('created_at', { ascending: false })
                .limit(10) as any;
        } else {
            debugInfo.steps.push('NFD search skipped (same as NFC)');
        }

        // 3. Raw Search (Only if different from both)
        let searchRaw = Promise.resolve({ data: [], error: null });
        if (rawQuery !== nfcQuery && rawQuery !== nfdQuery) {
            debugInfo.steps.push('Starting Raw search (different from NFC/NFD)');
            searchRaw = supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${rawQuery}%`)
                .order('created_at', { ascending: false })
                .limit(10) as any;
        } else {
            debugInfo.steps.push('Raw search skipped (same as NFC or NFD)');
        }

        const [resNFC, resNFD, resRaw] = await Promise.all([searchNFC, searchNFD, searchRaw]);

        debugInfo.nfcResultCount = resNFC.data?.length || 0;
        debugInfo.nfdResultCount = resNFD.data?.length || 0;
        debugInfo.rawResultCount = resRaw.data?.length || 0;

        if (resNFC.error) {
            console.error('NFC Search Error:', resNFC.error);
            debugInfo.nfcError = resNFC.error;
        }
        if (resNFD.error) {
            console.error('NFD Search Error:', resNFD.error);
            debugInfo.nfdError = resNFD.error;
        }
        if (resRaw.error) {
            console.error('Raw Search Error:', resRaw.error);
            debugInfo.rawError = resRaw.error;
        }

        // Combine and deduplicate
        const allResults = [
            ...(resNFC.data || []),
            ...(resNFD.data || []),
            ...(resRaw.data || [])
        ];
        debugInfo.initialCombinedResults = allResults.length;

        // Also search for "name without spaces" if nothing found but we have suspicious candidates
        if (allResults.length === 0 && rawQuery.length > 2) {
            debugInfo.steps.push('Performing fallback search');
            // Fallback: search for first 2-3 characters to catch weird variations
            const firstPart = rawQuery.substring(0, 2); // Reduced to 2 chars for simpler matching
            const { data: fallbackData, error: fallbackError } = await supabaseAdmin
                .from('companies')
                .select('id, name, created_at, manager_id')
                .ilike('name', `%${firstPart}%`)
                .limit(20);

            if (fallbackData) {
                debugInfo.fallbackResultCount = fallbackData.length;
                allResults.push(...fallbackData);
            }
            if (fallbackError) {
                debugInfo.fallbackError = fallbackError;
            }
        }

        const seenIds = new Set();
        const uniqueCompanies = [];

        const cleanRawQuery = nfcQuery.replace(/\s+/g, '');
        debugInfo.cleanRawQuery = cleanRawQuery;

        for (const company of allResults) {
            if (!seenIds.has(company.id)) {

                // If we performed a fallback search, check if it's actually relevant
                const cleanName = company.name.replace(/\s+/g, '').normalize('NFC');

                // Accept match if it includes query OR query includes it (fuzzy)
                if (cleanName.includes(cleanRawQuery) || cleanRawQuery.includes(cleanName)) {
                    seenIds.add(company.id);
                    uniqueCompanies.push(company);
                } else {
                    debugInfo.steps.push(`Filtered out: ${company.name} (clean: ${cleanName}) vs query (clean: ${cleanRawQuery})`);
                }
            }
        }
        debugInfo.uniqueCompaniesBeforeManagerFetch = uniqueCompanies.length;

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
        debugInfo.finalResultCount = enhancedCompanies.length;

        return NextResponse.json({
            data: enhancedCompanies,
            debug: debugInfo
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
    }
}
