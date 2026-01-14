import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: Request) {
    try {
        const { promotedId, propertyId } = await request.json();

        if (!promotedId || !propertyId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Update the Link in business_card_promoted
        const { error: updateError } = await supabaseAdmin
            .from('business_card_promoted')
            .update({ property_id: propertyId })
            .eq('id', promotedId);

        if (updateError) {
            throw updateError;
        }

        // 2. Sync to Property's promotedCustomers list (Optional / Secondary)
        try {
            // Fetch the Promoted Item & Business Card details
            const { data: promotedItem } = await supabaseAdmin
                .from('business_card_promoted')
                .select('*, business_cards(*)')
                .eq('id', promotedId)
                .single();

            if (promotedItem && promotedItem.business_cards) {
                const card = promotedItem.business_cards;

                // Fetch Property
                const { data: property } = await supabaseAdmin
                    .from('properties')
                    .select('id, promotedCustomers, name')
                    .eq('id', propertyId)
                    .single();

                if (property) {
                    const currentList = property.promotedCustomers || [];
                    const exists = currentList.some((c: any) => c.targetId === card.id);

                    if (!exists) {
                        const newCustomer = {
                            id: new Date().getTime().toString(),
                            date: new Date().toISOString().split('T')[0],
                            name: card.name,
                            type: 'businessCard',
                            classification: card.category || '-',
                            budget: '-',
                            features: card.etc_memo || '-',
                            targetId: card.id,
                            contact: card.mobile || ''
                        };

                        const newList = [...currentList, newCustomer];
                        await supabaseAdmin
                            .from('properties')
                            .update({ promotedCustomers: newList })
                            .eq('id', propertyId);
                    }
                }
            }
        } catch (syncError) {
            console.warn('Sync to property failed, but link was successful:', syncError);
            // Continue to return success strictly for the Link action
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Link error:', error);
        return NextResponse.json({ error: 'Link failed' }, { status: 500 });
    }
}
