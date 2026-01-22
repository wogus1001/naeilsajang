
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const propertyId = searchParams.get('id');
        const companyId = searchParams.get('companyId'); // Optional scope

        if (!propertyId) {
            return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const promotedList: any[] = [];

        // 1. Fetch from Customers (Where active promoted property matches)
        // We look into `data->promotedProperties` array
        // Note: Supabase JSONB filter needed.
        // `data->promotedProperties` is an array of objects { propertyId: ... }

        let customerQuery = supabaseAdmin
            .from('customers')
            .select('id, name, mobile, data, manager_id');

        if (companyId) customerQuery = customerQuery.eq('company_id', companyId);

        // Fetch potential candidates (Filtering JSON array in PostgREST is tricky for "contains object with field")
        // We'll fetch customers who HAVE promoted properties, then filter in code for safety/speed 
        // given the JSON structure complexity. Or use `cs` (contains) if structure matches.
        // `data->promotedProperties` = [{ "propertyId": "..." }]
        // .contains('data', { promotedProperties: [{ propertyId: propertyId }] }) should work.

        customerQuery = customerQuery.contains('data', { promotedProperties: [{ propertyId: propertyId }] });

        const { data: customers, error: cError } = await customerQuery;
        if (cError) throw cError;

        if (customers) {
            customers.forEach(c => {
                const promotedProps = c.data?.promotedProperties || [];
                const matcheItems = promotedProps.filter((p: any) => p.propertyId === propertyId);

                matcheItems.forEach((p: any) => {
                    promotedList.push({
                        promotedId: p.id || `c-${c.id}`, // specific item ID or fallback
                        id: `cust-${c.id}-${p.id || '0'}`, // unique list key
                        date: p.date,
                        name: c.name,
                        type: 'customer',
                        classification: c.data?.class || c.classification || '-',
                        budget: c.data?.budget || p.amount || '-',
                        features: `[추진] ${p.itemName || c.name}`,
                        targetId: c.id,
                        contact: c.mobile,
                        status: p.status || '',
                        note: p.note || ''
                    });
                });
            });
        }

        // 2. Fetch from Business Cards (Using `business_card_promoted` table)
        let cardQuery = supabaseAdmin
            .from('business_card_promoted')
            .select(`
                id, item_name, amount, date, note, status,
                business_card_id,
                business_cards ( id, name, mobile, company_id, category )
            `)
            .eq('property_id', propertyId);

        if (companyId) {
            // Filter by business card's company? 
            // The `business_cards` join will filter naturally if we enforce it, 
            // but `business_card_promoted` doesn't have company_id.
            // We can rely on the join results or trusted property_id link.
            // Let's assume if it's linked to this property (which is effectively company scoped), it's valid.
        }

        const { data: cardItems, error: bError } = await cardQuery;
        if (bError) throw bError;

        if (cardItems) {
            cardItems.forEach((item: any) => {
                const card = item.business_cards;
                if (!card) return; // Orphaned item?

                // Extra security check if strict company scope required
                if (companyId && card.company_id !== companyId) return;

                promotedList.push({
                    promotedId: item.id,
                    id: `card-${item.id}`,
                    date: item.date,
                    name: card.name,
                    type: 'businessCard',
                    classification: card.category || '-',
                    budget: item.amount || '-',
                    features: `[추진] ${item.item_name}`,
                    targetId: card.id,
                    contact: card.mobile,
                    status: item.status || '',
                    note: item.note || ''
                });
            });
        }

        // Sort by Date Descending
        promotedList.sort((a, b) => {
            const da = new Date(a.date || 0).getTime();
            const db = new Date(b.date || 0).getTime();
            return db - da;
        });

        return NextResponse.json({ success: true, daa: promotedList, data: promotedList }); // Typo 'daa' fix just in case, returning 'data'

    } catch (error: any) {
        console.error('Promoted Fetch Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
