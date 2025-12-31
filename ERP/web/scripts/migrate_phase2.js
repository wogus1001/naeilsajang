const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function migratePhase2() {
    console.log('🚀 Starting Phase 2 Migration (Memos & Notices)...');

    // 1. Build Lookup Maps (Legacy -> UUID)
    console.log('🔍 Fetching Companies and Profiles...');

    const { data: companies } = await supabase.from('companies').select('id, name');
    const companyMap = {}; // "Coy Name" -> UUID
    companies?.forEach(c => companyMap[c.name] = c.id);

    // For users, we need to map legacy login ID (e.g. 'test1') to Supabase UUID.
    // We can use the 'email' trick: 'test1@example.com'. Or query profiles if we stored legacy ID?
    // Our prev migration didn't store legacy ID explicitly in profiles, but we can infer from email prefix.
    const { data: profiles } = await supabase.from('profiles').select('id, email');
    const userMap = {}; // "test1" -> UUID
    profiles?.forEach(p => {
        // email: "test1@example.com" -> id: "test1"
        const legacyId = p.email.split('@')[0];
        userMap[legacyId] = p.id;
        // Also map 'admin' explicitly just in case
        if (p.email.startsWith('admin')) userMap['admin'] = p.id;
    });

    // 2. Migrate Memos
    try {
        const memosPath = path.join(__dirname, '../src/data/memos.json');
        if (fs.existsSync(memosPath)) {
            const memosData = JSON.parse(fs.readFileSync(memosPath, 'utf8'));
            console.log(`found ${memosData.length} memos.`);

            for (const m of memosData) {
                // m: { userId: 'test1', content: '...', lastUpdated: '...' }
                const uuid = userMap[m.userId];
                if (!uuid) {
                    console.warn(`Skipping memo for unknown user: ${m.userId}`);
                    continue;
                }

                await supabase.from('memos').insert({
                    user_id: uuid,
                    content: m.content,
                    updated_at: m.lastUpdated ? new Date(m.lastUpdated).toISOString() : new Date().toISOString()
                });
            }
            console.log('✅ Memos migrated.');
        }
    } catch (e) { console.error('Memo migration failed:', e.message); }

    // 3. Migrate Notices
    try {
        const noticesPath = path.join(__dirname, '../src/data/notices.json');
        if (fs.existsSync(noticesPath)) {
            const noticesData = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
            console.log(`found ${noticesData.length} notices.`);

            for (const n of noticesData) {
                // n: { type: 'system', companyName: '...', title: '...', ... }
                let companyId = null;
                if (n.type !== 'system' && n.companyName) {
                    companyId = companyMap[n.companyName];
                }

                // Try to map author
                const authorUuid = userMap[n.authorId] || null;

                await supabase.from('notices').insert({
                    company_id: companyId,
                    title: n.title,
                    content: n.content,
                    type: n.type || 'team',
                    author_id: authorUuid,
                    is_pinned: n.isPinned || false,
                    views: n.views || 0,
                    created_at: n.createdAt ? new Date(n.createdAt.replace(/\./g, '-')).toISOString() : new Date().toISOString()
                });
            }
            console.log('✅ Notices migrated.');
        }
    } catch (e) { console.error('Notice migration failed:', e.message); }

    console.log('🎉 Phase 2 Complete!');
}

migratePhase2();
