import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'src/data/business-cards.json');
const scheduleFilePath = path.join(process.cwd(), 'src/data/schedules.json');

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
        const newSchedules: any[] = [];
        let updatedCount = 0;
        let skippedCount = 0;

        // Read Schedule Data Once
        let schedules: any[] = [];
        try {
            if (fs.existsSync(scheduleFilePath)) {
                const scheduleData = fs.readFileSync(scheduleFilePath, 'utf8');
                schedules = JSON.parse(scheduleData);
            }
        } catch (e) {
            schedules = [];
        }

        const now = new Date(); // Shared timestamp reference

        inputs.forEach((input: any, idx: number) => {
            // 1. Check for Duplicate (Upsert Logic)
            // Keys: name + mobile (if present) OR name + email (if present) OR name + companyName
            // Strictest: name + mobile (if input has mobile)
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

                // Check if data is effectively different
                // We compare key fields mapped from Excel
                const isDifferent =
                    existing.companyName !== input.companyName ||
                    existing.department !== input.department ||
                    existing.email !== input.email ||
                    existing.companyPhone1 !== input.companyPhone1 ||
                    existing.fax !== input.fax ||
                    existing.companyAddress !== input.companyAddress ||
                    existing.memo !== input.memo ||
                    existing.category !== input.category ||
                    existing.createdAt !== input.createdAt; // Date change triggers update? User asked to use Excel date.

                if (isDifferent) {
                    // Update
                    cards[existingIndex] = {
                        ...existing,
                        ...input,
                        id: existing.id, // Preserve ID
                        history: existing.history, // Preserve History
                        promotedProperties: existing.promotedProperties, // Preserve Promoted
                        isFavorite: existing.isFavorite, // Preserve Favorite
                        managerId: existing.managerId, // Preserve Manager (unless we want to overwrite?)
                        createdAt: input.createdAt || existing.createdAt, // Allow Excel date to overwrite? Yes.
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
                    id: input.id || String(now.getTime() + idx), // Unique ID
                    createdAt: input.createdAt || now.toISOString(),
                    updatedAt: now.toISOString()
                };
                newCards.push(newCard);

                // Create Schedule Entry for NEW cards
                newSchedules.push({
                    id: String(now.getTime() + 1000 + idx),
                    title: `[명함등록] ${newCard.name}`,
                    date: newCard.createdAt.split('T')[0],
                    scope: 'work',
                    status: 'completed',
                    type: 'work',
                    color: '#fab005', // Yellow/Orange
                    details: '신규 명함 등록 (Excel/Manual)',
                    businessCardId: newCard.id,
                    userId: newCard.managerId,
                    companyName: newCard.userCompanyName,
                    createdAt: now.toISOString()
                });
            }
        });

        // Prepend new cards (newest first)
        cards.unshift(...newCards);
        saveCards(cards);

        // Append schedules
        if (newSchedules.length > 0) {
            try {
                schedules.push(...newSchedules);
                fs.writeFileSync(scheduleFilePath, JSON.stringify(schedules, null, 2), 'utf8');
            } catch (err) {
                console.error('Schedule sync failed:', err);
            }
        }

        return NextResponse.json({
            success: true,
            created: newCards.length,
            updated: updatedCount,
            skipped: skippedCount,
            data: Array.isArray(body) ? newCards : newCards[0] // Return new ones, or just success?
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
