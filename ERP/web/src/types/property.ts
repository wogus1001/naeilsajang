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
    monthlyRent?: number;
    rentUnit?: 'money' | 'percent'; // Added for toggle support
    // Updated for text input support
    maintenance?: string | number; // 관리비 (UI uses 'maintenance', not 'maintenanceFee')
    vat?: string; // 부가세 (별도/포함/Direct Input)
    maintenanceFee?: string | number; // Legacy or alternative mapping
    totalExpense?: number; // Added for auto-sum/manual override
    materialCostUnit?: 'money' | 'percent';
    royaltyUnit?: 'money' | 'percent';
    legacyId?: string; // 관리번호 (Excel import)
    [key: string]: any;
}
