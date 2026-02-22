import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

// --- Constants & Helpers from Frontend (Mirrored for Backend Processing) ---

const INDUSTRY_DATA: Record<string, Record<string, string[]>> = {
    '요식업': {
        '커피': ['커피전문점', '소형커피점', '중형커피점', '대형커피점', '테이크아웃', '디저트카페'],
        '음료': ['쥬스전문점', '버블티'],
        '아이스크림빙수': ['아이스크림', '빙수전문점'],
        '분식': ['김밥전문점', '분식점', '떡볶이'],
        '치킨': ['치킨점'],
        '피자': [],
        '패스트푸드': ['패스트푸드'],
        '제과제빵': [],
        '한식': ['한식', '일반식당', '죽전문점', '비빔밥', '도시락', '고기전문점'],
        '일식': ['일식', '돈까스', '우동', '횟집', '참치전문점'],
        '중식': ['중화요리'],
        '서양식': ['레스토랑', '스파게티', '파스타', '브런치'],
        '기타외국식': ['쌀국수', '퓨전음식점'],
        '주점': ['일반주점', '소주방', '치킨호프', '이자까야', '맥주전문점', '포장마차', '퓨전주점', '와인바', 'bar', '단란주점', '유흥주점', '노래주점', '기타'],
        '기타외식': ['푸드트럭', '기타']
    },
    '서비스업': {
        '이미용': ['미용실', '네일샵', '피부관리'],
        '유아': ['키즈카페'],
        '세탁': ['세탁소'],
        '자동차': ['주차장', '세차장'],
        '스포츠': ['스크린골프', '당구장', '휘트니스', '핫요가', '댄스스포츠'],
        '오락': ['노래방', 'dvd방', '멀티방', '영화관'],
        'pc방': ['pc방'],
        '화장품': ['화장품'],
        '의류/패션': ['패션잡화', '유명의류'],
        '반려동물': ['동물용품'],
        '안경': ['안경점'],
        '기타서비스': ['사우나', '기타'],
        '운송': [],
        '이사': [],
        '인력파견': [],
        '배달': []
    },
    '유통업': {
        '종합소매점': ['판매점', '문구점', '멀티샵', '대형마트', '백화점', '대형쇼핑몰'],
        '편의점': ['편의점'],
        '(건강)식품': ['건강식품'],
        '기타도소매': ['생활용품', '쥬얼리', '도매점', '휴대폰', '대형건물', '기타'],
        '농수산물': []
    },
    '교육업': {
        '교육': ['학원', '독서실']
    },
    '부동산업': {
        '숙박': ['펜션', '캠핑장', '고시원'],
        '부동산중개': ['모델하우스'],
        '임대': ['공실']
    }
};

const findIndustryByDetail = (detailValues: string[]): { category: string, sector: string } | null => {
    for (const detail of detailValues) {
        if (!detail) continue;
        const cleanDetail = detail.trim();
        for (const [category, sectors] of Object.entries(INDUSTRY_DATA)) {
            for (const [sector, details] of Object.entries(sectors)) {
                if (details.includes(cleanDetail)) {
                    return { category, sector };
                }
                if (sector === cleanDetail) {
                    return { category, sector };
                }
            }
        }
    }
    return null;
};

// Helper: Get value from row using multiple possible keys
// Returns undefined if not found, so it can be filtered out
const getVal = (row: any, keys: string[]) => {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
            const val = String(row[key]).trim(); // Normalize to string & trim
            return val === '' ? undefined : val;
        }
    }
    return undefined;
};

// Helper: Parse Amount (remove commas, handle text)
// Returns undefined if invalid/missing so we don't overwrite with 0 incorrectly
const parseAmt = (val: any) => {
    if (!val) return undefined;
    const str = String(val).replace(/,/g, '').trim();
    if (!str) return undefined;

    // Try parsing as integer
    const num = parseInt(str, 10);
    // If it's a valid number, return it. If not, return the string.
    return isNaN(num) ? str : num;
};

