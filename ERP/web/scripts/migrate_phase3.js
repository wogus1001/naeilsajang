const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function migratePhase3() {
    console.log('🚀 Starting Phase 3 Migration (Properties, Customers, Contracts)...');

    // 1. Build Lookup Maps
    console.log('🔍 Fetching Companies and Profiles...');
    const { data: companies } = await supabase.from('companies').select('id, name');
    const companyMap = {};
    let defaultCompanyId = null;
    companies?.forEach((c, idx) => {
        companyMap[c.name] = c.id;
        if (c.name === '내일' || idx === 0) defaultCompanyId = c.id;
    });

    const { data: profiles } = await supabase.from('profiles').select('id, email, company_id');
    const userMap = {};
    const userCompanyMap = {};
    profiles?.forEach(p => {
        const legacyId = p.email.split('@')[0];
        userMap[legacyId] = p.id;
        userCompanyMap[legacyId] = p.company_id;
        if (p.email.startsWith('admin')) {
            userMap['admin'] = p.id;
            userCompanyMap['admin'] = p.company_id;
        }
    });

    // Clean Slate (Optional: truncate tables to avoid PK conflict on re-run)
    // await supabase.rpc('truncate_phase3_tables'); // Need RPC for truncation due to FKs?
    // For now we rely on explicit user instruction or just catch PK error.
    // Actually, let's delete all rows from these tables for a clean dry run.
    console.log('🧹 Cleaning existing data...');
    await supabase.from('contracts').delete().neq('id', '0');
    await supabase.from('customers').delete().neq('id', '0');
    await supabase.from('properties').delete().neq('id', '0');

    // Helper to separate core fields from data payload
    const splitData = (obj, coreKeys) => {
        const core = {};
        const data = { ...obj };
        coreKeys.forEach(k => {
            core[k] = obj[k];
            delete data[k];
        });
        return { core, data };
    };

    // 2. Migrate Properties
    try {
        const pPath = path.join(__dirname, '../src/data/properties.json');
        if (fs.existsSync(pPath)) {
            const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
            console.log(`found ${pData.length} properties.`);

            for (const p of pData) {
                // Resolve refs
                let compId = companyMap[p.companyName];

                // Fallback: Infer from manager
                if (!compId && p.managerId) {
                    compId = userCompanyMap[p.managerId];
                }
                // Fallback: Default
                if (!compId) compId = defaultCompanyId;

                const mgrId = userMap[p.managerId];

                // Core fields for columns
                // Schema: id, company_id, manager_id, name, status, operation_type, address, is_favorite, created_at, updated_at
                const { data: payload } = splitData(p, ['id', 'companyName', 'managerId', 'name', 'status', 'operationType', 'address', 'isFavorite', 'createdAt', 'updatedAt']);

                await supabase.from('properties').insert({
                    id: p.id, // Preserve ID
                    company_id: compId,
                    manager_id: mgrId,
                    name: p.name,
                    status: p.status,
                    operation_type: p.operationType, // camelCase in JSON -> snake_case col
                    address: p.address,
                    is_favorite: p.isFavorite || false,
                    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
                    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
                    data: payload // Remaining fields
                });
            }
            console.log('✅ Properties migrated.');
        }
    } catch (e) { console.error('Property migration failed:', e.message); }

    // 3. Migrate Customers
    try {
        const cPath = path.join(__dirname, '../src/data/customers.json');
        if (fs.existsSync(cPath)) {
            const cData = JSON.parse(fs.readFileSync(cPath, 'utf8'));
            console.log(`found ${cData.length} customers.`);

            for (const c of cData) {
                const compId = companyMap[c.companyName];
                const mgrId = userMap[c.managerId];

                if (!compId) continue;

                // Schema: id, company_id, manager_id, name, grade, mobile, is_favorite...
                const { data: payload } = splitData(c, ['id', 'companyName', 'managerId', 'name', 'grade', 'mobile', 'isFavorite', 'createdAt', 'updatedAt']);

                await supabase.from('customers').insert({
                    id: c.id,
                    company_id: compId,
                    manager_id: mgrId,
                    name: c.name,
                    grade: c.grade,
                    mobile: c.mobile,
                    is_favorite: c.isFavorite || false,
                    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
                    updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
                    data: payload
                });
            }
            console.log('✅ Customers migrated.');
        }
    } catch (e) { console.error('Customer migration failed:', e.message); }

    // 4. Migrate Contracts
    try {
        const kPath = path.join(__dirname, '../src/data/contracts.json');
        if (fs.existsSync(kPath)) {
            const kData = JSON.parse(fs.readFileSync(kPath, 'utf8'));
            console.log(`found ${kData.length} contracts.`);

            for (const k of kData) {
                // contracts.json often lacks companyName, need to infer or use default if missing?
                // Wait, contracts usually belong to a user.
                // If companyName is missing, try to find user's company using userMap -> profiles -> company.

                let compId = null;
                const userId = userMap[k.userId]; // "admin", "test1"

                if (userId) {
                    // We need to know this user's company. Ideally query it. 
                    // For now, let's fetch profile-company map efficiently or just query one by one if few.
                    // Let's do a quick lookup on the fly for simplicity or build map earlier.
                    // We'll trust the userMap for ID, but we need compId for RLS.
                    // The `userMap` only has ID.
                    // Let's fetch profiles with company_id earlier? See step 1.
                    // Re-fetch profiles with company_id to be sure.
                } else {
                    console.warn(`Contract ${k.name} has unknown userId ${k.userId}`);
                    // Fallback?
                }

                // Let's refetch profiles fully for this loop
                const { data: profilesFull } = await supabase.from('profiles').select('id, company_id, email');
                const userToCompanyMap = {};
                profilesFull.forEach(p => {
                    const legacyId = p.email.split('@')[0];
                    userToCompanyMap[legacyId] = p.company_id;
                    if (p.email.startsWith('admin')) userToCompanyMap['admin'] = p.company_id;
                });

                compId = userToCompanyMap[k.userId];
                if (!compId && k.companyName) compId = companyMap[k.companyName];

                if (!compId) {
                    console.warn(`Skipping contract ${k.id} - no company found.`);
                    continue;
                }

                // Schema: id, company_id, user_id, property_id, name, status...
                const { data: payload } = splitData(k, ['id', 'userId', 'propertyId', 'name', 'status', 'createdAt']);

                await supabase.from('contracts').insert({
                    id: k.id,
                    company_id: compId,
                    user_id: userMap[k.userId],
                    property_id: k.propertyId, // Can be null
                    name: k.name,
                    status: k.status,
                    created_at: k.createdAt ? new Date(k.createdAt).toISOString() : new Date().toISOString(),
                    data: payload
                });
            }
            console.log('✅ Contracts migrated.');
        }
    } catch (e) { console.error('Contract migration failed:', e.message); console.error(e) }

    console.log('🎉 Phase 3 Complete!');
}

migratePhase3();
