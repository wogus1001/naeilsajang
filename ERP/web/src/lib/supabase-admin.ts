import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase Admin client
// This prevents build-time crashes if environment variables are missing
export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        const missing = [];
        if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
        if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

        const errorMsg = `[SupabaseAdmin] Missing Environment Variables: ${missing.join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
