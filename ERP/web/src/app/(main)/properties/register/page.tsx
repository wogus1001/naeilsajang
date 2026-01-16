"use client";

import React, { useState } from 'react';
import { Save, ArrowLeft, Search, MapPin, X, ChevronDown, ChevronUp, Star, User, FileText, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import DaumPostcodeEmbed from 'react-daum-postcode';
import { Map, MapMarker } from 'react-kakao-maps-sdk';
import styles from './page.module.css';

const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=26c1197bae99e17f8c1f3e688e22914d&libraries=services,drawing&autoload=false`;

// Industry Categories Data
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

export default function RegisterPropertyPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isBrandSearchOpen, setIsBrandSearchOpen] = useState(false);
    const [address, setAddress] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

    // Brand Search State
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    const [brandSearchResults, setBrandSearchResults] = useState<any[]>([]);
    const [isSearchingBrand, setIsSearchingBrand] = useState(false);

    // Form State
    const [category, setCategory] = useState('');
    const [sector, setSector] = useState('');
    const [industryDetail, setIndustryDetail] = useState('');
    const [operationTypes, setOperationTypes] = useState<string[]>([]);
    const [isPy, setIsPy] = useState(true);
    const [brandName, setBrandName] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);

    // Custom Categories State
    const [customCategories, setCustomCategories] = useState<any[]>([]);
    const [isCategoryInputOpen, setIsCategoryInputOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    React.useEffect(() => {
        const fetchCategories = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const companyId = user.companyId || user.company_id;
                    if (companyId) {
                        const res = await fetch(`/api/categories?companyId=${companyId}&type=industry_detail`);
                        if (res.ok) {
                            const data = await res.json();
                            setCustomCategories(data);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch custom categories:', e);
            }
        };
        fetchCategories();
    }, []);

    // Price State for Auto Calculation
    const [priceData, setPriceData] = useState({
        deposit: 0,
        premium: 0,
        briefingPrice: 0,
        monthlyRent: 0,
        maintenance: 0,
        vat: '별도',
    });

    const formatCurrency = (value: number | string) => {
        if (!value) return '0';
        return Number(value).toLocaleString();
    };

    const formatInput = (value: number | undefined | null) => {
        if (value === undefined || value === null || value === 0) return '';
        return value.toLocaleString();
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = Number(value.replace(/,/g, ''));
        setPriceData(prev => {
            let newData = { ...prev, [name]: numValue };

            // Sync Premium if Briefing Price changes (Delta Logic)
            if (name === 'briefingPrice') {
                const delta = numValue - (prev.briefingPrice || 0);
                newData.premium = (prev.premium || 0) + delta;
            }

            // Sync rentMaintenance if monthlyRent or maintenance changes
            if (name === 'monthlyRent' || name === 'maintenance') {
                const newRent = name === 'monthlyRent' ? numValue : prev.monthlyRent;
                const newMaint = name === 'maintenance' ? numValue : prev.maintenance;
                setFinancialData(fPrev => ({ ...fPrev, rentMaintenance: newRent + newMaint }));
            }

            return newData;
        });
    };

    const totalPrice = priceData.deposit + priceData.premium;

    // Financial State
    const [financialData, setFinancialData] = useState({
        monthlyRevenue: 0,
        materialCostPercent: 0,
        laborCost: 0,
        rentMaintenance: 0,
        taxUtilities: 0,
        maintenanceDepreciation: 0,
        promoMisc: 0,
    });

    const handleFinancialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = Number(value.replace(/,/g, ''));
        setFinancialData(prev => ({ ...prev, [name]: numValue }));
    };

    // Auto Calculations
    const materialCost = Math.round(financialData.monthlyRevenue * (financialData.materialCostPercent / 100));
    // rentMaintenance is now in state
    const totalExpense = financialData.laborCost + financialData.rentMaintenance + financialData.taxUtilities + financialData.maintenanceDepreciation + financialData.promoMisc + materialCost;
    const monthlyProfit = financialData.monthlyRevenue - totalExpense;
    // Yield Formula: (Monthly Profit / (Deposit + Premium)) * 100
    const investment = priceData.deposit + priceData.premium;
    const yieldPercent = investment > 0 ? (monthlyProfit / investment) * 100 : 0;

    // Franchise State
    const [franchiseData, setFranchiseData] = useState({
        hqDeposit: 0,
        franchiseFee: 0,
        educationFee: 0,

        renewal: 0,
        royalty: 0,
    });

    const handleFranchiseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFranchiseData(prev => ({ ...prev, [name]: Number(value) }));
    };

    const franchiseTotal = franchiseData.hqDeposit + franchiseData.franchiseFee + franchiseData.educationFee + franchiseData.renewal;

    // Custom Fields State
    const [operationCustomFields, setOperationCustomFields] = useState<{ label: string; value: string }[]>([]);
    const [leaseCustomFields, setLeaseCustomFields] = useState<{ label: string; value: string }[]>([]);

    const [newOperationCategory, setNewOperationCategory] = useState('');
    const [newLeaseCategory, setNewLeaseCategory] = useState('');
    const [isAddingOperationCategory, setIsAddingOperationCategory] = useState(false);
    const [isAddingLeaseCategory, setIsAddingLeaseCategory] = useState(false);

    const addCustomField = (type: 'operation' | 'lease') => {
        if (type === 'operation') {
            if (newOperationCategory.trim()) {
                setOperationCustomFields(prev => [...prev, { label: newOperationCategory, value: '' }]);
                setNewOperationCategory('');
                setIsAddingOperationCategory(false);
            }
        } else {
            if (newLeaseCategory.trim()) {
                setLeaseCustomFields(prev => [...prev, { label: newLeaseCategory, value: '' }]);
                setNewLeaseCategory('');
                setIsAddingLeaseCategory(false);
            }
        }
    };

    const handleCustomFieldChange = (type: 'operation' | 'lease', index: number, value: string) => {
        if (type === 'operation') {
            const newFields = operationCustomFields.map((field, i) =>
                i === index ? { ...field, value } : field
            );
            setOperationCustomFields(newFields);
        } else {
            const newFields = leaseCustomFields.map((field, i) =>
                i === index ? { ...field, value } : field
            );
            setLeaseCustomFields(newFields);
        }
    };

    // Section visibility state
    const [sections, setSections] = useState({
        overview: true,
        contact: true,
        price: true,
        financials: true,
        franchise: true,
        operation: true,
        lease: true,
        memo: true,
    });

    const toggleSection = (section: keyof typeof sections) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Manager State
    const [managers, setManagers] = useState<any[]>([]);
    const [selectedManager, setSelectedManager] = useState('');

    // Revenue History State (Excel Upload)
    const [revenueHistory, setRevenueHistory] = useState<any[]>([]);

    // Revenue Handlers
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['년', '월', '현금매출(만원)', '카드매출(만원)'],
            ['2024', '1', '1500', '3500'],
            ['2024', '2', '1600', '3600'],
            ['', '', '', '(*숫자만 입력해주세요)']
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "월별매출");
        XLSX.writeFile(wb, "월별매출_입력양식.xlsx");
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Skip header (row 0) and process
            const revenueData = [];
            for (let i = 1; i < data.length; i++) {
                const row: any = data[i];
                if (!row || row.length < 4 || !row[0] || !row[1]) continue; // Basic validation

                // Stop if row looks like instructions
                if (typeof row[0] === 'string' && row[0].includes('*')) continue;

                revenueData.push({
                    id: Date.now() + i, // Temporary ID
                    date: `${row[0]}-${String(row[1]).padStart(2, '0')}`,
                    year: Number(row[0]),
                    month: Number(row[1]),
                    cash: Number(row[2]) || 0,
                    card: Number(row[3]) || 0,
                    total: (Number(row[2]) || 0) + (Number(row[3]) || 0)
                });
            }
            revenueData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (revenueData.length > 0) {
                setRevenueHistory(revenueData);
                // Also update approximate monthly revenue from latest data?
                // Optional: setFinancialData(prev => ({...prev, monthlyRevenue: average...}))
                alert(`${revenueData.length}건의 매출 데이터가 로드되었습니다.`);
            } else {
                alert('유효한 데이터가 없습니다. 양식을 확인해주세요.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    React.useEffect(() => {
        const loadManagers = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setSelectedManager(user.id); // Default to current user

                    if (user.companyName) {
                        const res = await fetch(`/api/users?company=${encodeURIComponent(user.companyName)}`);
                        if (res.ok) {
                            const data = await res.json();
                            setManagers(data);
                        }
                    } else {
                        setManagers([user]);
                    }
                }
            } catch (error) {
                console.error('Failed to load managers:', error);
            }
        };
        loadManagers();
    }, []);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCategory(e.target.value);
        setSector('');
        setIndustryDetail('');
    };

    const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVal = e.target.value;
        const details = (category && INDUSTRY_DATA[category]) ? (INDUSTRY_DATA[category][newVal] || []) : [];
        setSector(newVal);
        // Auto select if no details or single detail
        setIndustryDetail(details.length === 0 ? newVal : (details.length === 1 ? details[0] : ''));
    };

    const handleOperationTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        if (checked) {
            setOperationTypes(prev => [...prev, value]);
        } else {
            setOperationTypes(prev => prev.filter(t => t !== value));
        }
    };

    const toggleAreaUnit = () => {
        // Find input
        const input = document.querySelector('input[name="area"]') as HTMLInputElement;
        if (input && input.value) {
            const val = parseFloat(input.value);
            if (isPy) {
                // Py -> m2
                input.value = (val * 3.3).toFixed(2);
            } else {
                // m2 -> Py
                input.value = (val / 3.3).toFixed(2);
            }
        }
        setIsPy(!isPy);
    };

    const addScheduleEvent = async (title: string, date: string, type: string = 'work', color: string = '#7950f2', propertyId?: string) => {
        try {
            const getUserInfo = () => {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const { id, companyName } = JSON.parse(userStr);
                    return { userId: id, companyName: companyName || '' };
                }
                return { userId: '', companyName: '' };
            };
            const { userId, companyName } = getUserInfo();

            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    date,
                    scope: 'work',
                    status: 'progress',
                    type,
                    color,
                    details: '자동 생성된 내역입니다.',
                    propertyId,
                    userId,
                    companyName
                })
            });
        } catch (error) {
            console.error('Failed to add schedule event:', error);
        }
    };

    const searchBrands = async () => {
        if (!brandSearchQuery.trim()) return;
        setIsSearchingBrand(true);
        try {
            const res = await fetch(`/api/franchise?query=${encodeURIComponent(brandSearchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setBrandSearchResults(data);
            }
        } catch (error) {
            console.error('Failed to search brands:', error);
        } finally {
            setIsSearchingBrand(false);
        }
    };

    const handleBrandSelect = (brand: any) => {
        setBrandName(brand.brandNm);

        // Auto-select category/sector if matches
        if (brand.indutyLclasNm && INDUSTRY_DATA[brand.indutyLclasNm]) {
            setCategory(brand.indutyLclasNm);
            // Wait for category state update or force it? 
            // Better to set sector directly if we know it matches.
            // But we need to check if the sector exists in the category list.
            if (brand.indutyMlsfcNm && INDUSTRY_DATA[brand.indutyLclasNm] && Object.keys(INDUSTRY_DATA[brand.indutyLclasNm]).includes(brand.indutyMlsfcNm)) {
                setSector(brand.indutyMlsfcNm);
                // Also try to set detail if possible, not enough info in brand logic usually
                setIndustryDetail('');
            } else {
                setSector('');
            }
        }

        setIsBrandSearchOpen(false);
        setBrandSearchResults([]);
        setBrandSearchQuery('');
        setBrandSearchQuery('');
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;

        const userStr = localStorage.getItem('user');
        if (!userStr) return;

        const user = JSON.parse(userStr);
        const companyId = user.companyId || user.company_id;
        const createdBy = user.id || user.userId;

        if (companyId) {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: companyId,
                    categoryType: 'industry_detail',
                    name: newCategoryName,
                    parentCategory: category, // Link to Level 1
                    subCategory: sector, // Link to Level 2
                    createdBy
                })
            });
            if (res.ok) {
                const newCat = await res.json();
                setCustomCategories([...customCategories, newCat]);
                setIndustryDetail(newCategoryName); // Auto Select
                setIsCategoryInputOpen(false);
                setNewCategoryName('');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        // Helper to get company name
        const getCompany = () => {
            const userStr = localStorage.getItem('user');
            if (userStr) return JSON.parse(userStr).companyName;
            return '';
        };

        const payload = {
            ...data,
            companyName: getCompany(), // Add company name
            managerId: selectedManager,
            managerName: managers.find(m => m.id === selectedManager)?.name || '',
            address: address,
            coordinates: coordinates,

            isFavorite: isFavorite,
            industryCategory: category,
            industrySector: sector,
            industryDetail: industryDetail,
            operationType: operationTypes.join(','), // Assuming backend takes string
            franchiseBrand: brandName,
            franchise: !!brandName,

            // Price & Financials (Calculated)
            ...priceData,
            totalPrice,
            ...financialData,
            materialCost,
            rentMaintenance: financialData.rentMaintenance,
            totalExpense,
            monthlyProfit,
            yieldPercent,

            // Franchise (Calculated)
            ...franchiseData,
            franchiseTotal,

            // Custom Fields
            operationCustomFields,
            leaseCustomFields,

            // Revenue History
            revenueHistory,
        };

        try {
            const response = await fetch('/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const result = await response.json();
                // Add to Schedule
                const scheduleTitle = `[신규] [${data.name as string}] · (${formatCurrency(totalPrice)} 만원)`;
                await addScheduleEvent(scheduleTitle, new Date().toISOString().split('T')[0], 'work', '#7950f2', result.id);

                alert('매물이 성공적으로 등록되었습니다.');
                router.push('/properties');
            } else {
                throw new Error('Failed to register');
            }
        } catch (error) {
            console.error(error);
            alert('매물 등록 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = (data: any) => {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
            if (data.bname !== '') extraAddress += data.bname;
            if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }

        setAddress(fullAddress);
        setIsSearchOpen(false);

        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.addressSearch(fullAddress, (result: any, status: any) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    setCoordinates({
                        lat: Number(result[0].y),
                        lng: Number(result[0].x),
                    });
                }
            });
        }
    };

    return (
        <div className={styles.container}>
            <Script
                src={KAKAO_SDK_URL}
                strategy="afterInteractive"
                onLoad={() => window.kakao.maps.load(() => setIsScriptLoaded(true))}
            />

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Link href="/properties" className={styles.backBtn}>
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className={styles.pageTitle}>점포 신규등록</h1>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.managerSelect}>
                        <User size={16} />
                        <select
                            name="managerId"
                            className={styles.headerSelect}
                            value={selectedManager}
                            onChange={(e) => setSelectedManager(e.target.value)}
                        >
                            <option value="">담당자 미지정</option>
                            {managers.map(mgr => (
                                <option key={mgr.id} value={mgr.id}>
                                    {mgr.name} {mgr.id === selectedManager ? '(나)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteActive : ''}`}
                        onClick={() => setIsFavorite(!isFavorite)}
                    >
                        <Star size={20} fill={isFavorite ? "#FAB005" : "none"} />
                    </button>

                    <div className={styles.divider}></div>

                    <button type="button" className={styles.cancelBtn} onClick={() => router.back()}>취소</button>
                    <button type="submit" form="property-form" className={styles.saveBtn} disabled={isLoading}>
                        <Save size={18} />
                        <span>{isLoading ? '저장 중...' : '저장하기'}</span>
                    </button>
                </div>
            </div>

            <form id="property-form" className={styles.form} onSubmit={handleSubmit}>

                {/* 1. 물건 개요 (Overview) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('overview')}>
                        <h2 className={styles.sectionTitle}>물건 개요</h2>
                        {sections.overview ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.overview && (
                        <div className={styles.sectionContent}>
                            <div className={styles.row3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>물건명 <span className={styles.required}>*</span></label>
                                    <input name="name" type="text" className={styles.input} placeholder="예: 강남역 1번출구 카페" required />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>물건등급</label>
                                    <select name="status" className={styles.select}>
                                        <option value="progress">추진</option>
                                        <option value="manage">관리</option>
                                        <option value="hold">보류</option>
                                        <option value="joint">공동</option>
                                        <option value="complete">완료</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>진행상황</label>
                                    <select name="processStatus" className={styles.select}>
                                        <option value="">선택하세요</option>
                                        <option value="계약상황">계약상황</option>
                                        <option value="계약완료">계약완료</option>
                                        <option value="금액작업">금액작업</option>
                                        <option value="광고중">광고중</option>
                                        <option value="신규입점">신규입점</option>
                                        <option value="양도양수">양도양수</option>
                                        <option value="교환물건">교환물건</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                                    <label className={styles.label}>운영형태 (중복선택 가능)</label>
                                    <div className={styles.inputGroup} style={{ flexWrap: 'wrap', gap: '8px' }}>
                                        {['직영', '풀오토', '반오토', '위탁', '본사'].map(type => {
                                            const isSelected = operationTypes.includes(type);
                                            return (
                                                <label key={type} style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '8px 16px',
                                                    borderRadius: '24px',
                                                    border: isSelected ? '1px solid #1c7ed6' : '1px solid #dee2e6',
                                                    backgroundColor: isSelected ? '#e7f5ff' : '#fff',
                                                    color: isSelected ? '#1c7ed6' : '#495057',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: isSelected ? '600' : '400',
                                                    transition: 'all 0.2s ease',
                                                    userSelect: 'none'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        value={type}
                                                        checked={isSelected}
                                                        onChange={handleOperationTypeChange}
                                                        style={{ display: 'none' }}
                                                    />
                                                    {type}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <input type="hidden" name="operationType" value={operationTypes.join(',')} />
                                </div>
                            </div>

                            <div className={styles.row3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>업태 (대분류)</label>
                                    <select value={category} onChange={handleCategoryChange} className={styles.select}>
                                        <option value="">대분류</option>
                                        {Object.keys(INDUSTRY_DATA).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>업종 (중분류)</label>
                                    <select value={sector} onChange={handleSectorChange} className={styles.select} disabled={!category}>
                                        <option value="">중분류</option>
                                        {category && Object.keys(INDUSTRY_DATA[category]).map(sec => (
                                            <option key={sec} value={sec}>{sec}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>업종 (소분류)</label>
                                    <select
                                        value={industryDetail}
                                        onChange={(e) => {
                                            if (e.target.value === '___DIRECT_INPUT___') {
                                                setIsCategoryInputOpen(true);
                                            } else {
                                                setIndustryDetail(e.target.value);
                                            }
                                        }}
                                        className={styles.select}
                                        disabled={!sector}
                                    >
                                        <option value="">소분류</option>
                                        {category && sector && INDUSTRY_DATA[category] && (
                                            INDUSTRY_DATA[category][sector]?.length > 0 ? (
                                                INDUSTRY_DATA[category][sector].map(det => (
                                                    <option key={det} value={det}>{det}</option>
                                                ))
                                            ) : (
                                                <option value={sector}>{sector}</option>
                                            )
                                        )}

                                        {/* Custom Categories */}
                                        {customCategories.filter(c =>
                                            c.parent_category === category &&
                                            c.sub_category === sector
                                        ).map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}

                                        {/* Direct Input Option */}
                                        <option value="___DIRECT_INPUT___" style={{ color: '#7950f2', fontWeight: 'bold' }}>+ 직접 입력</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>프랜차이즈 브랜드</label>
                                    <div className={styles.addressSearch}>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={brandName}
                                            readOnly
                                            placeholder="브랜드 찾기 버튼을 눌러주세요"
                                        />
                                        <button type="button" className={styles.searchBtnSmall} onClick={() => setIsBrandSearchOpen(true)}>
                                            <Search size={16} />
                                            <span>브랜드 찾기</span>
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>개업일</label>
                                    <input name="openingDate" type="date" className={styles.input} />
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>주소 <span className={styles.required}>*</span></label>
                                    <div className={styles.addressSearch}>
                                        <input type="text" className={styles.input} value={address} readOnly placeholder="주소 검색" onClick={() => setIsSearchOpen(true)} />
                                        <button type="button" className={styles.iconBtn} onClick={() => setIsSearchOpen(true)}><Search size={18} /></button>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>상세 주소</label>
                                    <input name="detailAddress" type="text" className={styles.input} placeholder="상세 주소 입력" />
                                </div>
                            </div>

                            <div className={styles.mapContainer}>
                                {coordinates && isScriptLoaded ? (
                                    <Map center={coordinates} style={{ width: "100%", height: "100%" }} level={3}>
                                        <MapMarker position={coordinates} />
                                    </Map>
                                ) : (
                                    <div className={styles.emptyMap}>
                                        <MapPin size={24} />
                                        <span>지도 위치 확인</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>위치/상권</label>
                                <input name="locationMemo" type="text" className={styles.input} placeholder="예: 역세권, 오피스 상권 등" />
                            </div>

                            <div className={styles.row3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>층수</label>
                                    <div className={styles.inputGroup} style={{ gap: '8px', alignItems: 'center' }}>
                                        <div className={styles.inputUnit}>
                                            <input name="currentFloor" type="number" className={styles.input} placeholder="해당" />
                                            <span className={styles.unit}>층</span>
                                        </div>
                                        <span style={{ color: '#868e96' }}>/</span>
                                        <div className={styles.inputUnit}>
                                            <input name="totalFloor" type="number" className={styles.input} placeholder="전체" />
                                            <span className={styles.unit}>층</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>전용면적</label>
                                    <div className={styles.inputUnit}>
                                        <input name="area" type="number" step="0.01" className={styles.input} />
                                        <button type="button" onClick={toggleAreaUnit} className={styles.unitBtn} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 8px', fontSize: '14px', fontWeight: 'bold' }}>
                                            {isPy ? '평' : '㎡'} ⇄
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>주차</label>
                                    <input name="parking" type="text" className={styles.input} placeholder="예: 가능 (1대)" />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>특징</label>
                                <input name="featureMemo" type="text" className={styles.input} placeholder="매물의 주요 특징을 간단히 메모하세요" />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>메모</label>
                                <input name="overviewMemo" type="text" className={styles.input} placeholder="기타 메모를 입력하세요" />
                            </div>
                        </div>
                    )}
                </section>

                {/* 2. 연락처 (Contact) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('contact')}>
                        <h2 className={styles.sectionTitle}>연락처 정보</h2>
                        {sections.contact ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.contact && (
                        <div className={styles.sectionContent}>
                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>임대인 (건물주)</label>
                                    <div className={styles.inputGroup}>
                                        <input name="landlordName" type="text" className={styles.input} placeholder="성명" />
                                        <input name="landlordPhone" type="text" className={styles.input} placeholder="연락처" />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>임차인 (현 사장님)</label>
                                    <div className={styles.inputGroup}>
                                        <input name="tenantName" type="text" className={styles.input} placeholder="성명" />
                                        <input name="tenantPhone" type="text" className={styles.input} placeholder="연락처" />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>업소 전화</label>
                                    <input name="storePhone" type="text" className={styles.input} placeholder="02-0000-0000" />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>기타 연락처</label>
                                    <div className={styles.inputGroup}>
                                        <input name="otherContactName" type="text" className={styles.input} placeholder="성명" />
                                        <input name="otherContactPhone" type="text" className={styles.input} placeholder="연락처" />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>연락처 메모</label>
                                <input name="contactMemo" type="text" className={styles.input} placeholder="연락처 관련 특이사항" />
                            </div>
                        </div>
                    )}
                </section>

                {/* 3. 금액 정보 (Price) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('price')}>
                        <h2 className={styles.sectionTitle}>금액 정보</h2>
                        {sections.price ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.price && (
                        <div className={styles.sectionContent}>
                            <div className={styles.row}>
                                {/* Left Column: Capital Info */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>보증금/권리금</h3>
                                    <div className={styles.field}>
                                        <label className={styles.label}>보증금</label>
                                        <div className={styles.inputUnit}>
                                            <input name="deposit" type="text" className={styles.input} placeholder="0" value={formatInput(priceData.deposit)} onChange={handlePriceChange} />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>권리금</label>
                                        <div className={styles.inputUnit}>
                                            <input name="premium" type="text" className={styles.input} placeholder="0" value={formatInput(priceData.premium)} onChange={handlePriceChange} />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>브리핑가액</label>
                                        <div className={styles.inputUnit}>
                                            <input name="briefingPrice" type="text" className={styles.input} placeholder="0" value={formatInput(priceData.briefingPrice)} onChange={handlePriceChange} />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>합계금</label>
                                        <div className={styles.inputUnit}>
                                            <input
                                                name="totalPrice"
                                                type="text"
                                                className={`${styles.input} ${styles.highlight}`}
                                                value={formatCurrency(totalPrice)}
                                                readOnly
                                            />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Rent Info */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>임대료/관리비</h3>
                                    <div className={styles.field}>
                                        <label className={styles.label}>월 임대료</label>
                                        <div className={styles.inputUnit}>
                                            <input name="monthlyRent" type="text" className={styles.input} placeholder="0" value={formatInput(priceData.monthlyRent)} onChange={handlePriceChange} />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>관리비</label>
                                        <div className={styles.inputUnit}>
                                            <input name="maintenance" type="text" className={styles.input} placeholder="0" value={formatInput(priceData.maintenance)} onChange={handlePriceChange} />
                                            <span className={styles.unit}>만원</span>
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>부가세</label>
                                        <div className={styles.inputUnit} style={{ border: 'none', background: 'transparent', padding: 0 }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                {['별도', '포함'].map(option => (
                                                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                        <input
                                                            type="radio"
                                                            name="vat"
                                                            value={option}
                                                            checked={priceData.vat === option}
                                                            onChange={(e) => setPriceData(prev => ({ ...prev, vat: e.target.value }))}
                                                        />
                                                        <span style={{ fontSize: '14px' }}>{option}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* 4. 매출/지출 (Financials) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('financials')}>
                        <h2 className={styles.sectionTitle}>매출/지출 분석</h2>
                        {sections.financials ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.financials && (
                        <div className={styles.sectionContent}>

                            {/* Revenue Excel Upload Section */}
                            <div className={styles.row} style={{ marginBottom: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8, alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 'bold' }}>월별 매출 내역 등록</h3>
                                    <p style={{ fontSize: 12, color: '#868e96', margin: 0 }}>엑셀 파일을 업로드하여 월별 매출 데이터를 일괄 등록할 수 있습니다.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                    <button type="button" className={styles.whiteBtn} onClick={handleDownloadTemplate} style={{ fontSize: 13, padding: '6px 12px' }}>
                                        양식 다운로드
                                    </button>
                                    <label className={styles.saveBtn} style={{ cursor: 'pointer', margin: 0, fontSize: 13, padding: '6px 12px', height: 'auto', backgroundColor: '#217346' }}>
                                        엑셀 업로드
                                        <input type="file" style={{ display: 'none' }} accept=".xlsx, .xls" onChange={handleExcelUpload} />
                                    </label>
                                </div>
                            </div>
                            {revenueHistory.length > 0 && (
                                <div style={{ marginBottom: 20, padding: '10px 15px', border: '1px solid #e9ecef', borderRadius: 4 }}>
                                    <div style={{ fontSize: 13, color: '#107c41', fontWeight: 'bold' }}>
                                        <span style={{ marginRight: 8 }}>✅ {revenueHistory.length}건의 매출 데이터가 준비되었습니다.</span>
                                        <span style={{ fontSize: 12, color: '#868e96', fontWeight: 'normal' }}>
                                            ( {revenueHistory[0].date} ~ {revenueHistory[revenueHistory.length - 1].date} )
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className={styles.financialContainer}>
                                {/* Left: Financial Data List */}
                                <div className={styles.financialList}>
                                    {/* Monthly Revenue */}
                                    {/* Row 1: Monthly Revenue + Labor */}
                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>월 총매출</label>
                                            <div className={styles.inputUnit}>
                                                <input name="monthlyRevenue" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.monthlyRevenue)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label}>인건비</label>
                                            <div className={styles.inputUnit}>
                                                <input name="laborCost" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.laborCost)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96', display: 'flex', justifyContent: 'flex-end' }}>
                                                {financialData.monthlyRevenue > 0 ? ((financialData.laborCost / financialData.monthlyRevenue) * 100).toFixed(1) : '0'}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Material + Rent */}
                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>재료비(%)</label>
                                            <div className={styles.inputUnit}>
                                                <input name="materialCostPercent" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.materialCostPercent)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>%</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96' }}>
                                                ({formatCurrency(materialCost)} 만원)
                                            </div>
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label}>임대관리비</label>
                                            <div className={styles.inputUnit}>
                                                <input name="rentMaintenance" value={formatInput(financialData.rentMaintenance)} type="text" className={styles.input} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96', display: 'flex', justifyContent: 'flex-end' }}>
                                                {financialData.monthlyRevenue > 0 ? ((financialData.rentMaintenance / financialData.monthlyRevenue) * 100).toFixed(1) : '0'}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Tax + Maint */}
                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>제세공과금</label>
                                            <div className={styles.inputUnit}>
                                                <input name="taxUtilities" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.taxUtilities)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96', display: 'flex', justifyContent: 'flex-end' }}>
                                                {financialData.monthlyRevenue > 0 ? ((financialData.taxUtilities / financialData.monthlyRevenue) * 100).toFixed(1) : '0'}%
                                            </div>
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label}>유지보수</label>
                                            <div className={styles.inputUnit}>
                                                <input name="maintenanceDepreciation" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.maintenanceDepreciation)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96', display: 'flex', justifyContent: 'flex-end' }}>
                                                {financialData.monthlyRevenue > 0 ? ((financialData.maintenanceDepreciation / financialData.monthlyRevenue) * 100).toFixed(1) : '0'}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Promo + Net Profit */}
                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>기타경비</label>
                                            <div className={styles.inputUnit}>
                                                <input name="promoMisc" type="text" className={styles.input} placeholder="0" value={formatInput(financialData.promoMisc)} onChange={handleFinancialChange} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#868e96', display: 'flex', justifyContent: 'flex-end' }}>
                                                {financialData.monthlyRevenue > 0 ? ((financialData.promoMisc / financialData.monthlyRevenue) * 100).toFixed(1) : '0'}%
                                            </div>
                                        </div>
                                        <div className={styles.field}>
                                            <label className={styles.label} style={{ fontWeight: 'bold' }}>월순수익</label>
                                            <div className={styles.inputUnit}>
                                                <input value={formatCurrency(monthlyProfit)} type="text" className={`${styles.input} ${styles.highlight}`} readOnly style={{ fontWeight: 'bold', color: '#f08c00' }} />
                                                <span className={styles.unit}>만원</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 5: Yield + Open Status */}
                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>수익률</label>
                                            <div className={styles.inputUnit}>
                                                <input value={yieldPercent.toFixed(2)} type="text" className={`${styles.input} ${styles.highlight}`} readOnly style={{ fontWeight: 'bold', color: '#fa5252' }} />
                                                <span className={styles.unit}>%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className={styles.financialActions}>
                                    <div className={styles.field} style={{ marginBottom: '12px' }}>
                                        <label className={styles.label}>매출오픈여부</label>
                                        <select name="revenueOpen" className={styles.select}>
                                            <option value="">선택</option>
                                            <option value="공개">공개</option>
                                            <option value="조건부공개">조건부공개</option>
                                            <option value="비공개">비공개</option>
                                            <option value="협의">협의</option>
                                        </select>
                                    </div>
                                    <div className={styles.field} style={{ marginBottom: '12px' }}>
                                        <label className={styles.label}>매출/지출 메모</label>
                                        <textarea name="revenueMemo" className={styles.textarea} rows={5} placeholder="매출 관련 특이사항"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* 5. 가맹 현황 (Franchise) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('franchise')}>
                        <h2 className={styles.sectionTitle}>가맹 현황</h2>
                        {sections.franchise ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.franchise && (
                        <div className={styles.sectionContent}>
                            <div className={styles.row3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>본사보증금</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            name="hqDeposit"
                                            type="text"
                                            className={styles.input}
                                            value={formatInput(franchiseData.hqDeposit)}
                                            onChange={handleFranchiseChange}
                                            placeholder="0"
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>가맹비</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            name="franchiseFee"
                                            type="text"
                                            className={styles.input}
                                            value={formatInput(franchiseData.franchiseFee)}
                                            onChange={handleFranchiseChange}
                                            placeholder="0"
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>교육비</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            name="educationFee"
                                            type="text"
                                            className={styles.input}
                                            value={formatInput(franchiseData.educationFee)}
                                            onChange={handleFranchiseChange}
                                            placeholder="0"
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.row3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>리뉴얼</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            name="renewal"
                                            type="text"
                                            className={styles.input}
                                            value={formatInput(franchiseData.renewal)}
                                            onChange={handleFranchiseChange}
                                            placeholder="0"
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>로열티(월)</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            name="royalty"
                                            type="text"
                                            className={styles.input}
                                            value={formatInput(franchiseData.royalty)}
                                            onChange={handleFranchiseChange}
                                            placeholder="0"
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>합계금</label>
                                    <div className={styles.inputUnit}>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            style={{ fontWeight: 'bold', color: '#15aabf', backgroundColor: '#f8f9fa' }}
                                            value={formatCurrency(franchiseTotal)}
                                            readOnly
                                        />
                                        <span className={styles.unit}>만원</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>메모</label>
                                    <input name="franchiseMemo" type="text" className={styles.input} placeholder="가맹 관련 메모를 입력하세요" />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* 6. 영업 현황 (Operation) */}
                < section className={styles.section} >
                    <div className={styles.sectionHeader} onClick={() => toggleSection('operation')}>
                        <h2 className={styles.sectionTitle}>영업 현황</h2>
                        {sections.operation ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {
                        sections.operation && (
                            <div className={styles.sectionContent}>
                                <div className={styles.row3}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>시설/인테리어</label>
                                        <input name="facilityInterior" type="text" className={styles.input} placeholder="예: 상, 중, 하 or 리모델링 필요" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>주요 고객층</label>
                                        <input name="mainCustomer" type="text" className={styles.input} placeholder="예: 20-30대 직장인" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>골든/피크타임</label>
                                        <input name="peakTime" type="text" className={styles.input} placeholder="예: 12:00 ~ 13:00" />
                                    </div>
                                </div>
                                <div className={styles.row3}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>테이블/룸 개수</label>
                                        <input name="tableCount" type="text" className={styles.input} placeholder="예: 4인석 10개" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>추천 업종</label>
                                        <input name="recommendedBusiness" type="text" className={styles.input} placeholder="예: 카페, 디저트" />
                                    </div>
                                </div>

                                {/* Custom Fields */}
                                {/* Custom Fields */}
                                {operationCustomFields.map((field, index) => (
                                    <div key={index} className={styles.field}>
                                        <label className={styles.label}>{field.label}</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={field.value}
                                            onChange={(e) => handleCustomFieldChange('operation', index, e.target.value)}
                                        />
                                    </div>
                                ))}

                                <div className={styles.field} style={{ marginTop: '12px' }}>
                                    <label className={styles.label}>메모</label>
                                    <input name="operationMemo" type="text" className={styles.input} placeholder="영업 관련 메모를 입력하세요" />
                                </div>

                                <div style={{ marginTop: '12px' }}>
                                    {isAddingOperationCategory ? (
                                        <div className={styles.inputGroup} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', flexWrap: 'nowrap', gap: 6 }}>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                placeholder="새 항목 이름"
                                                value={newOperationCategory}
                                                onChange={(e) => setNewOperationCategory(e.target.value)}
                                                style={{ flex: 1, minWidth: 0 }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexShrink: 0 }}>
                                                <button type="button" className={styles.saveBtn} onClick={() => addCustomField('operation')} style={{ width: 'auto', padding: '10px 16px', whiteSpace: 'nowrap', border: '1px solid transparent' }}>추가</button>
                                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddingOperationCategory(false)} style={{ width: 'auto', padding: '10px 16px', whiteSpace: 'nowrap' }}>취소</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" className={styles.addBtn} onClick={() => setIsAddingOperationCategory(true)}>
                                            + 카테고리 추가
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </section >

                {/* 7. 임대차 관리 (Lease) */}
                < section className={styles.section} >
                    <div className={styles.sectionHeader} onClick={() => toggleSection('lease')}>
                        <h2 className={styles.sectionTitle}>임대차 관리</h2>
                        {sections.lease ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {
                        sections.lease && (
                            <div className={styles.sectionContent}>
                                <div className={styles.row3}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>임대 기간</label>
                                        <input name="leasePeriod" type="text" className={styles.input} placeholder="예: 2년" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>임대료 변동</label>
                                        <input name="rentFluctuation" type="text" className={styles.input} placeholder="예: 5% 인상 예정" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>공부서류 하자</label>
                                        <input name="docDefects" type="text" className={styles.input} placeholder="없음" />
                                    </div>
                                </div>
                                <div className={styles.row3}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>양수도 통보</label>
                                        <input name="transferNotice" type="text" className={styles.input} placeholder="완료" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>화해조서/공증</label>
                                        <input name="settlementDefects" type="text" className={styles.input} placeholder="없음" />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>임대인 정보</label>
                                        <input name="lessorInfo" type="text" className={styles.input} placeholder="성향 등" />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>동업/권리 관계</label>
                                    <input name="partnershipRights" type="text" className={styles.input} placeholder="특이사항 없음" />
                                </div>

                                {/* Custom Fields */}
                                {/* Custom Fields */}
                                {leaseCustomFields.map((field, index) => (
                                    <div key={index} className={styles.field}>
                                        <label className={styles.label}>{field.label}</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={field.value}
                                            onChange={(e) => handleCustomFieldChange('lease', index, e.target.value)}
                                        />
                                    </div>
                                ))}

                                <div className={styles.field} style={{ marginTop: '12px' }}>
                                    <label className={styles.label}>메모</label>
                                    <input name="leaseMemo" type="text" className={styles.input} placeholder="임대차 관련 메모를 입력하세요" />
                                </div>

                                <div style={{ marginTop: '12px' }}>
                                    {isAddingLeaseCategory ? (
                                        <div className={styles.inputGroup} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', flexWrap: 'nowrap', gap: 6 }}>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                placeholder="새 항목 이름"
                                                value={newLeaseCategory}
                                                onChange={(e) => setNewLeaseCategory(e.target.value)}
                                                style={{ flex: 1, minWidth: 0 }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexShrink: 0 }}>
                                                <button type="button" className={styles.saveBtn} onClick={() => addCustomField('lease')} style={{ width: 'auto', padding: '10px 16px', whiteSpace: 'nowrap', border: '1px solid transparent' }}>추가</button>
                                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddingLeaseCategory(false)} style={{ width: 'auto', padding: '10px 16px', whiteSpace: 'nowrap' }}>취소</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" className={styles.addBtn} onClick={() => setIsAddingLeaseCategory(true)}>
                                            + 카테고리 추가
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </section >

                {/* 8. 물건메모 (Memo) */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader} onClick={() => toggleSection('memo')}>
                        <h2 className={styles.sectionTitle}>물건 메모</h2>
                        {sections.memo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {sections.memo && (
                        <div className={styles.sectionContent}>
                            <div className={styles.field} style={{ width: '100%' }}>
                                <label className={styles.label}>메모 사항</label>
                                <textarea
                                    name="memo"
                                    className={styles.textarea}
                                    placeholder="물건에 대한 상세 메모를 입력하세요..."
                                    style={{ width: '100%', minHeight: '150px', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* Bottom Save Button */}
                < div className={styles.bottomActions} style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className={styles.saveBtn} disabled={isLoading} style={{ width: '100%', padding: '16px', fontSize: '16px' }}>
                        <Save size={20} style={{ marginRight: '8px' }} />
                        <span>{isLoading ? '저장 중...' : '저장하기'}</span>
                    </button>
                </div >

            </form >

            {/* Address Search Modal */}
            {
                isSearchOpen && (
                    <div className={styles.searchModal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>주소 검색</h3>
                                <button type="button" onClick={() => setIsSearchOpen(false)}><X size={20} /></button>
                            </div>
                            <DaumPostcodeEmbed onComplete={handleComplete} autoClose={false} />
                        </div>
                    </div>
                )
            }

            {/* Brand Search Modal */}
            {
                isBrandSearchOpen && (
                    <div className={styles.searchModal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>프랜차이즈 브랜드 검색</h3>
                                <button type="button" onClick={() => setIsBrandSearchOpen(false)}><X size={20} /></button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <div className={styles.searchBox} style={{ alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="브랜드명 입력"
                                        className={styles.input}
                                        value={brandSearchQuery}
                                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                searchBrands();
                                            }
                                        }}
                                        style={{ flex: 1, minWidth: 0 }}
                                    />
                                    <button
                                        type="button"
                                        className={styles.saveBtn}
                                        onClick={searchBrands}
                                        disabled={isSearchingBrand}
                                        style={{ whiteSpace: 'nowrap', flexShrink: 0, width: 'auto' }}
                                    >
                                        {isSearchingBrand ? '검색 중...' : '검색'}
                                    </button>
                                </div>
                                <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {brandSearchResults.length > 0 ? (
                                        brandSearchResults.map((brand, index) => (
                                            <div
                                                key={index}
                                                style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                                onClick={() => handleBrandSelect(brand)}
                                            >
                                                <div style={{ fontWeight: 'bold' }}>{brand.brandNm}</div>
                                                <div style={{ fontSize: '12px', color: '#868e96' }}>
                                                    {brand.indutyLclasNm} {'>'} {brand.indutyMlsfcNm}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: '13px', color: '#868e96', textAlign: 'center' }}>
                                            {isSearchingBrand ? '검색 중입니다...' : '검색 결과가 없습니다.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Custom Category Input Modal */}
            {isCategoryInputOpen && (
                <div className={styles.searchModal}>
                    <div className={styles.modalContent} style={{ width: '300px' }}>
                        <div className={styles.modalHeader}>
                            <h3>새 업종 추가</h3>
                            <button type="button" onClick={() => setIsCategoryInputOpen(false)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: 15 }}>
                                <input
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="업종명을 입력하세요"
                                    className={styles.input}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddCategory();
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className={styles.footerBtn} style={{ backgroundColor: '#339af0', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }} onClick={handleAddCategory}>
                                    추가
                                </button>
                                <button className={styles.footerBtn} style={{ backgroundColor: '#f1f3f5', color: '#495057', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setIsCategoryInputOpen(false)}>
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
