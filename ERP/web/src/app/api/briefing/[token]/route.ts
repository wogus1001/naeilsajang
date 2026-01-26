import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    // Use Service Role to bypass RLS for public access via token
    const supabaseAdmin = createAdminClient();

    const token = params.token;

    // 1. Fetch Link Data
    const { data: link, error: linkError } = await supabaseAdmin
        .from('share_links')
        .select('*')
        .eq('token', token)
        .single();

    if (linkError || !link) {
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    // 2. Check Expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Link expired' }, { status: 410 });
    }

    // 3. Increment View Count (Fire and forget)
    // We prefer to not await this to speed up response, but in lambda it might be killed.
    // Ideally use `waitUntil` but here we just await for safety.
    await supabaseAdmin
        .from('share_links')
        .update({ view_count: link.view_count + 1 })
        .eq('id', link.id);

    // 4. Fetch Property Data
    const { data: property, error: propError } = await supabaseAdmin
        .from('properties')
        .select('*')
        .eq('id', link.property_id)
        .single();

    if (propError || !property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // 5. Fetch Consultant Profile
    const { data: consultant } = await supabaseAdmin
        .from('profiles')
        .select('name, email, mobile') // Removed photo_url for now as schema uncertain
        .eq('id', link.consultant_id)
        .single();


    // 6. Filter & Mask Data based on Options
    const options = link.options || {};
    const { hide_address, show_briefing_price } = options;

    const filteredProperty = {
        ...property,
        address: hide_address ? null : property.address, // Hide exact address
        masked_address: property.address ? maskAddress(property.address) : 'Address Hidden',
        // Example: "Seoul Gangnam-gu Yeoksam-dong" -> "Seoul Gangnam-gu"

        // Price logic
        price: show_briefing_price ? property.data?.briefing_price : property.data?.price,

        // Remove sensitive contacts
        data: {
            ...property.data,
            owner_contact: undefined,
            tenant_contact: undefined,
            earnings: undefined, // Hide raw earnings if not intended
        }
    };

    return NextResponse.json({
        property: filteredProperty,
        consultant,
        options
    });
}

function maskAddress(fullAddress: string) {
    // Simple masking: returns only first 2-3 parts
    const parts = fullAddress.split(' ');
    if (parts.length > 2) {
        return parts.slice(0, 2).join(' ') + ' ***';
    }
    return fullAddress;
}
