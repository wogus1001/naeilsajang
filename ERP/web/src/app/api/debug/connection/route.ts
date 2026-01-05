import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const envStatus = {
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
            SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? 'Set (Hidden)' : 'Missing',
            UrlMatches: supabaseUrl?.includes('sozlr') ? 'Likely Production/Staging' : 'Unknown', // hypothetical check
        };

        const supabaseAdmin = await getSupabaseAdmin();

        // 1. Fetch recent companies
        const { data: recentCompanies, error: dbError } = await supabaseAdmin
            .from('companies')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        // 2. Search for "내일" specifically
        const searchTerms = ['내일', '내일사장'];
        const searchResults: any = {};

        for (const term of searchTerms) {
            const nfc = term.normalize('NFC');
            const nfd = term.normalize('NFD');

            const { data: foundNFC } = await supabaseAdmin
                .from('companies')
                .select('id, name')
                .ilike('name', `%${nfc}%`);

            searchResults[term] = {
                nfc_term_codes: nfc.split('').map(c => c.charCodeAt(0)),
                found_nfc: foundNFC?.length || 0,
                matches: foundNFC?.map(c => ({
                    name: c.name,
                    codes: c.name.split('').map((x: string) => x.charCodeAt(0))
                }))
            };
        }

        return NextResponse.json({
            environment: envStatus,
            database_connection: dbError ? 'Error' : 'OK',
            db_error: dbError,
            recent_companies: recentCompanies?.map(c => ({
                ...c,
                name_codes: c.name.split('').map((x: string) => x.charCodeAt(0))
            })),
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
