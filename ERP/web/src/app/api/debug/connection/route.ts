import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dynamicQuery = searchParams.get('q'); // User can provide ?q=내일사장

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const envStatus = {
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
            SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? 'Set (Hidden)' : 'Missing',
        };

        const supabaseAdmin = await getSupabaseAdmin();

        // 1. Fetch recent companies (Check ID and Manager_ID)
        const { data: recentCompanies, error: dbError } = await supabaseAdmin
            .from('companies')
            .select('id, name, created_at, manager_id')
            .order('created_at', { ascending: false })
            .limit(5);

        // 2. Search Diagnostics
        const searchTerms = dynamicQuery ? [dynamicQuery] : ['내일', '내일사장'];
        const searchResults: any = {};

        for (const term of searchTerms) {
            const nfc = term.trim().normalize('NFC');
            const nfd = term.trim().normalize('NFD');

            // Test 1: Simple ILIKE
            const { data: foundSimple, error: simpleError } = await supabaseAdmin
                .from('companies')
                .select('id, name, manager_id')
                .ilike('name', `%${nfc}%`);

            // Test 2: Manager Hydration Simulation
            let hydrationTest = [];
            if (foundSimple) {
                hydrationTest = await Promise.all(foundSimple.map(async (c) => {
                    let mName = 'None';
                    let mError = null;
                    if (c.manager_id) {
                        const { data: p, error: pError } = await supabaseAdmin
                            .from('profiles')
                            .select('name')
                            .eq('id', c.manager_id)
                            .maybeSingle(); // Changed to maybeSingle for safety
                        mName = p ? p.name : 'Not Found';
                        mError = pError;
                    }
                    return { company: c.name, manager_id: c.manager_id, manager_name: mName, error: mError };
                }));
            }

            searchResults[term] = {
                input_codes: term.split('').map(c => c.charCodeAt(0)),
                normalized_nfc: nfc.split('').map(c => c.charCodeAt(0)),
                normalized_nfd: nfd.split('').map(c => c.charCodeAt(0)),
                simple_search_match_count: foundSimple?.length || 0,
                simple_search_error: simpleError,
                matches: foundSimple?.map(c => ({
                    id: c.id,
                    name: c.name,
                    codes: c.name.split('').map((x: string) => x.charCodeAt(0))
                })),
                hydration_test: hydrationTest
            };
        }

        return NextResponse.json({
            environment: envStatus,
            database_connection: dbError ? 'Error' : 'OK',
            recent_companies: recentCompanies,
            search_diagnostics: searchResults
        });

    } catch (error: any) {
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
