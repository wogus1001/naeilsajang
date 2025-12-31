const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function migrate() {
    console.log('🚀 Starting migration...');

    // 1. Read JSON Data
    const usersPath = path.join(__dirname, '../src/data/users.json');
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    console.log(`Found ${usersData.length} users in JSON.`);

    // 2. Process Companies & Users
    // We'll group users by companyName to create companies first
    const companies = {}; // name -> uuid

    for (const user of usersData) {
        const companyName = user.companyName || 'Default Company';

        // Create Company if not exists
        if (!companies[companyName]) {
            console.log(`Creating company: ${companyName}...`);
            const { data: company, error } = await supabase
                .from('companies')
                .insert({ name: companyName, status: 'active' })
                .select()
                .single();

            if (error) {
                console.error(`Failed to create company ${companyName}:`, error);
                continue;
            }
            companies[companyName] = company.id;
        }

        // Create User (Auth)
        console.log(`Migrating user: ${user.name} (${user.id})...`);

        // In JSON, 'id' is login ID (e.g. 'test1'). In Supabase, we need email.
        // We'll generate a fake email if not present: test1@naeilsajang.com
        const email = user.email || `${user.id}@example.com`;

        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: 'password1234!', // Temporary password
            email_confirm: true,
            user_metadata: { name: user.name }
        });

        if (authError) {
            console.log(`User creation skipped (might exist): ${authError.message}`);
            // Try to find existing user by email to link profile? 
            // For now, assume fresh start or manual handling.
        } else {
            // Update Profile with Company ID and Role
            // (Profile is auto-created by trigger, we just update it)
            const companyId = companies[companyName];

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    company_id: companyId,
                    role: user.role || 'staff',
                    status: user.status === 'approved' ? 'active' : 'pending'
                })
                .eq('id', authUser.user.id);

            if (profileError) console.error(`Failed to update profile for ${user.name}:`, profileError);
            else console.log(`✅ User migrated: ${user.name} -> ${email}`);
        }
    }

    console.log('🎉 Migration complete!');
}

migrate();
