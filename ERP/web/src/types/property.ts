export interface PriceHistoryItem {
    id: string;
    date: string;
    manager: string;
    amount: number;
    isImportant: boolean;
    details: string;
}

export interface WorkHistoryItem {
    id: string;
    date: string;
    manager: string;
    content: string;
    details: string;
    targetType: string;
    targetKeyword: string;
}

export interface RevenueItem {
    id: string;
    date: string; // YYYY-MM
    cash: number;
    card: number;
    total: number;
    details?: string;
}

export interface Property {
    id: string;
    name: string;
    status: string;
    priceHistory: PriceHistoryItem[];
    workHistory: WorkHistoryItem[];
    revenueHistory?: RevenueItem[]; // New field
    photos?: string[];
    hqDeposit?: number; // 본사보증금
    franchiseFee?: number; // 가맹비
    educationFee?: number; // 교육비
    renewal?: number; // 리뉴얼
    royalty?: number; // 로열티(월)
    industryCategory?: string; // 대분류
    industrySector?: string; // 중분류
    industryDetail?: string; // 소분류

    // Legacy / Excel Import Fields
    operationType?: string; // 운영형태 (직영/오토/반오토/특수)
    storePhone?: string; // 업소전화
    landlordName?: string; // 임대인이름
    landlordPhone?: string; // 임대인연락처
    tenantName?: string; // 임차인이름 - currently managed by managerId but this is legacy string
    tenantPhone?: string; // 임차인연락처
    otherContactName?: string; // 관리인1/기타이름
    otherContactPhone?: string; // 관리인1번호/기타연락처
    totalFloor?: string; // 총층수/전체층수
    parking?: string; // 주차
    openDate?: string; // 개업일
    interiorInfo?: string; // 시설인테리어
    mainCustomers?: string; // 주요고객층
    peakTime?: string; // 골든피크타임
    tables?: string; // 테이블룸개수
    recommendation?: string; // 추천업종
    leasePeriod?: string; // 임대기간
    rentVariation?: string; // 임대료변동
    documentFault?: string; // 공부서류하자
    transferNotice?: string; // 양수도통보
    reconciliation?: string; // 화해조서
    lessorInfo?: string; // 임대인정보
    partnership?: string; // 동업권리관계
    maintenanceFee?: number; // 관리비
    personnelExpense?: number; // 인건비
    materialExpense?: number; // 재료비
    rentMaintenanceFee?: number; // 임대관리비
    utilityFee?: number; // 제세공과금
    maintenanceCost?: number; // 유지보수감가
    otherExpenses?: number; // 홍보기타잡비
    revenueMemo?: string; // 매출오픈여부/매출지출메모
    yieldPercent?: number; // 수익률 (Explicit import)
    memo?: string; // 물건메모 (New field)
    // Add other fields as needed or use 'any' for now if structure is loose
    [key: string]: any;
}
