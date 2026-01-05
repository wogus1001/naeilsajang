
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugCompany() {
    console.log('--- Debugging Company Name ---');

    // 1. Fetch all companies starting with "내일"
    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', '%내일%');

    if (error) {
        console.error('Error fetching companies:', error);
        return;
    }

    console.log(`Found ${companies?.length} companies.`);

    for (const company of companies || []) {
        const name = company.name;
        console.log(`\nID: ${company.id}`);
        console.log(`Name: "${name}"`);
        console.log(`Length: ${name.length}`);

        // Print Char Codes
        const codes = [];
        for (let i = 0; i < name.length; i++) {
            codes.push(name.charCodeAt(i));
        }
        console.log(`CharCodes: ${JSON.stringify(codes)}`);

        // Check normalization
        const nfc = name.normalize('NFC');
        const nfd = name.normalize('NFD');
        console.log(`Is NFC? ${name === nfc}`);
        console.log(`Is NFD? ${name === nfd}`);

        if (name !== nfc) {
            console.log('WARNING: Name is NOT NFC normalized!');
            console.log(`NFC Version: "${nfc}"`);
            const nfcCodes = [];
            for (let i = 0; i < nfc.length; i++) nfcCodes.push(nfc.charCodeAt(i));
            console.log(`NFC Codes: ${JSON.stringify(nfcCodes)}`);
        }
    }

    // 2. Test Search Logic locally (NFC)
    const searchTerm = '내일사장';
    const normalizedTerm = searchTerm.normalize('NFC');
    console.log(`\n\n--- Testing Search Logic with term "${normalizedTerm}" (NFC) ---`);
    console.log(`Term CharCodes: ${JSON.stringify(normalizedTerm.split('').map(c => c.charCodeAt(0)))}`);

    const { data: searchResults, error: searchError } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${normalizedTerm}%`);

    if (searchError) console.error('Search error:', searchError);
    console.log(`Search Results (NFC): ${searchResults?.length} matches`);
    if (searchResults && searchResults.length > 0) {
        console.log('Found with NFC:', searchResults);
    }

    // 3. Test Search Logic with NFD
    const nfdTerm = searchTerm.normalize('NFD');
    console.log(`\n\n--- Testing Search Logic with term "${nfdTerm}" (NFD) ---`);
    // Print bytes/codes
    const nfdCodes = [];
    for (let i = 0; i < nfdTerm.length; i++) nfdCodes.push(nfdTerm.charCodeAt(i));
    console.log(`Term CharCodes (NFD): ${JSON.stringify(nfdCodes)}`);

    const { data: nfdResults, error: nfdError } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${nfdTerm}%`);

    if (nfdError) console.error('Search error:', nfdError);
    console.log(`Search Results (NFD): ${nfdResults?.length} matches`);
    if (nfdResults && nfdResults.length > 0) {
        console.log('Found with NFD:', nfdResults);

        // Check finding
        const found = nfdResults[0];
        console.log('Stored Name CharCodes:', JSON.stringify(found.name.split('').map((c: string) => c.charCodeAt(0))));
    }
}

debugCompany();
