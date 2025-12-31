const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const schedulesPath = path.join(__dirname, '../src/data/schedules.json');

async function migrate() {
    console.log('Starting Schedules Migration (Phase 4)...');

    if (!fs.existsSync(schedulesPath)) {
        console.error('schedules.json not found!');
        return;
    }

    const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));
    console.log(`Found ${schedules.length} schedules to migrate.`);

    // Helper to resolve company
    const companyCache = {};
    async function getCompanyId(name) {
        if (!name) return null; // Default to null if no company (e.g. system?)
        if (companyCache[name]) return companyCache[name];

        let { data, error } = await supabase.from('companies').select('id').eq('name', name).single();
        if (!data && name === '내일') {
            // Fallback for '내일' -> '내일사장' if renamed, or check again
            // Assuming exact match or manual fix. 
            // Logic in migrate_phase1 created '내일사장'.
            // If source has '내일', mapping needed?
            // Let's check company list if fail.
            const { data: c2 } = await supabase.from('companies').select('id').like('name', '내일%').limit(1).single();
            if (c2) data = c2;
        }

        if (data) {
            companyCache[name] = data.id;
            return data.id;
        }
        return null;
    }

    // Helper to resolve user
    const userCache = {};
    async function getUserId(legacyId) {
        if (!legacyId) return null;
        if (userCache[legacyId]) return userCache[legacyId];

        const email = `${legacyId}@example.com`; // Convention used in Phase 1
        let { data } = await supabase.from('profiles').select('id').eq('email', email).single();

        // Fallback for admin
        if (!data && legacyId === 'admin') {
            const { data: admin } = await supabase.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
            if (admin) data = admin;
        }

        if (data) {
            userCache[legacyId] = data.id;
            return data.id;
        }
        return null;
    }

    let successCount = 0;
    let failCount = 0;

    // Default Company for orphans?
    // If schedule has no company, it might be legacy or broken.
    // We try to find '내일사장' as default if missing.
    const { data: defaultCompany } = await supabase.from('companies').select('id').order('created_at').limit(1).single();
    if (!defaultCompany) {
        console.error('No companies found in DB to attach orphans to.');
    }

    for (const schedule of schedules) {
        try {
            const companyName = schedule.companyName || '내일사장'; // Default logic
            let companyId = await getCompanyId(companyName);
            if (!companyId && defaultCompany) companyId = defaultCompany.id;

            if (!companyId) {
                console.log(`Skipping schedule ${schedule.id}: No company found for ${companyName}`);
                failCount++;
                continue;
            }

            const userId = await getUserId(schedule.userId);

            const { error } = await supabase.from('schedules').upsert({
                id: schedule.id, // Keep legacy ID (timestamp)
                company_id: companyId,
                user_id: userId, // Can be null if preserved as system/legacy
                customer_id: schedule.customerId || null,
                property_id: schedule.propertyId || null,
                business_card_id: schedule.businessCardId || null,

                title: schedule.title,
                date: schedule.date, // Check format YYYY-MM-DD
                scope: schedule.scope || 'public',
                status: schedule.status || 'schedule',
                type: schedule.type || 'schedule',
                color: schedule.color,
                details: schedule.details,
                created_at: schedule.createdAt || new Date().toISOString()
            });

            if (error) {
                console.error(`Failed to insert ${schedule.id}:`, error.message);
                failCount++;
            } else {
                successCount++;
            }

            if (successCount % 50 === 0) process.stdout.write('.');

        } catch (e) {
            console.error(`Error processing ${schedule.id}:`, e.message);
            failCount++;
        }
    }

    console.log(`\nMigration Phase 4 Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

migrate();
