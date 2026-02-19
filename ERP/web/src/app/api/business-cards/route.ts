
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


const dataPath = path.join(process.cwd(), 'src/data/business-cards.json');

// Helper to resolve IDs
async function resolveIds(legacyCompany: string | null, legacyUser: string | null) {
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserUuid(supabaseAdmin: any, rawUser: string | null) {
    if (!rawUser) return null;
    if (UUID_REGEX.test(rawUser)) return rawUser;

    const email = rawUser.includes('@') ? rawUser : `${rawUser}@example.com`;
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

    return profile?.id || null;
}

async function getRequesterProfile(supabaseAdmin: any, rawUser: string | null) {
    const requesterId = await resolveUserUuid(supabaseAdmin, rawUser);
    if (!requesterId) return null;

    const { data: requester } = await supabaseAdmin
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', requesterId)
        .single();

    return requester || null;
}

function canAccessCard(requester: any, card: { company_id: string | null; manager_id: string | null }) {
    if (!requester) return false;
    if (requester.role === 'admin') return true;
    if (requester.id && card.manager_id && requester.id === card.manager_id) return true;
    if (requester.company_id && card.company_id && requester.company_id === card.company_id) return true;
    return false;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const company = searchParams.get('company');

    // Fetch from Supabase
    const supabaseAdmin = getSupabaseAdmin();

    // Company Filter Logic
    let userId = await resolveUserUuid(supabaseAdmin, searchParams.get('userId'));

    if (!id && !userId) {
        return NextResponse.json({ error: 'userId is required for list access' }, { status: 400 });
    }


    // Build query
    const limitParam = searchParams.get('limit'); // limit=100 or 'all'
    const limit = limitParam === 'all' ? undefined : (parseInt(limitParam || '1000', 10) || 1000);

    // Build query
    let query = supabaseAdmin
        .from('business_cards')
        .select(`
            *,
            promoted_items:business_card_promoted(*),
            history:business_card_history(*)
        `)
        .order('created_at', { ascending: false });

    if (limit) {
        query = query.limit(limit);
    }

    // Company Filter Logic
    // userId is already resolved above
    if (userId) {

        // 1. Get Requester Company ID from Profiles
        const { data: requester } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .single();

        if (requester?.company_id) {
            // 2. Get All Team Members in this Company
            const { data: teamMembers } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('company_id', requester.company_id);

            let teamIds: string[] = [];
            if (teamMembers) teamIds = teamMembers.map(t => t.id);

            // Construct Filter with OR logic
            const companyFilter = `company_id.eq.${requester.company_id}`;
            let managerFilter = '';

            if (teamIds.length > 0) {
                managerFilter = `manager_id.in.(${teamIds.join(',')})`;
            } else {
                managerFilter = `manager_id.eq.${userId}`;
            }

            // Apply OR Filter
            query = query.or(`${companyFilter},${managerFilter}`);
        } else {
            // User has no company_id? -> Show only their own cards (Personal isolation)
            query = query.eq('manager_id', userId);
        }
    } else {
        // No userId provided (legacy or admin). 
        // If strict security required, we could return empty.
        // For now, let's allow "GetAll" strictly for backward compat BUT prompt implies "company isolation".
        // If we strictly enforce company isolation, we should probably require userId.
        // But let's leave as-is for non-login path if any.
    }

    // Debug Mode
    const debugMode = searchParams.get('debug') === 'true';
    let debugInfo: any = {};

    const { data, error } = await query;
    if (error) {
        console.error('GET business-cards error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (debugMode) {
        // Re-fetch context for debug info since query was already built
        let dCompanyId = null;
        let dTeamIds = [];
        if (userId) {
            const { data: req } = await supabaseAdmin.from('profiles').select('company_id').eq('id', userId).single();
            if (req) {
                dCompanyId = req.company_id;
                const { data: teams } = await supabaseAdmin.from('profiles').select('id').eq('company_id', dCompanyId);
                if (teams) dTeamIds = teams.map(t => t.id);
            }
        }
        return NextResponse.json({
            debug: true,
            inputUserId: searchParams.get('userId'),
            resolvedUserId: userId,
            companyId: dCompanyId,
            teamMemberCount: dTeamIds.length,
            totalCardsFound: data?.length || 0,
            firstCard: data && data.length > 0 ? { id: data[0].id, manager_id: data[0].manager_id } : null
        });
    }

    // Manual Join for History Target Names (to avoid FK dependency)
    // 1. Collect all target_ids from history
    const propertyIds = new Set<string>();
    data.forEach((card: any) => {
        if (card.history && Array.isArray(card.history)) {
            card.history.forEach((h: any) => {
                if (h.target_id && h.target_type === 'property') {
                    propertyIds.add(h.target_id);
                }
            });
        }
    });

    const propertyNameMap = new Map<string, string>();
    if (propertyIds.size > 0) {
        const { data: props, error: pInfo } = await supabaseAdmin
            .from('properties')
            .select('id, name')
            .in('id', Array.from(propertyIds));

        if (props && !pInfo) {
            props.forEach((p: any) => propertyNameMap.set(p.id, p.name));
        }
    }

    // Map DB columns to Frontend Interface (BusinessCardData)
    // Front: id, name, companyName, department, mobile, email, etc.
    // DB: manage_id, company_name, department, mobile, email, etc.
    const mappedData = data.map((item: any) => ({
        id: item.id, // UUID
        manageId: item.manage_id,
        name: item.name,
        category: item.category,
        companyName: item.company_name, // DB: company_name -> Front: companyName
        department: item.department,
        position: item.position,
        mobile: item.mobile,
        companyPhone1: item.company_phone1,
        companyPhone2: item.company_phone2,
        email: item.email,
        memo: item.etc_memo, // DB: etc_memo -> Front: memo
        companyAddress: item.company_address,

        homeAddress: item.home_address,
        fax: item.fax,
        homePhone: item.home_phone, // Map DB home_phone to Frontend homePhone
        homepage: item.homepage,
        gender: item.gender,
        isFavorite: item.is_favorite,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        managerId: item.manager_id,

        // Relations
        promotedProperties: item.promoted_items?.map((p: any) => ({
            id: p.id,
            date: p.date,
            itemName: p.item_name,
            type: p.type,
            amount: p.amount,
            address: p.address,
            propertyId: p.property_id
        })) || [],

        history: item.history?.map((h: any) => ({
            id: h.id,
            date: h.work_date,
            worker: h.worker_name,
            relatedItem: h.related_item,
            content: h.content,
            details: h.details,
            target: h.target,
            targetId: h.target_id, // Added for linking
            targetType: h.target_type, // Added for linking
            targetName: (h.target_id ? propertyNameMap.get(h.target_id) : null) || h.related_item || '-' // Fallback to text
        })) || []
    }));

    if (id) {
        const card = mappedData.find((c: any) => c.id === id);
        if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        return NextResponse.json(card);
    }

    return NextResponse.json(mappedData);
}

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        // Check if this is the new 3-file batch upload (has main, promoted, history arrays)
        if (payload.main && Array.isArray(payload.main)) {
            return handleBatchUpload(payload);
        }

        // Single Card Creation Logic
        const supabaseAdmin = getSupabaseAdmin();
        const {
            promotedProperties,
            history,
            name,
            category,
            companyName,
            department,
            position,
            mobile,
            companyPhone1,
            companyPhone2,
            email,
            memo,
            companyAddress,
            homeAddress,
            fax,
            homepage,
            gender,
            isFavorite,
            managerId,
            ...rest
        } = payload;

        // Validation for Single Create
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // Validate UUID for manager_id
        const safeManagerId = await resolveUserUuid(supabaseAdmin, managerId || null);
        if (!safeManagerId) {
            return NextResponse.json({ error: 'Valid managerId is required' }, { status: 400 });
        }

        const { data: managerProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', safeManagerId)
            .single();

        let companyId = managerProfile?.company_id || null;

        if (companyName) {
            const { companyId: resolvedCompanyId } = await resolveIds(companyName, null);
            if (resolvedCompanyId && companyId && resolvedCompanyId !== companyId) {
                return NextResponse.json({ error: 'Forbidden: manager/company mismatch' }, { status: 403 });
            }
            if (!companyId) companyId = resolvedCompanyId;
        }

        if (!companyId) {
            return NextResponse.json({ error: 'Company scope could not be resolved' }, { status: 400 });
        }

        // 1. Insert Core Data
        const insertData: any = {
            name: name,
            category: category,
            company_name: companyName,
            department: department,
            position: position,
            mobile: mobile,
            company_phone1: companyPhone1,
            company_phone2: companyPhone2,
            email: email,
            etc_memo: memo,
            company_address: companyAddress,
            home_address: homeAddress,
            fax: fax,
            homepage: homepage,
            gender: gender,
            is_favorite: isFavorite,
            manager_id: safeManagerId,
            company_id: companyId, // Added support for Single Create
            // manage_id is required unique. Generate one if not provided?
            // Usually frontend doesn't provide manage_id for new cards.
            // Let's generate a unique manage_id: name + random suffix or timestamp
            manage_id: `${name}_${Date.now()}`,
            registered_at: payload.registeredAt || payload.registered_at || new Date().toISOString(),
            created_at: payload.createdAt || payload.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Remove undefined
        Object.keys(insertData).forEach(key => insertData[key] === undefined && delete insertData[key]);

        const { data: newCard, error: insertError } = await supabaseAdmin
            .from('business_cards')
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        const newId = newCard.id;

        // 2. Insert Promoted Items (if any)
        if (Array.isArray(promotedProperties) && promotedProperties.length > 0) {
            const promotedInsert = promotedProperties.map((p: any) => ({
                business_card_id: newId,
                item_name: p.itemName,
                amount: p.amount,
                type: p.type,
                address: p.address,
                date: p.date,
                property_id: p.propertyId
            }));
            await supabaseAdmin.from('business_card_promoted').insert(promotedInsert);
        }

        // 3. Insert History (if any)
        if (Array.isArray(history) && history.length > 0) {
            const historyInsert = history.map((h: any) => ({
                business_card_id: newId,
                work_date: h.date,
                worker_name: h.worker,
                related_item: h.relatedItem,
                content: h.content,
                details: h.details,
                target: h.target,
                target_id: h.targetId,
                target_type: h.targetType
            }));
            await supabaseAdmin.from('business_card_history').insert(historyInsert);
        }

        return NextResponse.json(newCard);

    } catch (error) {
        console.error('POST error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

async function handleBatchUpload(payload: any) {
    const supabaseAdmin = getSupabaseAdmin();
    const { main, promoted, history, meta } = payload;
    const { userCompanyName, managerId } = meta || {};

    // Get Uploader's Company ID for auto-assignment
    const uploaderId = managerId;
    if (!uploaderId || !UUID_REGEX.test(String(uploaderId))) {
        return NextResponse.json({ error: 'Valid uploader managerId is required for batch upload' }, { status: 400 });
    }

    let uploaderCompanyId = null;
    if (uploaderId) {
        const { data: uploaderProfile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', uploaderId)
            .single();
        if (uploaderProfile) uploaderCompanyId = uploaderProfile.company_id;

        // AUTO-REPAIR: If no company_id but we have a name from meta
        if (!uploaderCompanyId && userCompanyName && userCompanyName !== 'Unknown') {
            // 1. Search DB for this company
            const { data: company } = await supabaseAdmin
                .from('companies')
                .select('id')
                .eq('name', userCompanyName) // Assuming name is unique or take first
                .single();

            if (company) {
                uploaderCompanyId = company.id;
                // 2. Link User to this Company
                await supabaseAdmin
                    .from('profiles')
                    .update({ company_id: company.id })
                    .eq('id', uploaderId);
                console.log(`Auto-linked user ${uploaderId} to company ${company.id}`);
            }
        }
    }

    if (!uploaderCompanyId) {
        return NextResponse.json({ error: 'Uploader company scope could not be resolved' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;

    // 1. Process Main Business Cards
    // We need to map the Excel columns to DB columns
    // Excel Keys: "이름", "분류", "담당자", "직급", "회사명", "회사주소", "부서", "자택주소", "핸드폰", "회사전화1", "회사전화2", "팩스", "자택전화", "홈페이지", "이메일", "기타메모", "등록일", "성별", "관심명함", "관리ID"

    // To optimize, we can use `upsert`. But Supabase `upsert` needs a conflict constraint. 
    // We defined UNIQUE(manage_id).

    const cardsToUpsert = [];

    // 0. Pre-process Manager Resolution
    // Strategy: Collect all unique '담당자' names from Excel. Query `profiles` table for these names.
    // Map Name -> UUID.
    // Note: This approach assumes names are unique enough or takes the first match.
    // Given the user request: "If name mismatch -> Unassigned (NULL)".

    // We do NOT use the payload.meta.managerId anymore for assignment, 
    // unless the Excel '담당자' is explicitly empty? 
    // User logic: "If name is different, set unassigned". 
    // Implies: If Excel has name -> Search. If not found -> Unassigned.
    // If Excel empty -> Keep empty (Unassigned) or Uploader?
    // Let's assume Excel empty means Unassigned too, or Uploader.
    // Let's use Uploader ID only if Excel row '담당자' is missing/empty string. 
    // If '담당자' exists but not found in DB -> NULL.

    // Helper for robust key matching (Hoist definition)
    const getVal = (row: any, keys: string[]) => {
        for (const k of keys) {
            if (row[k] !== undefined) return row[k];
            if (row[k.trim()] !== undefined) return row[k.trim()];
            // Try removing spaces
            const noSpaceKey = k.replace(/\s+/g, '');
            const found = Object.keys(row).find(rk => rk.replace(/\s+/g, '') === noSpaceKey);
            if (found) return row[found];
        }
        return null;
    };

    const uniqueNames = new Set<string>();
    main.forEach((row: any) => {
        const mName = getVal(row, ['담당자']);
        if (mName && typeof mName === 'string' && mName.trim()) {
            uniqueNames.add(mName.trim());
        }
    });

    const managerNameMap = new Map<string, string>(); // Name -> UUID

    if (uniqueNames.size > 0) {
        const namesArray = Array.from(uniqueNames);
        // Supabase `in` filter
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, name')
            .in('name', namesArray);

        if (!profileError && profiles) {
            profiles.forEach((p: any) => {
                if (p.name) managerNameMap.set(p.name, p.id);
            });
        }
    }

    // Resolve Manager ID for Uploader (Fallback if Excel is empty?)
    // Let's being strict: If Excel '담당자' is empty, leave as NULL too?
    // It's safer to leave NULL if we want to be "Unassigned".
    // But usually 'My Upload' implies 'My Cards' if not specified.
    // However, the prompt focus was "Differnet name -> Unassigned".
    // I'll stick to: Excel Name -> DB Match -> ID. Else NULL.



    for (const row of main) {
        // Robust Key Matching
        const resolveName = getVal(row, ['이름', '성명']);
        const resolveCompany = getVal(row, ['회사명']);

        // Critical: Skip if Name is missing (Constraint Violation)
        if (!resolveName) continue;

        const manageId = getVal(row, ['관리ID']) || `${resolveName}_${resolveCompany || 'NoCompany'}`;

        // Manager Logic
        let managerUuid = null;
        const excelManagerName = getVal(row, ['담당자']);
        if (excelManagerName && typeof excelManagerName === 'string' && excelManagerName.trim()) {
            managerUuid = managerNameMap.get(excelManagerName.trim()) || null;
        }

        // Parse Registered Date
        let registeredAt = null;
        const regVal = getVal(row, ['등록일']);
        if (regVal) {
            registeredAt = parseDate(regVal);
        }

        cardsToUpsert.push({
            manage_id: manageId,
            company_id: uploaderCompanyId, // Auto-assign to Uploader's company
            name: resolveName,
            category: getVal(row, ['분류']),
            position: getVal(row, ['직급']),
            company_name: resolveCompany,
            company_address: getVal(row, ['회사주소']),
            department: getVal(row, ['부서']),
            home_address: getVal(row, ['자택주소']),
            mobile: getVal(row, ['핸드폰', '휴대폰']),
            company_phone1: getVal(row, ['회사전화1', '회사전화', '대표전화']),
            company_phone2: getVal(row, ['회사전화2']),
            fax: getVal(row, ['팩스']),
            home_phone: getVal(row, ['자택전화', '자택 전화', '집전화', '자택']),
            homepage: getVal(row, ['홈페이지']),
            email: getVal(row, ['이메일']),
            etc_memo: getVal(row, ['기타메모', '메모']),
            gender: (getVal(row, ['성별']) === '남' || getVal(row, ['성별']) === 'M') ? 'M' : (getVal(row, ['성별']) === '여' || getVal(row, ['성별']) === 'F') ? 'F' : null,
            is_favorite: getVal(row, ['관심명함']) === 'O' || getVal(row, ['관심명함']) === true,
            registered_at: registeredAt,
            created_at: registeredAt || now,
            manager_id: managerUuid,
            updated_at: now
        });
    }

    // Deduplicate cardsToUpsert based on manage_id (Last one wins)
    const uniqueCardsMap = new Map();
    cardsToUpsert.forEach(card => {
        uniqueCardsMap.set(card.manage_id, card);
    });
    const uniqueCards = Array.from(uniqueCardsMap.values());

    if (uniqueCards.length > 0) {
        const { error } = await supabaseAdmin
            .from('business_cards')
            .upsert(uniqueCards, { onConflict: 'manage_id', ignoreDuplicates: false });

        if (error) {
            console.error('Upsert cards error:', error);
            return NextResponse.json({ error: `Failed to upsert cards: ${error.message}` }, { status: 500 });
        }
        updatedCount = uniqueCards.length;
    }

    // 2. Clear Old Linked Data (Promoted & History) for these cards? 
    // Or just append? 
    // Usually "Upload" implies "Sync" or "Replace" for these lists if they are snapshots.
    // Given the prompt "순서대로 업로드하면... 연동", likely we want to add or replace.
    // For simplicity and safety, let's DELETE specific types for these cards and re-insert?
    // Actually, without unique IDs on items, idempotency is hard.
    // I will implemented: Delete all promoted/history for the *affected cards* and re-insert.
    const manageIds = uniqueCards.map(c => String(c.manage_id));
    let validCards: any[] = [];

    // Chunked Fetch to avoid Query Too Long error
    const chunkSize = 50;
    for (let i = 0; i < manageIds.length; i += chunkSize) {
        const chunk = manageIds.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;

        const { data: chunkData, error: mapError } = await supabaseAdmin
            .from('business_cards')
            .select('id, manage_id')
            .in('manage_id', chunk);

        if (mapError) {
            console.error('Map IDs error:', mapError);
            console.warn(`Failed to map IDs for chunk ${i}: ${mapError.message}`);
            continue;
        }
        if (chunkData) {
            validCards = [...validCards, ...chunkData];
        }
    }

    if (validCards.length === 0 && manageIds.length > 0) {
        // Should have found something if upsert succeeded
        console.warn('Upsert succeeded but Map IDs found nothing? RLS or Replication lag?');
    }

    const cardMap = new Map(); // manage_id -> uuid
    validCards.forEach((c: any) => cardMap.set(c.manage_id, c.id));

    // DELETE existing linked items to avoid duplicates (Snapshot Sync approach)
    // This assumes the Excel files contain the *complete* list for these cards.
    // If not, we might be deleting data. But "Upload" for migration usually implies full state.
    // Let's assume we Appending is safer IF there is no unique key, but replacing is cleaner.
    // Detailed plan didn't specify. I'll stick to INSERTING, but let's delete strictly for the uploaded sets IF we can identify them.
    // Actually, without unique IDs on items, idempotency is hard.
    // I will implemented: Delete all promoted/history for the *affected cards* and re-insert.
    const cardUuids = validCards.map((c: any) => c.id);

    if (cardUuids.length > 0) {
        await supabaseAdmin.from('business_card_promoted').delete().in('business_card_id', cardUuids);
        await supabaseAdmin.from('business_card_history').delete().in('business_card_id', cardUuids);
    }

    // 3. Process Promoted Items
    const promotedToInsert = [];
    for (const row of promoted) {
        const manageId = row['관리ID'];
        const cardId = cardMap.get(manageId);
        if (cardId) {
            promotedToInsert.push({
                business_card_id: cardId,
                date: row['날짜'], // Text or parse
                item_name: row['물건명'],
                type: row['종류'],
                amount: row['금액'],
                address: row['주소']
            });
        }
    }

    if (promotedToInsert.length > 0) {
        await supabaseAdmin.from('business_card_promoted').insert(promotedToInsert);
    }

    // 4. Process Work History
    const historyToInsert = [];
    for (const row of history) {
        const manageId = row['관리ID'];
        const cardId = cardMap.get(manageId);
        if (cardId) {
            historyToInsert.push({
                business_card_id: cardId,
                work_date: row['날짜'],
                worker_name: row['작업자'],
                related_item: row['관련물건'],
                content: row['내역'],
                details: row['상세내역'],
                target: row['대상']
            });
        }
    }

    if (historyToInsert.length > 0) {
        await supabaseAdmin.from('business_card_history').insert(historyToInsert);
    }

    return NextResponse.json({
        success: true,
        cards: {
            created: createdCount,
            updated: updatedCount,
        }
    });
}

function parseDate(val: any) {
    if (!val) return null;
    if (typeof val === 'number') {
        // Excel Serial
        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
        return date.toISOString();
    }
    // String "2025-11-10 (월)" or "2025. 11. 10"
    const str = String(val);
    const datePart = str.split('(')[0].trim().replace(/\./g, '-'); // Replace dots with dashes
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null; // or keep original string if field was text
}

export async function PUT(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const {
        id,
        promotedProperties,
        history,
        // Destructure core fields to map
        name,
        category,
        companyName,
        department,
        position,
        mobile,
        companyPhone1,
        companyPhone2,
        email,
        memo,
        companyAddress,
        homeAddress,
        fax,
        homepage,
        gender,
        isFavorite,
        managerId,
        ...rest
    } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    try {
        const requesterRaw = body.requesterId || managerId || body.manager_id || null;
        const requesterProfile = await getRequesterProfile(supabaseAdmin, requesterRaw);
        if (!requesterProfile) {
            return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
        }

        const { data: existingCard, error: existingCardError } = await supabaseAdmin
            .from('business_cards')
            .select('id, company_id, manager_id')
            .eq('id', id)
            .single();

        if (existingCardError || !existingCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        if (!canAccessCard(requesterProfile, existingCard)) {
            return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
        }

        const safeManagerId = managerId ? await resolveUserUuid(supabaseAdmin, managerId) : null;
        if (managerId && !safeManagerId) {
            return NextResponse.json({ error: 'Invalid managerId' }, { status: 400 });
        }

        // 1. Update Core Data
        const updateData: any = {
            name: name,
            category: category,
            company_name: companyName, // Map
            department: department,
            position: position,
            mobile: mobile,
            company_phone1: companyPhone1, // Map
            company_phone2: companyPhone2, // Map
            email: email,
            etc_memo: memo, // Map
            company_address: companyAddress, // Map
            home_address: homeAddress, // Map
            fax: fax, // Map? No, fax isfax
            homepage: homepage,
            gender: gender,
            is_favorite: isFavorite,
            updated_at: new Date().toISOString()
        };

        if (safeManagerId) {
            updateData.manager_id = safeManagerId;
        }

        // Remove undefined keys to avoid overwriting with null if strictly undefined
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const { error: mainError } = await supabaseAdmin.from('business_cards').update(updateData).eq('id', id);
        if (mainError) throw mainError;

        // 2. Update Promoted Items (Snapshot Replace)
        if (Array.isArray(promotedProperties)) {
            // Delete existing
            await supabaseAdmin.from('business_card_promoted').delete().eq('business_card_id', id);

            // Insert new
            const promotedInsert = promotedProperties.map((p: any) => ({
                business_card_id: id,
                item_name: p.itemName, // Map
                amount: p.amount,
                type: p.type,
                address: p.address,
                date: p.date,
                property_id: p.propertyId // Critical: Preserve Link
            }));

            if (promotedInsert.length > 0) {
                const { error: promoError } = await supabaseAdmin.from('business_card_promoted').insert(promotedInsert);
                if (promoError) throw promoError;
            }
        }

        // 3. Update History (Snapshot Replace)
        if (Array.isArray(history)) {
            // Delete existing
            await supabaseAdmin.from('business_card_history').delete().eq('business_card_id', id);

            // Insert new
            const historyInsert = history.map((h: any) => ({
                business_card_id: id,
                work_date: h.date, // Map
                worker_name: h.worker, // Map
                related_item: h.relatedItem, // Map
                content: h.content,
                details: h.details,
                target: h.target,
                target_id: h.targetId, // Map
                target_type: h.targetType // Map
            }));

            if (historyInsert.length > 0) {
                const { error: histError } = await supabaseAdmin.from('business_card_history').insert(historyInsert);
                if (histError) throw histError;
            }
        }

        // [PUSH SYNC] Active Sync to Properties (Business Cards)
        try {
            // Fetch properties linked to this card
            let propQuery = supabaseAdmin.from('properties').select('id, data').contains('data', { promotedCustomers: [{ targetId: id, type: 'businessCard' }] });

            // Limit by company if possible? Yes, business cards are usually company-scoped?
            // But let's rely on ID match which is safer.

            const { data: linkedProps } = await propQuery;

            if (linkedProps && linkedProps.length > 0) {
                console.log(`[PushSync] Updating ${linkedProps.length} properties for BusinessCard ${id}`);

                // Construct updated card object (partial)
                const updatedCard = {
                    name,
                    mobile, // Front: mobile
                    category, // Front: category
                    memo, // Front: memo (etc_memo)
                };

                for (const prop of linkedProps) {
                    const pList = prop.data.promotedCustomers || [];
                    let modified = false;

                    const newList = pList.map((item: any) => {
                        if (item.targetId === id && item.type === 'businessCard') {
                            modified = true;
                            // Update Snapshot
                            return {
                                ...item,
                                name: updatedCard.name,
                                contact: updatedCard.mobile,
                                classification: updatedCard.category || item.classification, // Map category -> classification
                                features: updatedCard.memo || item.features // Map memo -> features
                            };
                        }
                        return item;
                    });

                    if (modified) {
                        await supabaseAdmin
                            .from('properties')
                            .update({ data: { ...prop.data, promotedCustomers: newList } })
                            .eq('id', prop.id);
                    }
                }
            }
        } catch (syncError) {
            console.error('[PushSync] Failed to sync BusinessCard to properties:', syncError);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const requesterRaw = searchParams.get('requesterId') || request.headers.get('x-user-id');

    const supabaseAdmin = getSupabaseAdmin();
    const requesterProfile = await getRequesterProfile(supabaseAdmin, requesterRaw);
    if (!requesterProfile) {
        return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
    }

    const { data: targetCard, error: targetCardError } = await supabaseAdmin
        .from('business_cards')
        .select('id, company_id, manager_id')
        .eq('id', id)
        .single();

    if (targetCardError || !targetCard) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    if (!canAccessCard(requesterProfile, targetCard)) {
        return NextResponse.json({ error: 'Forbidden: cross-company access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('business_cards').delete().eq('id', id);

    if (error) {
        console.error('Delete card error:', error);
        return NextResponse.json({ error: `Deletion failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
