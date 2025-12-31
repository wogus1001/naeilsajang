import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase Admin client
// This prevents build-time crashes if environment variables are missing
export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        // Return a dummy client or throw a clearer error
        // During build time, Next.js might evaluate this file. 
        // We should throw only if actually used, or return null?
        // Throwing here is better to catch runtime config errors, 
        // but for build safety, we check inside the function call.
        throw new Error('Supabase URL or Service Role Key is missing in environment variables.');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
