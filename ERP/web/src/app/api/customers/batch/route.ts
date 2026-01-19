
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        return handleBatchUpload(payload);
    } catch (error) {
        console.error('Batch error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

async function handleBatchUpload(payload: any) {
    const supabaseAdmin = getSupabaseAdmin();
    const { main, promoted, history, meta } = payload;
    const { userCompanyName, managerId } = meta || {};

    const now = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;

    // 1. Resolve Managers (Cache Map: Name/Email -> UUID)
    const uniqueEmails = new Set<string>();
    const uniqueNames = new Set<string>();

    main.forEach((row: any) => {
        const mVal = row['담당자'];
        if (mVal && typeof mVal === 'string' && mVal.trim()) {
            const clean = mVal.trim();
            if (clean.includes('@')) uniqueEmails.add(clean);
            else uniqueNames.add(clean.normalize('NFC'));
        }
    });

    const managerMap = new Map<string, { uuid: string, displayId: string }>(); // Key: Name/Email, Value: { UUID, DisplayID }

    // Helper to get Display ID (matches api/users default)
    const getDisplayId = (p: any) => {
        return p.email?.endsWith('@example.com') ? p.email.split('@')[0] : p.email;
    };

    // Fetch by Email
    if (uniqueEmails.size > 0) {
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .in('email', Array.from(uniqueEmails));

        profiles?.forEach((p: any) => {
            if (p.email) {
                managerMap.set(p.email, {
                    uuid: p.id,
                    displayId: getDisplayId(p)
                });
            }
        });
    }

    // Fetch by Name
    if (uniqueNames.size > 0) {
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email')
            .in('name', Array.from(uniqueNames));

        profiles?.forEach((p: any) => {
            if (p.name) {
                // Store normalized name for consistent lookup
                managerMap.set(p.name.normalize('NFC'), {
                    uuid: p.id,
                    displayId: getDisplayId(p)
                });
            }
        });
    }

    // 2. Prepare Customer Upserts
    const customersToUpsert = [];

    // Helper: Map Excel Status to System Status (grade column in DB often used for Status?)
    // In CustomerCard.tsx: grade='progress' (default). status='물건진행'(UI label?).
    // Actually, `grade` seems to be the ENUM 'progress', 'manage', etc.
    // The Excel '진행상태' might contain '추진', '보류' etc.
    const mapStatus = (val: string) => {
        const v = String(val || '').trim();
        if (!v) return 'progress';
        if (v.includes('보류')) return 'hold';
        if (v.includes('관리')) return 'manage';
        if (v.includes('완료') || v.includes('계약')) return 'complete';
        if (v.includes('공동')) return 'common';
        return 'progress';
        return 'progress';
    };

    const parseRange = (val: any) => {
        if (!val) return { min: '', max: '' };
        const str = String(val).trim();
        const parts = str.split(/\s+/); // Split by whitespace
        if (parts.length >= 2) {
            return { min: parts[0], max: parts[1] };
        }
        return { min: str, max: '' };
    };

    // Resolve Company ID from Uploader
    let uploaderCompanyId: string | null = null;
    if (managerId) {
        const { data: uploader } = await supabaseAdmin.from('profiles').select('company_id').eq('id', managerId).single();
        if (uploader) uploaderCompanyId = uploader.company_id;
    }

    for (const row of main) {
        const legacyId = row['관리번호'];
        if (!legacyId) continue;

        // Manager Resolution (UUID for DB, DisplayId for UI)
        let assignedManagerUuid = null;
        let assignedManagerDisplayId = null;

        const managerVal = row['담당자'];
        if (managerVal && typeof managerVal === 'string') {
            const clean = managerVal.trim();
            const found = clean.includes('@')
                ? managerMap.get(clean)
                : managerMap.get(clean.normalize('NFC'));

            if (found) {
                assignedManagerUuid = found.uuid;
                assignedManagerDisplayId = found.displayId;
            }
        }

        // Store Only (Target Type filtering requested by user, but user said "Currently all targets are Store", so we just process all as Store?
        // User said: "customer_main.xlsx 파일에서 우리는 현재 타겟타입이 모두 점포고객으로 되어있기때문에... 업로드 할 필요가 없어"
        // Meaning: Ignore Hotel/Apt/Bldg columns. Just map Store columns.

        // Map Store Columns
        const wantedArea = row['점포_면적'] ? String(row['점포_면적']) : '';
        const wantedDeposit = row['점포_보증금'] ? String(row['점포_보증금']) : '';
        const wantedRent = row['점포_임대료'] ? String(row['점포_임대료']) : '';
        const wantedFloor = row['점포_층'] ? String(row['점포_층']) : '';

        // New explicit columns (from add_customer_columns.sql)
        // wanted_deposit_min/max, rent, area, floor...
        // We put the raw string into the Min field if it's not a range, or put in Data?
        // Let's put in explicit Min fields as valid text for now, and also keeping strict logic if we had range parser.
        // For now, mapping directly to 'Min' columns for storage, even if it's "100" (single value).
        // It acts as the primary field for display.

        // Progress Steps (Split comma)
        let pSteps: string[] = [];
        if (row['진행']) {
            pSteps = String(row['진행']).split(',').map(s => s.trim()).filter(Boolean);
        }

        const customerData = {
            id: String(legacyId), // Use '관리번호' as ID
            name: row['고객명'] || row['이름'],
            grade: mapStatus(row['고객등급']), // Map from '고객등급'

            mobile: row['핸드폰'],
            company_id: uploaderCompanyId, // Assign resolved company ID
            is_favorite: Boolean(row['관심고객']), // Any non-empty value is true? 'O', '관심고객', etc.
            manager_id: assignedManagerUuid, // UUID for DB constraint

            // Explicit Columns added recently
            memo_interest: row['관심내용'],
            memo_history: row['진행내역'], // Note: Excel '진행내역' vs 'customer_work_history.xlsx'? 
            // Usually Excel '진행내역' is a summary.
            progress_steps: pSteps,
            wanted_feature: row['점포_특징'],

            // Range Columns (Mapping single Excel cols to Min for storage)
            wanted_area_min: parseRange(row['점포_면적']).min,
            wanted_area_max: parseRange(row['점포_면적']).max,
            wanted_deposit_min: parseRange(row['점포_보증금']).min,
            wanted_deposit_max: parseRange(row['점포_보증금']).max,
            wanted_rent_min: parseRange(row['점포_임대료']).min,
            wanted_rent_max: parseRange(row['점포_임대료']).max,
            wanted_floor_min: parseRange(row['점포_층']).min,
            wanted_floor_max: parseRange(row['점포_층']).max,

            // JSONB Data
            data: {
                status: row['진행상태'],
                gender: (row['성별'] && String(row['성별']).includes('여')) ? 'F' : 'M', // Moved to JSONB
                class: String(row['분류'] || 'C').replace('급', '').trim(), // 'D급' -> 'D'
                address: row['주소'] || '',
                feature: row['특징_메인'], // Main Feature

                // Contact Info
                companyPhone: row['회사전화'],
                homePhone: row['자택전화'],
                otherPhone: row['기타전화'],
                fax: row['팩스'],
                email: row['이메일'],

                // Requirements
                wantedItem: row['점포_찾는물건'],
                wantedIndustry: row['점포_찾는업종'],
                wantedRegion: row['점포_찾는지역'], // Regional preference
                budget: row['예산'],
                memoSituation: row['고객상황'], // '고객상황' -> memoSituation
                managerId: assignedManagerDisplayId, // Legacy ID for UI Dropdown match!

                // Store raw values in JSON too just in case
                excel_target_type: row['타겟타입'] || '점포',
                excel_reg_date: row['등록일'],
            } as any,

            created_at: row['등록일'] ? parseDate(row['등록일']) : now,
            updated_at: now
        };

        customersToUpsert.push(customerData);
    }

    if (customersToUpsert.length > 0) {
        // Upsert customers
        const { error } = await supabaseAdmin
            .from('customers')
            .upsert(customersToUpsert, { onConflict: 'id' }); // Use ID as conflict target

        if (error) {
            console.error('Upsert customers error:', error);
            return NextResponse.json({ error: 'Failed to upsert customers: ' + error.message }, { status: 500 });
        }
        updatedCount = customersToUpsert.length;
    }

    // 3. Process History (Overwrite Logic)
    // First, delete existing history for these customers? 
    // Customers table stores history in `data->history` JSON array usually??
    // Wait, `CustomerCard.tsx` uses `data.history`. 
    // BUT `api/customers/route.ts` likely maps it?
    // Let's check `api/customers/route.ts` again. 
    // It returns `...data` (JSONB). So `history` is inside JSONB.
    // AND there is `memo_history` column (Text summary).
    // The Excel `customer_work_history.xlsx` contains list items.
    // SO we need to update the `data->history` array in the JSONB column.

    // We cannot easily "Upsert" into JSONB array via bulk SQL.
    // We have to:
    // 1. Group history by ID in memory.
    // 2. Fetch existing? Or just Overwrite? 
    // "Batch Upload" implies overwrite or merge. 
    // Since we just Upserted the customers (replacing row or updating), 
    // we should prepare the FULL JSONB object in the Upsert above.

    // RE-FACTOR: 
    // I should generate the `history` and `promotedProperties` arrays BEFORE upserting `customers`
    // and put them into the `data` JSONB field.

    // 3.1 Group History
    const historyMap = new Map<string, any[]>();
    history.forEach((h: any) => {
        const id = String(h['관리번호']);
        if (!id) return;
        const items = historyMap.get(id) || [];
        items.push({
            id: Date.now() + Math.random(), // Generate random ID for item
            date: h['날짜'],
            worker: h['작업자'],
            relatedProperty: h['관련물건'] || h['점포명'] || '', // Mapped to relatedProperty (UI expects this)
            content: h['내역'],
            details: h['상세내역'],
            target: h['대상']
        });
        historyMap.set(id, items);
    });

    // 3.2 Group Promoted
    const promotedMap = new Map<string, any[]>();
    promoted.forEach((p: any) => {
        const id = String(p['관리번호']);
        if (!id) return;
        const items = promotedMap.get(id) || [];
        items.push({
            id: Date.now() + Math.random(),
            date: p['날짜'],
            itemName: p['물건명'], // Mapped to itemName
            name: p['물건명'], // Compatible key
            type: p['종류'], // '테이크아웃커피' etc
            amount: p['금액'],
            address: p['주소'],
            industrySector: p['물건종류'], // '점포', '호텔' etc
            isSynced: false // Mark as unsynced (from Excel)
        });
        promotedMap.set(id, items);
    });

    // 4. Update 'data' in customersToUpsert with History/Promoted
    customersToUpsert.forEach(c => {
        const hist = historyMap.get(c.id) || [];
        const promo = promotedMap.get(c.id) || [];

        // Assign to data
        c.data.history = hist;
        c.data.promotedProperties = promo;
    });

    // 5. Perform Upsert with complete data
    // (We already did Upsert above, but without history/promoted. 
    //  Actually, if we upsert TWICE, it's waste. 
    //  So I shouldn't have awaited the first Upsert.
    //  Let's fix the flow: Build lists -> Upsert ONCE.)

    // Correct Flow:
    if (customersToUpsert.length > 0) {
        const { error } = await supabaseAdmin
            .from('customers')
            .upsert(customersToUpsert, { onConflict: 'id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({
        success: true,
        count: customersToUpsert.length
    });
}

function parseDate(val: any) {
    if (!val) return null;
    if (typeof val === 'number') {
        // Excel Serial
        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
        return date.toISOString();
    }
    const str = String(val);
    // "2025-11-10 (월)"
    const datePart = str.split('(')[0].trim();
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
}
