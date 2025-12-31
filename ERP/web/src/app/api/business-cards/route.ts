
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const dataPath = path.join(process.cwd(), 'src/data/business-cards.json');

// Helper to resolve IDs
async function resolveIds(legacyCompany: string, legacyUser: string) {
    const supabaseAdmin = getSupabaseAdmin();
    let companyId = null;
    let userId = null;

    if (legacyCompany) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('name', legacyCompany).single();
        if (c) companyId = c.id;
    }

    // Quick Fix: specific override for '내일' -> '내일사장' if not found?
    if (!companyId && legacyCompany === '내일') {
        const { data: c } = await supabaseAdmin.from('companies').select('id').like('name', '내일%').limit(1).single();
        if (c) companyId = c.id;
    }

    if (legacyUser) {
        const email = `${legacyUser}@example.com`;
        const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
        if (u) userId = u.id;
        else if (legacyUser === 'admin') {
            const { data: a } = await supabaseAdmin.from('profiles').select('id').ilike('email', 'admin%').limit(1).single();
            if (a) userId = a.id;
        }
    }
    return { companyId, userId };
}

function getCards() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, '[]', 'utf8');
        return [];
    }
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    try {
        return JSON.parse(fileContent);
    } catch (e) {
        return [];
    }
}

function saveCards(cards: any[]) {
    fs.writeFileSync(dataPath, JSON.stringify(cards, null, 2), 'utf8');
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');

    let cards = getCards();

    // Filter by company if provided (Strict Data Segregation)
    if (company) {
        cards = cards.filter((c: any) => c.userCompanyName === company);
    }

    if (searchParams.has('id')) {
        const id = searchParams.get('id');
        const card = cards.find((c: any) => c.id === id);
        if (!card) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }
        return NextResponse.json(card);
    }

    return NextResponse.json(cards);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const cards = getCards();
        const inputs = Array.isArray(body) ? body : [body];
        const newCards: any[] = [];
        const newSchedules: any[] = []; // To be inserted into Supabase
        let updatedCount = 0;
        let skippedCount = 0;

        const now = new Date(); // Shared timestamp reference

        inputs.forEach((input: any, idx: number) => {
            // 1. Check for Duplicate (Upsert Logic)
            let existingIndex = -1;

            if (input.mobile) {
                existingIndex = cards.findIndex((c: any) => c.name === input.name && c.mobile === input.mobile);
            }
            if (existingIndex === -1 && input.email) {
                existingIndex = cards.findIndex((c: any) => c.name === input.name && c.email === input.email);
            }
            if (existingIndex === -1) {
                existingIndex = cards.findIndex((c: any) => c.name === input.name && c.companyName === input.companyName);
            }

            if (existingIndex !== -1) {
                // Found Existing: Check for Changes
                const existing = cards[existingIndex];
                const isDifferent =
                    existing.companyName !== input.companyName ||
                    existing.department !== input.department ||
                    existing.email !== input.email ||
                    existing.companyPhone1 !== input.companyPhone1 ||
                    existing.fax !== input.fax ||
                    existing.companyAddress !== input.companyAddress ||
                    existing.memo !== input.memo ||
                    existing.category !== input.category ||
                    existing.createdAt !== input.createdAt;

                if (isDifferent) {
                    cards[existingIndex] = {
                        ...existing,
                        ...input,
                        id: existing.id,
                        history: existing.history,
                        promotedProperties: existing.promotedProperties,
                        isFavorite: existing.isFavorite,
                        managerId: existing.managerId,
                        createdAt: input.createdAt || existing.createdAt,
                        updatedAt: now.toISOString()
                    };
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                // New Card
                const newCard = {
                    ...input,
                    id: input.id || String(now.getTime() + idx),
                    createdAt: input.createdAt || now.toISOString(),
                    updatedAt: now.toISOString()
                };
                newCards.push(newCard);

                // Queue Schedule Creation
                newSchedules.push({
                    title: `[명함등록] ${newCard.name}`,
                    date: newCard.createdAt.split('T')[0],
                    scope: 'work',
                    status: 'completed',
                    type: 'work',
                    color: '#fab005',
                    details: '신규 명함 등록 (Excel/Manual)',
                    businessCardId: newCard.id,
                    userId: newCard.managerId,
                    companyName: newCard.userCompanyName,
                    createdAt: now.toISOString()
                });
            }
        });

        // Prepend new cards
        cards.unshift(...newCards);
        saveCards(cards);

        // Async: Insert Schedules to Supabase
        if (newSchedules.length > 0) {
            // Process individually to resolve IDs
            (async () => {
                const supabaseAdmin = getSupabaseAdmin();
                for (const sched of newSchedules) {
                    try {
                        const { companyId, userId } = await resolveIds(sched.companyName, sched.userId);
                        if (companyId) {
                            await supabaseAdmin.from('schedules').insert({
                                id: String(Date.now() + Math.random()), // unique ID
                                title: sched.title,
                                date: sched.date,
                                scope: sched.scope,
                                status: sched.status,
                                type: sched.type,
                                color: sched.color,
                                details: sched.details,
                                business_card_id: sched.businessCardId,
                                user_id: userId,
                                company_id: companyId,
                                created_at: sched.createdAt
                            });
                        }
                    } catch (err) {
                        console.error('Failed to sync schedule for card:', err);
                    }
                }
            })();
        }

        return NextResponse.json({
            success: true,
            created: newCards.length,
            updated: updatedCount,
            skipped: skippedCount,
            data: Array.isArray(body) ? newCards : newCards[0]
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create card(s)' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const body = await request.json();
    const cards = getCards();
    const index = cards.findIndex((c: any) => c.id === body.id);

    if (index !== -1) {
        cards[index] = {
            ...cards[index],
            ...body,
            updatedAt: new Date().toISOString()
        };
        saveCards(cards);
        return NextResponse.json(cards[index]);
    }
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    let cards = getCards();
    const initialLength = cards.length;
    cards = cards.filter((c: any) => c.id !== id);

    if (cards.length !== initialLength) {
        saveCards(cards);
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
}
