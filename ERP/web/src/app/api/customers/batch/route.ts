
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

        // Helper for Fuzzy Key Matching (Trimmed)
        const getValue = (obj: any, target: string) => {
            if (!obj) return undefined;
            if (obj[target] !== undefined) return obj[target];
            const found = Object.keys(obj).find(k => k.trim() === target.trim());
            return found ? obj[found] : undefined;
        };

        // Property Type Processing
        // Property Type Processing
        const targetTypeRaw = String(
            getValue(row, '타겟타입') ||
            getValue(row, '물건종류') ||
            getValue(row, '분류') ||
            getValue(row, '구분') ||
            '점포'
        ).trim();
        let propertyType = 'store';
        if (targetTypeRaw.includes('빌딩')) propertyType = 'building';
        else if (targetTypeRaw.includes('호텔')) propertyType = 'hotel';
        else if (targetTypeRaw.includes('아파트')) propertyType = 'apartment';
        else if (targetTypeRaw.includes('부동산')) propertyType = 'estate';

        // Common Fields Logic (Defaults)
        let wantedItem = '';
        let wantedIndustry = '';
        let wantedAreaLabel = ''; // Region
        let wantedFeature = '';

        // Dynamic Range Fields for JSONB
        let ranges: any = {};

        if (propertyType === 'store') {
            wantedItem = String(getValue(row, '점포_찾는물건') || '');
            wantedIndustry = String(getValue(row, '점포_찾는업종') || '');
            wantedAreaLabel = String(getValue(row, '점포_찾는지역') || '');
            wantedFeature = String(getValue(row, '점포_특징') || '');
        } else if (propertyType === 'building') {
            ranges.wantedLandAreaMin = parseRange(getValue(row, '빌딩_대지면적')).min;
            ranges.wantedLandAreaMax = parseRange(getValue(row, '빌딩_대지면적')).max;
            ranges.wantedTotalAreaMin = parseRange(getValue(row, '빌딩_연면적')).min;
            ranges.wantedTotalAreaMax = parseRange(getValue(row, '빌딩_연면적')).max;
            ranges.wantedYieldMin = parseRange(getValue(row, '빌딩_연수익률')).min;
            ranges.wantedYieldMax = parseRange(getValue(row, '빌딩_연수익률')).max;
            ranges.wantedSalePriceMin = parseRange(getValue(row, '빌딩_매매가')).min;
            ranges.wantedSalePriceMax = parseRange(getValue(row, '빌딩_매매가')).max;

            wantedItem = String(getValue(row, '빌딩_찾는물건') || '');
            wantedIndustry = String(getValue(row, '빌딩_찾는종류') || getValue(row, '빌딩_찾는업종') || getValue(row, '찾는업종') || '');
            wantedAreaLabel = String(getValue(row, '빌딩_찾는지역') || '');
            wantedFeature = String(getValue(row, '빌딩_특징') || '');
        } else if (propertyType === 'hotel') {
            ranges.wantedLandAreaMin = parseRange(getValue(row, '호텔_대지면적')).min;
            ranges.wantedLandAreaMax = parseRange(getValue(row, '호텔_대지면적')).max;
            ranges.wantedTotalAreaMin = parseRange(getValue(row, '호텔_연면적')).min;
            ranges.wantedTotalAreaMax = parseRange(getValue(row, '호텔_연면적')).max;
            ranges.wantedRentMin = parseRange(getValue(row, '호텔_연수익률')).min;
            ranges.wantedRentMax = parseRange(getValue(row, '호텔_연수익률')).max;
            ranges.wantedDepositMin = parseRange(getValue(row, '호텔_매매가')).min;
            ranges.wantedDepositMax = parseRange(getValue(row, '호텔_매매가')).max;

            ranges.wantedSalePriceMin = parseRange(getValue(row, '호텔_매매가')).min;
            ranges.wantedSalePriceMax = parseRange(getValue(row, '호텔_매매가')).max;
            ranges.wantedYieldMin = parseRange(getValue(row, '호텔_연수익률')).min;
            ranges.wantedYieldMax = parseRange(getValue(row, '호텔_연수익률')).max;

            wantedItem = String(getValue(row, '호텔_찾는물건') || '');
            wantedIndustry = String(getValue(row, '호텔_찾는종류') || '');
            wantedAreaLabel = String(getValue(row, '호텔_찾는지역') || '');
            wantedFeature = String(getValue(row, '호텔_특징') || '');
        } else if (propertyType === 'apartment') {
            ranges.wantedSupplyAreaMin = parseRange(getValue(row, '아파트_공급면적')).min;
            ranges.wantedSupplyAreaMax = parseRange(getValue(row, '아파트_공급면적')).max;
            ranges.wantedDepositMin = parseRange(getValue(row, '아파트_보증금') || getValue(row, '부동산_보증금') || getValue(row, '보증금')).min;
            ranges.wantedDepositMax = parseRange(getValue(row, '아파트_보증금') || getValue(row, '부동산_보증금') || getValue(row, '보증금')).max;
            ranges.wantedRentMin = parseRange(getValue(row, '아파트_임대료') || getValue(row, '부동산_임대료') || getValue(row, '임대료')).min;
            ranges.wantedRentMax = parseRange(getValue(row, '아파트_임대료') || getValue(row, '부동산_임대료') || getValue(row, '임대료')).max;
            ranges.wantedSalePriceMin = parseRange(getValue(row, '아파트_매매가')).min;
            ranges.wantedSalePriceMax = parseRange(getValue(row, '아파트_매매가')).max;

            wantedItem = String(getValue(row, '아파트_찾는물건') || '');
            wantedIndustry = String(getValue(row, '아파트_단지명') || getValue(row, '아파트_찾는업종') || '');
            wantedAreaLabel = String(getValue(row, '아파트_찾는지역') || '');
            wantedFeature = String(getValue(row, '아파트_특징') || '');
        } else if (propertyType === 'estate') {
            ranges.wantedLandAreaMin = parseRange(getValue(row, '부동산_대지면적')).min;
            ranges.wantedLandAreaMax = parseRange(getValue(row, '부동산_대지면적')).max;
            ranges.wantedTotalAreaMin = parseRange(getValue(row, '부동산_연면적')).min;
            ranges.wantedTotalAreaMax = parseRange(getValue(row, '부동산_연면적')).max;
            ranges.wantedDepositMin = parseRange(getValue(row, '부동산_보증금') || getValue(row, '보증금')).min;
            ranges.wantedDepositMax = parseRange(getValue(row, '부동산_보증금') || getValue(row, '보증금')).max;
            ranges.wantedRentMin = parseRange(getValue(row, '부동산_임대료') || getValue(row, '임대료')).min;
            ranges.wantedRentMax = parseRange(getValue(row, '부동산_임대료') || getValue(row, '임대료')).max;

            wantedItem = String(getValue(row, '부동산_찾는물건') || '');
            wantedIndustry = String(getValue(row, '부동산_찾는종류') || '');
            wantedAreaLabel = String(getValue(row, '부동산_찾는지역') || '');
            wantedFeature = String(getValue(row, '부동산_특징') || '');
        }

        // Store Columns
        const wantedStoreArea = (propertyType === 'store') ? getValue(row, '점포_면적') : '';
        const wantedStoreDeposit = (propertyType === 'store') ? getValue(row, '점포_보증금') : '';
        const wantedStoreRent = (propertyType === 'store') ? getValue(row, '점포_임대료') : '';
        const wantedStoreFloor = (propertyType === 'store') ? getValue(row, '점포_층') : '';

        // Progress Steps
        let pSteps: string[] = [];
        const rawProgress = getValue(row, '진행');
        if (rawProgress) {
            pSteps = String(rawProgress).split(',').map(s => s.trim()).filter(Boolean);
        }

        // Favorite Logic
        const isFavorite = getValue(row, '관심고객') ? true : false;

        // Memo Situation mapping (Renamed from customerSituation to memoSituation)
        const memoSituation = getValue(row, '고객상황');

        const customerData = {
            id: String(legacyId), // Use '관리번호' as ID
            name: getValue(row, '고객명') || getValue(row, '이름'),
            grade: mapStatus(getValue(row, '고객등급')), // Map from '고객등급'

            mobile: getValue(row, '핸드폰'),
            company_id: uploaderCompanyId, // Assign resolved company ID
            is_favorite: isFavorite,
            manager_id: assignedManagerUuid, // UUID for DB constraint

            // Explicit Columns
            memo_interest: getValue(row, '관심내용'),
            memo_history: getValue(row, '진행내역'),
            progress_steps: pSteps,
            wanted_feature: wantedFeature, // Mapped based on type

            // Range Columns (DB Columns - Only populate relevant ones for Store)
            wanted_area_min: parseRange(wantedStoreArea).min,
            wanted_area_max: parseRange(wantedStoreArea).max,
            wanted_deposit_min: parseRange(wantedStoreDeposit).min,
            wanted_deposit_max: parseRange(wantedStoreDeposit).max,
            wanted_rent_min: parseRange(wantedStoreRent).min,
            wanted_rent_max: parseRange(wantedStoreRent).max,
            wanted_floor_min: parseRange(wantedStoreFloor).min,
            wanted_floor_max: parseRange(wantedStoreFloor).max,

            // JSONB Data
            data: {
                status: getValue(row, '진행상태'),
                gender: (getValue(row, '성별') && String(getValue(row, '성별')).includes('여')) ? 'F' : 'M',
                class: String(getValue(row, '분류') || 'C').trim(), // Removed .replace('급', '')
                address: getValue(row, '주소') || '',
                feature: getValue(row, '특징_메인'), // Main Feature

                // Mapped Common Fields
                wantedItem,
                wantedIndustry,
                wantedArea: wantedAreaLabel,
                budget: getValue(row, '예산'),
                propertyType,

                // Dynamic Ranges
                ...ranges,

                // Contact Info
                companyPhone: getValue(row, '회사전화'),
                homePhone: getValue(row, '자택전화'),
                otherPhone: getValue(row, '기타전화'),
                fax: getValue(row, '팩스'),
                email: getValue(row, '이메일'),

                memoSituation: memoSituation // Renamed from customerSituation
            },
            created_at: (getValue(row, '등록일') ? parseDate(getValue(row, '등록일')) : null) || now,
            updated_at: now
        };


        customersToUpsert.push(customerData);
    }

    // Upsert logic deferred to include history/promoted data

    // 3. Process History (Merge/Overwrite Logic)
    const historyMap = new Map<string, any[]>();
    if (history && Array.isArray(history)) {
        history.forEach((h: any) => {
            const id = String(h['관리번호']);
            if (!id) return;
            const items = historyMap.get(id) || [];
            if (!historyMap.has(id)) historyMap.set(id, items);
            items.push({
                id: `h-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                date: h['날짜'],
                worker: h['작업자'],
                relatedProperty: h['관련물건'] || h['점포명'] || '',
                content: h['내역'],
                details: h['상세내역'],
                target: h['대상']
            });
        });
    }

    // 3.2 Group Promoted
    const promotedMap = new Map<string, any[]>();
    if (promoted && Array.isArray(promoted)) {
        promoted.forEach((p: any) => {
            const id = String(p['관리번호']);
            if (!id) return;
            const items = promotedMap.get(id) || [];
            if (!promotedMap.has(id)) promotedMap.set(id, items);
            items.push({
                id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                date: p['날짜'],
                itemName: p['물건명'],
                name: p['물건명'],
                type: p['종류'],
                amount: String(p['금액'] || '').replace(/,/g, ''),
                address: p['주소'],
                industrySector: p['물건종류'],
                isSynced: false
            });
        });
    }

    // 4. Update 'data' in customersToUpsert with History/Promoted
    customersToUpsert.forEach(c => {
        const hist = historyMap.get(c.id) || [];
        const promo = promotedMap.get(c.id) || [];

        // Assign to data
        c.data.history = hist;
        c.data.promotedProperties = promo;
    });

    // 5. Perform Upsert with complete data (ONCE)
    if (customersToUpsert.length > 0) {
        // Chunking to avoid request size limits
        const UPSERT_CHUNK_SIZE = 100;
        for (let i = 0; i < customersToUpsert.length; i += UPSERT_CHUNK_SIZE) {
            const chunk = customersToUpsert.slice(i, i + UPSERT_CHUNK_SIZE);
            const { error } = await supabaseAdmin
                .from('customers')
                .upsert(chunk, { onConflict: 'id' });

            if (error) {
                console.error('Upsert customers error:', error);
                return NextResponse.json({ error: `Failed to upsert customers: ${error.message}` }, { status: 500 });
            }
            updatedCount += chunk.length;
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
