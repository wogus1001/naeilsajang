import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'; // Cache bust check

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { companyId } = await request.json();

        if (!companyId) {
            return NextResponse.json({ error: 'Company ID is required for sync security.' }, { status: 400 });
        }

        const results = {
            history: { matched: 0, failed: 0 },
            promoted: { matched: 0, failed: 0 },
            logs: [] as string[] // Debug logs
        };

        const log = (msg: string) => results.logs.push(msg);

        // 0. Get Company Properties & Cards for Filtering
        // Get this company's cards to ensure we only sync OUR cards
        const { data: companyCards } = await supabaseAdmin
            .from('business_cards')
            .select('id')
            .eq('company_id', companyId);

        const cardIds = companyCards?.map(c => c.id) || [];

        // If no cards, nothing to sync
        if (cardIds.length === 0) {
            return NextResponse.json({ success: true, results, debug: { message: 'No cards found for this company' } });
        }

        // 1. Sync History (Scoped to Company Cards)
        // Find history items where target_id IS NULL AND belongs to our cards
        const { data: historyItems, error: historyError } = await supabaseAdmin
            .from('business_card_history')
            .select('id, related_item, target, business_card_id, content, work_date, worker_name') // Correct column names: work_date, worker_name

            .in('business_card_id', cardIds); // Security Scope

        if (historyItems && historyItems.length > 0) {
            for (const item of historyItems) {
                // Find Property Name (Check related_item first, then target)
                let nameToSearch = (item.related_item || item.target || '').trim();

                if (!nameToSearch) continue;
                log(`Processing History Item ${item.id}: searching for '${nameToSearch}'`);

                const { data: property, error: searchError } = await supabaseAdmin
                    .from('properties')
                    .select('id, name, data') // Fetch data for reverse sync
                    .eq('company_id', companyId) // Security Scope
                    .eq('name', nameToSearch) // Strict match per user request
                    .maybeSingle();

                if (property) {
                    await supabaseAdmin
                        .from('business_card_history')
                        .update({
                            target_id: property.id,
                            target_type: 'store' // Default type
                        })
                        .eq('id', item.id);


                    // Reverse Sync: Add to Property's workHistory
                    // Fetch Card Info
                    const { data: bCard } = await supabaseAdmin.from('business_cards').select('name').eq('id', item.business_card_id).single();
                    if (bCard) {
                        const pData = property.data || {};
                        const pHistory = pData.workHistory || [];

                        // Check duplicates
                        const exists = pHistory.some((ph: any) =>
                            ph.targetId === item.business_card_id &&
                            ph.date === item.work_date &&
                            ph.content === item.content
                        );

                        if (!exists) {
                            const newHistory = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                date: item.work_date,
                                manager: item.worker_name, // Use correctly selected column
                                content: item.content,
                                details: '', // history table might not have details column in select
                                targetType: 'businessCard',
                                targetKeyword: bCard.name,
                                targetId: item.business_card_id
                            };

                            await supabaseAdmin
                                .from('properties')
                                .update({ data: { ...pData, workHistory: [...pHistory, newHistory] } })
                                .eq('id', property.id);
                        }
                    }

                    results.history.matched++;
                } else {
                    log(`Failed to find property for '${nameToSearch}'`);
                    results.history.failed++;
                }
            }
        }

        // 2. Sync Promoted Items (Scoped to Company Cards)
        const { data: promotedItems, error: promotedError } = await supabaseAdmin
            .from('business_card_promoted')
            .select('id, item_name, business_card_id, type, amount, address, date')
            .is('property_id', null)
            .in('business_card_id', cardIds) // Security Scope
            .neq('item_name', '')
            .not('item_name', 'is', null);

        let promotedMatches = 0;
        let promotedFound = promotedItems ? promotedItems.length : 0;
        let lastFailure = '';

        if (promotedItems && promotedItems.length > 0) {
            for (const item of promotedItems) {
                const nameToSearch = (item.item_name || '').trim();
                if (!nameToSearch) continue;

                // Find Property
                const { data: property, error: searchError } = await supabaseAdmin
                    .from('properties')
                    .select('id, name, data')
                    .eq('company_id', companyId) // Security Scope
                    .ilike('name', nameToSearch)
                    .maybeSingle();

                if (property) {
                    // A. Link in business_card_promoted
                    const { error: updateError } = await supabaseAdmin
                        .from('business_card_promoted')
                        .update({ property_id: property.id })
                        .eq('id', item.id);

                    if (!updateError) {
                        promotedMatches++;
                        results.promoted.matched++;

                        // B. Reverse Sync: Add to Property's promotedCustomers list (in data column)
                        const { data: card } = await supabaseAdmin
                            .from('business_cards')
                            .select('*')
                            .eq('id', item.business_card_id)
                            .single();

                        if (card) {
                            const currentData = property.data || {};
                            let currentList = currentData.promotedCustomers || [];
                            if (!Array.isArray(currentList)) currentList = [];

                            const exists = currentList.some((c: any) => c.promotedId === item.id);

                            if (!exists) {
                                const newCustomer = {
                                    promotedId: item.id,
                                    id: new Date().getTime().toString() + Math.random().toString().slice(2, 5),
                                    date: item.date || new Date().toISOString().split('T')[0],
                                    name: card.name,
                                    type: 'businessCard',
                                    classification: card.category || '-',
                                    budget: item.amount || '-',
                                    features: `[추진] ${item.item_name}`,
                                    targetId: card.id,
                                    contact: card.mobile || ''
                                };

                                // Update the data column with the new list inside it
                                const newData = { ...currentData, promotedCustomers: [...currentList, newCustomer] };

                                await supabaseAdmin
                                    .from('properties')
                                    .update({ data: newData })
                                    .eq('id', property.id);
                            }
                        }
                    } else {
                        lastFailure = `Update Error for ${nameToSearch}: ${updateError?.message}`;
                        results.promoted.failed++;
                    }
                } else {
                    lastFailure = `Property '${nameToSearch}' not found (Error: ${searchError?.code || 'None'})`;
                    results.promoted.failed++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            results: {
                history: {
                    matched: results.history.matched,
                    failed: results.history.failed
                },
                promoted: {
                    matched: promotedMatches
                }
            },
            debug: {
                promotedFound,
                promotedMatches,
                lastFailure
            }
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
