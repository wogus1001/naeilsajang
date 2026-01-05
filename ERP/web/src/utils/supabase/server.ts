import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const createClient = async () => {
    const headersList = await headers();
    const authorization = headersList.get('Authorization');

    // Create a Supabase client with the ANON key
    // We forward the Authorization header so that Supabase identifies the user
    const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: authorization ? { Authorization: authorization } : {},
            },
        }
    );

    return supabase;
};