// Helper: Remove undefined keys from object
const cleanObj = (obj: any) => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

// Helper: Parse Date (Excel serial or String)
const parseDate = (val: any) => {
    if (!val) return null;
    if (typeof val === 'number') {
        // Excel Serial (Excel base date: Dec 30, 1899)
        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
        return date.toISOString();
    }
    // String "2025-11-10 (월)" or "2025. 11. 10"
    const str = String(val);
    const datePart = str.split('(')[0].trim().replace(/\./g, '-');
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
};

// Start of Main Logic
async function resolveIds(legacyCompany: string | null, legacyManager: string | null, supabaseAdmin: any) {
    let companyId = null;
    let managerId = null;

    if (legacyCompany) {
        const { data: c } = await supabaseAdmin.from('companies').select('id').eq('name', legacyCompany).single();
        if (c) companyId = c.id;
    }

    if (legacyManager) {
        const email = legacyManager.includes('@') ? legacyManager : `${legacyManager}@example.com`;
        const { data: u } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
        if (u) managerId = u.id;
    }
    return { companyId, managerId };
}

// Helper to parse Python-style list string from Excel
const parsePythonList = (str: any): any[] => {
    if (!str || typeof str !== 'string') return [];
    try {
        // Replace Python's None with null, single quotes with double quotes
        let jsonStr = str.replace(/'/g, '"').replace(/None/g, 'null');
        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn('Failed to parse Python list:', str);
        return [];
    }
};

// Helper: Parse and Transform Excel Revenue List to Structured RevenueItems
const parseAndTransformRevenue = (str: any): any[] => {
    const rawList = parsePythonList(str);
    if (!rawList || rawList.length === 0) return [];

    return rawList.map((row: any) => {
        if (!Array.isArray(row) || row.length < 8) return null;

        // Date: Index 2
        const date = row[2];
        if (!date) return null;

        // Helper to safe parse amount
        const safeParse = (val: any) => {
            if (!val) return 0;
            const s = String(val).replace(/,/g, '').replace(/만원/g, '').trim();
            const n = parseInt(s, 10);
            return isNaN(n) ? 0 : n;
        };

        // Heuristic: If index 3/5 are text (like '현금매출'), they parse to 0.
        // If they are numbers, they parse to numbers.
        const cash = safeParse(row[3]);
        const card = safeParse(row[5]);
        const total = safeParse(row[7]);

        return {
            id: randomUUID(),
            date: date,
            cash: cash,
            card: card,
            total: total
        };
    }).filter(item => item !== null);
};

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        const { main = [], work = [], price = [], contracts = [], meta = {} } = body;
        const { userCompanyName, managerId } = meta;

        // 1. 기존 매물 전체 조회 (백엔드에서 Supabase까지의 통신은 413 제한 없음)
        // 413 오류는 클라이언트→Vercel 요청 크기 문제이므로, 백엔드 조회는 원래대로 유지
        const { data: allProps, error: fetchError } = await supabaseAdmin
            .from('properties')
            .select('id, data, created_at');

        if (fetchError) throw fetchError;

        const propMap = new Map<string, { id: string, data: any, created_at: string }>();
        allProps?.forEach((row: any) => {
            if (row.data && row.data['legacyId']) {
                propMap.set(String(row.data['legacyId']).trim(), row);
            } else if (row.data && row.data['관리번호']) {
                // 이전 데이터 호환을 위한 fallback
                propMap.set(String(row.data['관리번호']).trim(), row);
            }
        });

        // 2. Process Main Data (Upsert)
        let mainCount = 0;
        const upsertPayloads: any[] = [];
        const processedLegacyIds = new Set<string>(); // Track processed IDs

        // [Manager Logic] Prepare Company & Colleague Map
        let uploaderCompanyId: string | null = null;
        const managerNameMap = new Map<string, string>(); // Name -> UUID

        if (managerId) {
            // Get Uploader's Company
            const { data: uploaderProfile } = await supabaseAdmin
                .from('profiles')
                .select('company_id')
                .eq('id', managerId)
                .single();

            if (uploaderProfile?.company_id) {
                uploaderCompanyId = uploaderProfile.company_id;

                // Fetch all colleagues in the same company
                const { data: colleagues } = await supabaseAdmin
                    .from('profiles')
                    .select('id, name')
                    .eq('company_id', uploaderCompanyId);

                colleagues?.forEach((col: any) => {
                    if (col.name) {
                        const n = col.name.trim().normalize('NFC');
                        managerNameMap.set(n, col.id);
                        // Also map without spaces for fuzzy match
                        managerNameMap.set(n.replace(/\s+/g, ''), col.id);
                    }
                });
            }
        }

        const { companyId: defaultCompanyId } = await resolveIds(userCompanyName, null, supabaseAdmin);

        for (const row of main) {
            // Find ID
            let legacyIdRaw = getVal(row, ['관리번호', '번호', 'No', 'ID']);
            if (!legacyIdRaw) continue; // Skip lines without ID

            const legacyId = String(legacyIdRaw).trim();
            const existing = propMap.get(legacyId);
            const newId = existing ? existing.id : randomUUID();
            const existingCreatedAt = existing ? existing.created_at : null;

            // 매 행마다 resolveIds를 호출하면 N+1 쿼리 발생 → defaultCompanyId 재사용
            // (업체명이 다른 경우 드물게 있으나, 대부분 같은 회사이므로 성능 우선)
            const companyId = defaultCompanyId;

            // [Manager Logic] Determine Manager
            let assignedManagerId = null; // Default: Match fail -> Unassigned
            const paramManagerName = getVal(row, ['담당자', '작업자', 'Manager']);

            if (paramManagerName) {
                const cleanParams = String(paramManagerName).trim().normalize('NFC');

                // 1. Try exact match (normalized)
                if (managerNameMap.has(cleanParams)) {
                    assignedManagerId = managerNameMap.get(cleanParams);
                }
                // 2. Try match without spaces
                else {
                    const noSpace = cleanParams.replace(/\s+/g, '');
                    if (managerNameMap.has(noSpace)) {
                        assignedManagerId = managerNameMap.get(noSpace);
                    }
                }
            }

            // --- MAPPING LOGIC START ---

            // Map Industry
            const industryVal = getVal(row, ['업종', '소분류', '업종_소분류', '업종 소분류', '업종(소분류)']);
            const industryInfo = industryVal ? findIndustryByDetail([industryVal]) : null;

            // Construct Mapped Data Object (English Keys matching PropertyCard.tsx state)
            const mappedData: any = {
                legacyId: legacyId,
                name: getVal(row, ['물건명', '상호명', '이름']),
                address: getVal(row, ['지번주소', '도로명주소', '소재지', '주소', '위치상권']),
                detailAddress: getVal(row, ['상세주소', '나머지주소', '호수']), // New: Detailed Address
                lat: getVal(row, ['lat', 'latitude', '위도']),
                lng: getVal(row, ['lng', 'longitude', '경도']),

                // Status mapping
                status: getVal(row, ['상태', 'status', '물건상태', '물건등급']), // Default 'progress' handled later

                // Industry
                type: industryInfo?.category, // Don't default '기타' here if we want to preserve existing
                industryCategory: industryInfo?.category, // Explicit category field
                industrySector: industryInfo?.sector, // Explicit sector field
                industryDetail: industryInfo?.sector || industryVal,

                // Specs
                area: getVal(row, ['면적', '실면적', '평수', '전용면적', '임대면적']),
                floor: getVal(row, ['층', '층수', '해당층']),
                totalFloor: getVal(row, ['총층', '전체층']),
                currentFloor: getVal(row, ['층', '층수', '해당층']), // Aliased to floor

                // Identification
                manageId: getVal(row, ['관리ID', '관리번호', 'No', 'ID']),

                // New Fields from User Feedback
                processStatus: getVal(row, ['진행상황', '진행상태', '상태메모']),
                operationType: getVal(row, ['운영형태', '운영방식']),
                franchiseBrand: getVal(row, ['프랜차이즈', '브랜드']),
                openingDate: getVal(row, ['개업일', '오픈일']),
                parking: getVal(row, ['주차', '주차가능']),

                // --- FINANCIAL (Purple) ---
                deposit: parseAmt(getVal(row, ['보증금'])),
                monthlyRent: parseAmt(getVal(row, ['월세', '임대료', '월임대료', '월임대료_값'])),
                premium: parseAmt(getVal(row, ['권리금', '권리', '바닥권리금', '시설금'])),
                maintenance: getVal(row, ['관리비', '월관리비']),
                briefingPrice: parseAmt(getVal(row, ['브리핑가', '브리핑금액', '브리핑가액'])),
                vat: getVal(row, ['부가세', 'VAT']),
                priceMemo: getVal(row, ['금액메모', '가격메모', '금액_메모']),
                totalPrice: parseAmt(getVal(row, ['합계금', '금액_합계금', '총금액'])),

                // --- FRANCHISE (Teal) ---
                hqDeposit: parseAmt(getVal(row, ['본사보증금', '가맹보증금'])),
                franchiseFee: parseAmt(getVal(row, ['가맹비', '가맹가입비'])),
                educationFee: parseAmt(getVal(row, ['교육비', '가맹교육비'])),
                renewal: parseAmt(getVal(row, ['리뉴얼', '리뉴얼비용', '인테리어비용'])),
                royalty: parseAmt(getVal(row, ['로열티', '월로열티'])),
                franchiseMemo: getVal(row, ['가맹메모', '프랜차이즈메모', '가맹현황_메모']),

                // --- REVENUE/EXPENSE (Blue) ---
                monthlyRevenue: parseAmt(getVal(row, ['월총매출', '월매출', '매출', '월_총매출'])),
                laborCost: parseAmt(getVal(row, ['인건비', '월인건비'])),
                materialCost: parseAmt(getVal(row, ['재료비', '월재료비'])),
                rentMaintenance: parseAmt(getVal(row, ['임대관리비', '건물관리비'])),
                taxUtilities: parseAmt(getVal(row, ['제세공과금', '공과금'])),
                maintenanceDepreciation: parseAmt(getVal(row, ['유지보수', '유지관리비', '유지보수_감가'])),
                promoMisc: parseAmt(getVal(row, ['기타경비', '기타지출', '홍보기타잡비'])),
                revenueMemo: getVal(row, ['매출메모', '매출특이사항', '매출현황_메모']),
                revenueOpen: getVal(row, ['매출오픈', '매출공개', '매출오픈여부']),
                monthlyRevenueHistory: parsePythonList(getVal(row, ['월별매출현황'])), // Keep raw data
                revenueHistory: parseAndTransformRevenue(getVal(row, ['월별매출현황'])), // Structured data for main table

                // --- OPERATION STATUS (Green) ---
                facilityInterior: getVal(row, ['시설', '인테리어', '시설/인테리어', '시설상태', '시설인테리어']),
                mainCustomer: getVal(row, ['주요고객', '주요고객층', '타겟']),
                peakTime: getVal(row, ['피크타임', '피크시간', '골든피크타임']),
                tableCount: getVal(row, ['테이블', '룸', '테이블/룸', '테이블수', '테이블룸개수']),
                recommendedBusiness: getVal(row, ['추천업종', '추천']),
                operationMemo: getVal(row, ['영업메모', '운영메모', '영업관련메모', '영업현황메모']),

                // --- LEASE MANAGEMENT (Orange) ---
                leasePeriod: getVal(row, ['임대기간', '계약기간']),
                rentFluctuation: parseAmt(getVal(row, ['임대료변동', '임대료인상', '월세변동', '임대료_변동'])),
                docDefects: getVal(row, ['공부서류하자', '서류하자', '공부상하자']),
                transferNotice: getVal(row, ['양도통보', '양도양수통보', '양수도_통보']),
                settlementDefects: getVal(row, ['화해조서', '제소전화해', '화해조서공증']),
                lessorInfo: getVal(row, ['임대인정보', '임대인성향', '임대인_정보']),
                partnershipRights: getVal(row, ['동업', '권리', '동업/권리', '권리관계', '동업권리관계']),
                leaseMemo: getVal(row, ['임대차메모', '임대관련메모', '임대차권리메모']),

                // --- CONTACT & MEMOS (Pink/General) --- 
                storePhone: getVal(row, ['업소전화', '매장전화', '가게전화']),
                landlordName: getVal(row, ['임대인', '건물주', '주인', '물건주_이름']),
                landlordPhone: getVal(row, ['임대인전화', '주인번호', '물건주_번호']),
                tenantName: getVal(row, ['임차인', '점주', '임차인_이름']),
                tenantPhone: getVal(row, ['임차인전화', '점주번호', '임차인_번호']),
                otherContactName: getVal(row, ['기타이름', '기타연락처명', '연락처추가_이름']),
                otherContactPhone: getVal(row, ['기타연락처', '기타전화', '연락처추가_번호']),
                contactMemo: getVal(row, ['연락처메모', '연락처특이사항', '연락처_메모']),

                featureMemo: getVal(row, ['특징', '물건특징', '장점', 'Feature']),
                overviewMemo: getVal(row, ['메모', '상세내역', '비고', '기타', 'Note', '물건개요_메모']),
                memo: getVal(row, ['물건메모', '상세메모', 'Memo', '메모사항']),
                consultingReport: getVal(row, ['컨설팅리포트', '컨설팅제안서', '리포트']),
                videoUrls: getVal(row, ['관련영상', '영상', 'Video', '물건관련영상']) ? String(getVal(row, ['관련영상', '영상', 'Video', '물건관련영상'])).split(',').map(v => v.trim()).filter(Boolean) : [],
            };

            // Remove undefined keys so we don't overwrite existing valid data
            const cleanMapped = cleanObj(mappedData);

            // Merge with Existing Data
            const finalData = {
                ...(existing?.data || {}),
                ...cleanMapped, // Only overwrite present Excel columns

                // Explicitly preserve history/lists if they were empty in existing, or keep existing
                workHistory: existing?.data?.workHistory || [],
                priceHistory: existing?.data?.priceHistory || [],
                contractHistory: existing?.data?.contractHistory || [],
                promotedCustomers: existing?.data?.promotedCustomers || [],
                documents: existing?.data?.documents || []
            };

            // Check required defaults only if creating NEW
            if (!existing) {
                if (!finalData.status) finalData.status = 'progress';
                if (!finalData.name) finalData.name = `${finalData.address || ''} (${legacyId})`;
            }

            // --- MAPPING LOGIC END ---

            const corePayload = {
                id: newId,
                company_id: companyId || defaultCompanyId,
                manager_id: assignedManagerId, // Updated: Uses logic-based ID or null
                name: finalData.name,

                // CORE COLUMNS (MUST be populated here to be visible in frontend)
                status: finalData.status === '완료' ? 'completed' : 'progress',
                operation_type: finalData.operationType, // Populating core column
                address: finalData.address,              // Populating core column

                data: finalData,
                updated_at: new Date().toISOString(),
                // Always provide created_at. Use existing if available, else new date.
                created_at: existingCreatedAt || (getVal(row, ['등록일', '접수일']) ? new Date(String(getVal(row, ['등록일', '접수일']))).toISOString() : new Date().toISOString())
            };

            // Remove the separate if (!existing) block for created_at since it's now handled above

            upsertPayloads.push(corePayload);
            propMap.set(legacyId, { id: corePayload.id, data: finalData, created_at: corePayload.created_at }); // Update map for subsequent lookups
            processedLegacyIds.add(legacyId); // Mark as processed
            mainCount++;
        }

        if (upsertPayloads.length > 0) {
            // Deduplicate payloads by ID, keeping the last occurrence to avoid 'ON CONFLICT DO UPDATE command cannot affect row a second time'
            const uniquePayloads = Array.from(
                new Map(upsertPayloads.map(p => [p.id, p])).values()
            );

            const { error } = await supabaseAdmin.from('properties').upsert(uniquePayloads);
            if (error) throw error;
        }

        // 3. Process Work History
        // PRE-FETCH FOR SYNC: Fetch Customers & Business Cards (Scoped to Company & High Limit)
        // Note: Default Supabase limit is 1000. We bump to 10000 to cover typical small-medium biz.
        // For larger scales, we would need pagination, but this quick fix solves the "cutoff" issue.
        let custQuery = supabaseAdmin.from('customers').select('id, name, mobile');
        if (defaultCompanyId) custQuery = custQuery.eq('company_id', defaultCompanyId);
        const { data: allCustomers } = await custQuery.limit(10000);

        let cardQuery = supabaseAdmin.from('business_cards').select('id, name, company_name, mobile');
        if (defaultCompanyId) cardQuery = cardQuery.eq('company_id', defaultCompanyId);
        const { data: allBusinessCards } = await cardQuery.limit(10000);

        const customerMap = new Map<string, string>(); // Name -> ID
        if (allCustomers) {
            allCustomers.forEach((c: any) => {
                // Map by Name (Strict + NFC Normalized)
                if (c.name) customerMap.set(c.name.trim().normalize('NFC'), c.id);
                // Map by Mobile (Strict Exact Match per user request)
                // Note: The column is 'mobile' in customers table, not 'phone'.
                if (c.mobile) customerMap.set(c.mobile.trim().normalize('NFC'), c.id);
            });
        }

        const bizCardMap = new Map<string, string>(); // Name/Company -> ID
        if (allBusinessCards) {
            allBusinessCards.forEach((b: any) => {
                // Map by Name AND Company Name (Strict + NFC Normalized)
                if (b.name) bizCardMap.set(b.name.trim().normalize('NFC'), b.id);
                if (b.company_name) bizCardMap.set(b.company_name.trim().normalize('NFC'), b.id);
                // Map by Mobile (Strict Exact Match)
                if (b.mobile) bizCardMap.set(b.mobile.trim().normalize('NFC'), b.id);
            });
        }

        let workCount = 0;
        const propsToUpdate = new Map<string, any>();

        for (const row of work) {
            let legacyIdRaw = getVal(row, ['관리ID', '관리번호', 'ID']);
            const legacyId = legacyIdRaw ? String(legacyIdRaw).trim() : '';
            if (!legacyId || !propMap.has(legacyId)) continue;

            const target = propMap.get(legacyId)!;
            const currentData = propsToUpdate.get(target.id) || target.data;
            let history = currentData.workHistory || [];

            const cleanDate = getVal(row, ['날짜', '작업일']);
            const parsedDate = cleanDate ? (parseDate(cleanDate) || new Date().toISOString()) : new Date().toISOString();

            const content = getVal(row, ['내역', '작업내역', 'Content']) || '';
            const details = getVal(row, ['상세내역', 'Details']) || '';
            let targetType = (getVal(row, ['구분', 'Type']) === '명함') ? 'businessCard' : 'customer';
            let targetKeyword = getVal(row, ['관련고객', '대상']) || '';
            const manager = getVal(row, ['작업자', '담당자']) || 'Unknown';

            let targetId = '';

            // SYNC LOGIC: Resolve targetId
            if (targetKeyword) {
                let kw = String(targetKeyword).trim().normalize('NFC');

                // Strip [Type] prefix if present (e.g., "[고객] 홍길동" -> "홍길동")
                if (kw.startsWith('[')) {
                    const closeIdx = kw.indexOf(']');
                    if (closeIdx > -1) {
                        const prefix = kw.substring(0, closeIdx + 1);
                        // Optional: infer type from prefix if not explicitly set
                        if (prefix.includes('명함')) targetType = 'businessCard';
                        if (prefix.includes('고객')) targetType = 'customer';

                        kw = kw.substring(closeIdx + 1).trim();
                        targetKeyword = kw; // Update the variable to store the cleaned keyword
                    }
                }

                if (targetType === 'businessCard') {
                    if (bizCardMap.has(kw)) targetId = bizCardMap.get(kw)!;
                } else {
                    if (customerMap.has(kw)) targetId = customerMap.get(kw)!;
                }
            }

            // DEDUPLICATION LOGIC
            const isDuplicate = history.some((existing: any) => {
                // 1. Date Match (Compare YYYY-MM-DD parts)
                const d1 = existing.date ? existing.date.split('T')[0] : '';
                const d2 = parsedDate.split('T')[0];
                const dateMatch = d1 === d2;

                // 2. Content Match
                const contentMatch = (existing.content || '') === content;

                // 3. Target Match
                let targetMatch = false;
                if (existing.targetId && targetId) {
                    targetMatch = existing.targetId === targetId;
                } else {
                    const existingName = existing.targetKeyword || existing.targetName || '';
                    targetMatch = existingName === targetKeyword;
                }

                // If content+date match and NO target on both, treat as duplicate
                if (contentMatch && dateMatch && !existing.targetKeyword && !targetKeyword) {
                    return true;
                }

                return dateMatch && contentMatch && targetMatch;
            });

            if (!isDuplicate) {
                history.push({
                    id: randomUUID(),
                    date: parsedDate,
                    content,
                    details,
                    targetType,
                    targetKeyword,
                    manager,
                    targetId // Add resolved ID
                });

                // Sort by date desc
                history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                currentData.workHistory = history;
                propsToUpdate.set(target.id, currentData);
                workCount++;
            }
        }

        // 4. Process Price History
        let priceCount = 0;
        for (const row of price) {
            let legacyIdRaw = getVal(row, ['관리ID', '관리번호', 'ID']);
            const legacyId = legacyIdRaw ? String(legacyIdRaw).trim() : '';
            if (!legacyId || !propMap.has(legacyId)) continue;

            const target = propMap.get(legacyId)!;
            const currentData = propsToUpdate.get(target.id) || target.data;
            const history = currentData.priceHistory || [];

            history.push({
                id: randomUUID(),
                date: getVal(row, ['날짜', '변동일']) || new Date().toISOString().split('T')[0],
                amount: parseInt(String(getVal(row, ['변동후금액', '금액'])).replace(/,/g, '')) || 0,
                isImportant: getVal(row, ['체크', '중요']) === '체크',
                details: getVal(row, ['내역', '변동내역']) || '',
                manager: getVal(row, ['작업자', '담당자']) || 'Unknown'
            });

            currentData.priceHistory = history;
            propsToUpdate.set(target.id, currentData);
            priceCount++;
        }

        // 5. Process Contract History
        let contractCount = 0;
        for (const row of contracts) {
            let legacyIdRaw = getVal(row, ['관리ID', '관리번호', 'ID']);
            const legacyId = legacyIdRaw ? String(legacyIdRaw).trim() : '';
            if (!legacyId || !propMap.has(legacyId)) continue;

            const target = propMap.get(legacyId)!;
            const currentData = propsToUpdate.get(target.id) || target.data;
            const history = currentData.contractHistory || [];

            // Helper for number parsing
            const safeNum = (v: any) => {
                const s = String(v || '').replace(/,/g, '').trim();
                return parseInt(s, 10) || 0;
            };

            history.push({
                id: randomUUID(),
                contractDate: getVal(row, ['계약일', '날짜']) || new Date().toISOString().split('T')[0],
                type: getVal(row, ['종류', '구분']) || '매매',
                deposit: safeNum(getVal(row, ['보증금'])),
                monthlyRent: safeNum(getVal(row, ['임대료', '월세'])),
                contractorName: getVal(row, ['계약자', '이름']) || '',
                contractorPhone: getVal(row, ['전화번호', '연락처']) || '',
                expirationDate: getVal(row, ['만기일']) || '',
                premium: safeNum(getVal(row, ['권리금'])),
                details: getVal(row, ['계약정보', '비고', '상세']) || ''
            });

            currentData.contractHistory = history;
            propsToUpdate.set(target.id, currentData);
            contractCount++;
        }

        // 6. Process Target Customers
        let targetCustomerCount = 0;
        const { targetCustomers = [] } = body; // Destructure new field

        for (const row of targetCustomers) {
            let legacyIdRaw = getVal(row, ['관리ID', '관리번호', 'ID']);
            const legacyId = legacyIdRaw ? String(legacyIdRaw).trim() : '';
            if (!legacyId || !propMap.has(legacyId)) continue;

            const target = propMap.get(legacyId)!;
            const currentData = propsToUpdate.get(target.id) || target.data;
            const promotedList = currentData.promotedCustomers || [];

            // Helper for number parsing
            const safeNum = (v: any) => {
                const s = String(v || '').replace(/,/g, '').trim();
                return parseInt(s, 10) || 0;
            };

            let name = getVal(row, ['이름', '고객명', '상호']) || 'Unknown';
            let type = 'customer';
            let targetId = '';
            let contact = '';

            // 1. Prefix Stripping & Type Inference
            if (name.startsWith('[')) {
                const closeIdx = name.indexOf(']');
                if (closeIdx > -1) {
                    const prefix = name.substring(0, closeIdx + 1);
                    if (prefix.includes('명함')) type = 'businessCard';
                    if (prefix.includes('고객')) type = 'customer';
                    name = name.substring(closeIdx + 1).trim();
                }
            }

            // 2. Resolve targetId
            const kw = String(name).trim().normalize('NFC');
            // Try Business Card first if type hinted or neutral
            if (type === 'businessCard' || type === 'customer') {
                if (bizCardMap.has(kw)) {
                    targetId = bizCardMap.get(kw)!;
                    type = 'businessCard'; // Force type if found in BizCard
                } else if (customerMap.has(kw)) {
                    targetId = customerMap.get(kw)!;
                    type = 'customer';
                }
            }
            // Fallback: If not found, trust the inferred type.

            promotedList.push({
                id: randomUUID(),
                date: getVal(row, ['날짜', '접수일']) || new Date().toISOString().split('T')[0],
                name: name, // Store clean name
                type: type,
                classification: getVal(row, ['분류', '등급']) || '-',
                budget: safeNum(getVal(row, ['예산', '금액'])),
                features: getVal(row, ['특징', '메모']) || '',
                targetId: targetId || 'batch_upload', // Use found ID or placeholder
                contact: contact // Would require fetching contact from Map if we stored it, currently we only stored ID. Maybe OK to leave empty or user can edit.
            });

            currentData.promotedCustomers = promotedList;
            propsToUpdate.set(target.id, currentData);
            targetCustomerCount++;
        }

        // 5. Save History Updates
        const updatePromises = Array.from(propsToUpdate.entries()).map(async ([id, data]) => {
            return supabaseAdmin
                .from('properties')
                .update({ data, updated_at: new Date().toISOString() })
                .eq('id', id);
        });

        await Promise.all(updatePromises);

        return NextResponse.json({
            success: true,
            mainCount, // Add mainCount
            workCount,
            priceCount,
            contractCount,
            targetCustomerCount,
            processedProperties: Array.from(processedLegacyIds).map(lid => {
                const val = propMap.get(lid);
                return val ? { manageId: lid, id: val.id, name: val.data.name } : null;
            }).filter(Boolean)
        });
    } catch (error: any) {
        console.error('Batch Upload Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}

