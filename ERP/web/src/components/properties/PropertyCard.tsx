import React, { useState, useEffect } from 'react';
import styles from './PropertyCard.module.css';
import { User, Phone, MapPin, Building, DollarSign, FileText, Save, Trash2, Printer, Copy, Plus, Star, ChevronDown, ChevronUp, Search, X, Download } from 'lucide-react';
import PersonSelectorModal from './PersonSelectorModal';
import { useRouter } from 'next/navigation';
import { Map, MapMarker, MapTypeId, useKakaoLoader } from 'react-kakao-maps-sdk';
import PropertyReportTab from './PropertyReportTab';
import DaumPostcodeEmbed from 'react-daum-postcode';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ... (previous imports)
import { getSupabase } from '@/lib/supabase';

interface RevenueItem {
    id: string;
    date: string; // YYYY-MM
    cash: number;
    card: number;
    total: number;
    details?: string;
}

// ... (existing interfaces)
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

interface PropertyCardProps {
    property: any;
    onClose: () => void;
    onRefresh?: () => void;
}

interface PriceHistoryItem {
    id: string;
    date: string;
    manager: string;
    amount: number;
    isImportant: boolean;
    details: string;
}

interface WorkHistoryItem {
    id: string;
    date: string;
    manager: string;
    content: string;
    details: string;
    targetType: string;
    targetKeyword: string;
    targetId?: string; // LINKED: ID of the customer/businessCard
}

interface PropertyDocument {
    id: string;
    date: string;
    uploader: string;
    type: string; // pdf, xlsx, docx, etc.
    name: string;
    size: number;
    url?: string; // In a real app, this would be the S3/Cloud path
    path?: string; // Supabase Storage path
}



export default function PropertyCard({ property, onClose, onRefresh }: PropertyCardProps) {
    useKakaoLoader({
        appkey: "26c1197bae99e17f8c1f3e688e22914d",
        libraries: ["clusterer", "drawing", "services"],
    });
    const router = useRouter();
    const [formData, setFormData] = useState<any>(() => {
        // Safe default: If new property (no ID) and no manager set, try to default to current user
        if (!property.id && !property.managerId) {
            if (typeof window !== 'undefined') {
                try {
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        const parsed = JSON.parse(userStr);
                        const user = parsed.user || parsed;
                        if (user.id) {
                            return {
                                ...property,
                                managerId: user.id || property.managerId,
                                managerName: user.name || property.managerName
                            };
                        }
                    }
                } catch (e) {
                    console.error('Failed to load user from storage', e);
                }
            }
        }
        return property;
    });

    const [activeTab, setActiveTab] = useState('priceWork');
    const [openSections, setOpenSections] = useState({

        overview: true,
        contact: true,
        price: true,
        revenue: true,
        franchise: true,
        operation: true,
        lease: true
    });

    const [isLoading, setIsLoading] = useState(false);
    const [managers, setManagers] = useState<any[]>([]);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeMapOverlay, setActiveMapOverlay] = useState<string | null>(null);
    const [mapConstants, setMapConstants] = useState<{ [key: string]: any } | null>(null);
    const [directReportPreview, setDirectReportPreview] = useState<number>(0);
    const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });


    // Init Map Constants safely
    useEffect(() => {
        if (typeof window !== 'undefined' && window.kakao && window.kakao.maps) {
            setMapConstants({
                TERRAIN: window.kakao.maps.MapTypeId.TERRAIN,
                USE_DISTRICT: window.kakao.maps.MapTypeId.USE_DISTRICT,
                HYBRID: window.kakao.maps.MapTypeId.HYBRID
            });
        }
    }, [isLoading, isMapOpen, activeTab]); // Retry on state changes that might follow load


    // Auto-save logic
    const autoSaveProperty = async (data: any) => {
        if (data.id) {
            try {
                const res = await fetch(`/api/properties?id=${data.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) {
                    onRefresh?.();
                } else {
                    console.error('Auto-save failed');
                }
            } catch (error) {
                console.error('Failed to auto-save:', error);
            }
        }
    };

    // Fix: Map UUID to Display ID for existing properties
    useEffect(() => {
        if (managers.length > 0 && formData.managerId) {
            // Find manager where UUID matches current formData.managerId
            const matchedByUuid = managers.find(m => m.uuid === formData.managerId);

            // If matched, meaning we have a UUID (from DB) but need a Display ID (for Dropdown)
            if (matchedByUuid && matchedByUuid.id !== formData.managerId) {
                setFormData((prev: any) => ({
                    ...prev,
                    managerId: matchedByUuid.id, // Switch to Display ID (e.g., "admin")
                    managerName: matchedByUuid.name
                }));
            }
        }
    }, [managers, formData.managerId]);


    // History Popup State
    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
    const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
    const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);

    const [priceHistoryForm, setPriceHistoryForm] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        isImportant: false,
        details: ''
    });
    const [workHistoryForm, setWorkHistoryForm] = useState({
        date: new Date().toISOString().split('T')[0],
        content: '',
        details: '',
        targetType: 'customer',
        targetKeyword: '',
        targetId: '' // Initialize targetId
    });

    // Person Selector State
    const [isPersonSelectorOpen, setIsPersonSelectorOpen] = useState(false);
    const [personSelectorMode, setPersonSelectorMode] = useState<'workHistory' | 'promotedCustomer'>('workHistory');
    const [initialPersonTab, setInitialPersonTab] = useState<'customer' | 'businessCard'>('customer');

    // Contract History State
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [editingContractId, setEditingContractId] = useState<string | null>(null);
    const [contractForm, setContractForm] = useState({
        type: '매매', // 매매, 전세, 월세, 연세
        contractorName: '',
        contractorPhone: '',
        contractDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        deposit: 0,
        monthlyRent: 0,
        premium: 0,
        details: ''
    });




    const syncToPerson = async (personId: string, type: 'customer' | 'businessCard', propertyData: any) => {
        try {
            // 1. Fetch Person Data
            const endpoint = type === 'customer'
                ? `/api/customers?id=${personId}`
                : `/api/business-cards?id=${personId}`;

            const res = await fetch(endpoint);
            if (!res.ok) return;
            const personData = await res.json();

            let updatedPerson = { ...personData };
            let hasChanges = false;

            // 2. Add to Promoted Properties (if not exists)
            const currentPromoted = personData.promotedProperties || [];
            if (!currentPromoted.some((p: any) => p.id === propertyData.id)) {
                const newPromoted = {
                    id: propertyData.id,
                    name: propertyData.name,
                    status: propertyData.status,
                    type: propertyData.type || '',
                    dealType: propertyData.dealType || '',
                    price: propertyData.totalPrice || 0,
                    addedDate: new Date().toISOString().split('T')[0]
                };
                updatedPerson.promotedProperties = [...currentPromoted, newPromoted];
                hasChanges = true;
            }

            // 3. Add History
            const userStr = localStorage.getItem('user');
            let managerName = 'System';
            if (userStr) {
                const u = JSON.parse(userStr);
                managerName = (u.user || u).name || u.managerName || 'System';
            }

            const newHistory = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: new Date().toISOString().split('T')[0],
                manager: managerName,
                relatedProperty: propertyData.name,
                content: `추진물건 등록: ${propertyData.name}`,
                details: '매물카드에서 추진고객으로 등록되어 자동 연동됨',
                type: 'auto'
            };

            updatedPerson.history = [newHistory, ...(updatedPerson.history || [])];
            hasChanges = true;

            // 4. Save
            if (hasChanges) {
                const updateUrl = type === 'customer' ? '/api/customers' : '/api/business-cards';
                await fetch(updateUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedPerson)
                });
            }
        } catch (e) {
            console.error('Failed to sync person:', e);
        }
    };

    const handlePersonSelect = async (person: any, type: 'customer' | 'businessCard') => {
        const name = person.name || person.company || '';
        const phone = person.phone || '';
        const feature = person.feature || person.memo || '';

        if (personSelectorMode === 'workHistory') {
            setWorkHistoryForm(prev => ({
                ...prev,
                targetType: type,
                content: `${name} ${phone ? `(${phone})` : ''}`,
                details: feature,
                targetKeyword: name,
                targetId: person.id // STORE ID
            }));
        } else {
            // Promoted Customer Mode
            const newCustomer = {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                name: name,
                type: type, // 'customer' or 'businessCard'
                classification: person.grade || person.category || '-', // 분류
                budget: person.budget || '-', // 예산
                features: feature,
                targetId: person.id,
                contact: phone
            };

            const currentList = formData.promotedCustomers || [];

            // Check Duplicate
            if (currentList.some((c: any) => c.targetId === person.id)) {
                alert('이미 등록된 고객입니다.');
                return;
            }

            const updatedFormData = {
                ...formData,
                promotedCustomers: [...currentList, newCustomer]
            };
            setFormData(updatedFormData);
            autoSaveProperty(updatedFormData);

            // Sync to Schedule
            await addScheduleEvent(
                `[추진등록] ${name} - ${property.name}`,
                newCustomer.date,
                'work',
                '#339af0',
                property.id,
                `추진고객 등록: ${name} (${phone})`
            );

            // NEW: Sync promoted property to Person (Customer/BusinessCard) without adding work history
            await syncPromotedProperty(person.id, type, formData);
        }
        setIsPersonSelectorOpen(false);
    };

    const handleAddContract = () => {
        setEditingContractId(null);
        setContractForm({
            type: '매매',
            contractorName: '',
            contractorPhone: '',
            contractDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            deposit: 0,
            monthlyRent: 0,
            premium: 0,
            details: ''
        });
        setIsContractModalOpen(true);
    };

    const handleEditContract = (contract: any) => {
        setEditingContractId(contract.id);
        setContractForm({
            type: contract.type || '매매',
            contractorName: contract.contractorName || '',
            contractorPhone: contract.contractorPhone || '',
            contractDate: contract.contractDate || '',
            expirationDate: contract.expirationDate || '',
            deposit: contract.deposit || 0,
            monthlyRent: contract.monthlyRent || 0,
            premium: contract.premium || 0,
            details: contract.details || ''
        });
        setIsContractModalOpen(true);
    };

    const handleSaveContract = async () => {
        const newContract = {
            id: editingContractId || Date.now().toString(),
            ...contractForm
        };

        const currentList = formData.contractHistory || [];
        let updatedList;

        if (editingContractId) {
            updatedList = currentList.map((c: any) => c.id === editingContractId ? newContract : c);
        } else {
            updatedList = [...currentList, newContract];
        }

        const updatedFormData = { ...formData, contractHistory: updatedList };
        setFormData(updatedFormData);
        setIsContractModalOpen(false);
        autoSaveProperty(updatedFormData);

        // Sync to Schedule (Only for new contracts)
        if (!editingContractId) {
            await addScheduleEvent(
                `[계약] ${contractForm.contractorName} - ${property.name}`,
                contractForm.contractDate,
                'contract',
                '#ff6b6b',
                property.id,
                `계약 등록: ${contractForm.type} / 보증금 ${contractForm.deposit} / 월세 ${contractForm.monthlyRent}`
            );
        }
    };

    const handleDeleteContract = async () => {
        if (!editingContractId) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const updatedList = formData.contractHistory.filter((c: any) => c.id !== editingContractId);
        const updatedFormData = { ...formData, contractHistory: updatedList };
        setFormData(updatedFormData);
        setIsContractModalOpen(false);
        autoSaveProperty(updatedFormData);
    };

    const handleRemovePromotedCustomer = async (index: number) => {
        if (!confirm('목록에서 제거하시겠습니까?')) return;

        // Get the item to be removed to sync deletion
        const itemToRemove = formData.promotedCustomers[index];

        const updatedList = formData.promotedCustomers.filter((_: any, i: number) => i !== index);
        const updatedFormData = { ...formData, promotedCustomers: updatedList };
        setFormData(updatedFormData);
        autoSaveProperty(updatedFormData);

        // Sync Deletion
        if (itemToRemove && itemToRemove.targetId) {
            await deletePromotedPropertyFromPerson(itemToRemove.targetId, itemToRemove.type || 'customer', formData.id);
        }
    };

    // Global ESC Handler for Sequential Closing


    // Date Formatter
    const formatDate = (date: Date | string) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Date Helper for Popups
    const adjustDate = (days: number, type: 'price' | 'work') => {
        const targetForm = type === 'price' ? priceHistoryForm : workHistoryForm;
        const setTargetForm = type === 'price' ? setPriceHistoryForm : setWorkHistoryForm;

        const currentDate = new Date(targetForm.date);
        currentDate.setDate(currentDate.getDate() + days);
        const newDate = currentDate.toISOString().split('T')[0];

        setTargetForm((prev: any) => ({ ...prev, date: newDate }));
    };

    const setDateTo = (target: 'today' | 'yesterday' | 'tomorrow', type: 'price' | 'work') => {
        const setTargetForm = type === 'price' ? setPriceHistoryForm : setWorkHistoryForm;
        const date = new Date();
        if (target === 'yesterday') date.setDate(date.getDate() - 1);
        if (target === 'tomorrow') date.setDate(date.getDate() + 1);

        setTargetForm((prev: any) => ({ ...prev, date: date.toISOString().split('T')[0] }));
    };

    const handleDeletePriceHistory = async () => {
        if (!editingHistoryId) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const updatedPriceHistory = formData.priceHistory.filter((item: any) => item.id !== editingHistoryId);
        const updatedFormData = { ...formData, priceHistory: updatedPriceHistory };

        setFormData(updatedFormData);
        setIsPriceHistoryOpen(false);

        // Auto-save
        if (formData.id) {
            try {
                const res = await fetch(`/api/properties?id=${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFormData),
                });
                if (res.ok) {
                    onRefresh?.();
                } else {
                    alert('자동 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('Failed to auto-save history:', error);
                alert('자동 저장 중 오류가 발생했습니다.');
            }
        } else {
            alert('신규 등록 중인 물건입니다. 전체 저장을 눌러야 반영됩니다.');
        }
    };

    const handleAddPriceHistory = () => {
        setEditingHistoryId(null);
        // Validation for numeric fields
        const ensureNumber = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return Number(String(val).replace(/,/g, ''));
        };

        const total = ensureNumber(formData.deposit) + ensureNumber(formData.premium) + ensureNumber(formData.briefingPrice);

        setPriceHistoryForm({
            date: new Date().toISOString().split('T')[0],
            amount: total,
            isImportant: false,
            details: ''
        });
        setIsPriceHistoryOpen(true);
    };

    const handleEditPriceHistory = (item: any) => {
        setEditingHistoryId(item.id);
        setPriceHistoryForm({
            date: item.date,
            amount: item.amount,
            isImportant: item.isImportant,
            details: item.details
        });
        setIsPriceHistoryOpen(true);
    };

    const handleSavePriceHistory = async () => {
        const newItem: PriceHistoryItem = {
            id: editingHistoryId || Date.now().toString(),
            date: priceHistoryForm.date,
            manager: formData.managerName || 'Unknown',
            amount: priceHistoryForm.amount,
            isImportant: priceHistoryForm.isImportant,
            details: priceHistoryForm.details
        };

        let updatedFormData;
        const currentList = formData.priceHistory || [];

        if (editingHistoryId) {
            updatedFormData = {
                ...formData,
                priceHistory: currentList.map((item: any) => item.id === editingHistoryId ? newItem : item)
            };
        } else {
            updatedFormData = {
                ...formData,
                priceHistory: [...currentList, newItem]
            };
        }

        // Sync to Premium (Request 2)
        // New Premium = New Total - (Deposit + Briefing)
        const currentDeposit = Number(formData.deposit) || 0;
        const currentBriefing = Number(formData.briefingPrice) || 0;
        const newTotal = Number(priceHistoryForm.amount) || 0;
        const newPremium = newTotal - (currentDeposit + currentBriefing);

        updatedFormData.premium = newPremium;
        updatedFormData.totalPrice = newTotal;

        // Recalculate Yield
        const monthlyProfit = updatedFormData.monthlyProfit || 0;
        const investment = (updatedFormData.deposit || 0) + (updatedFormData.premium || 0);
        updatedFormData.yieldPercent = investment > 0 ? (monthlyProfit / investment) * 100 : 0;

        setFormData(updatedFormData);
        setIsPriceHistoryOpen(false);

        // Add to Schedule (Request 4) - Only for new items
        if (!editingHistoryId) {
            // const statusLabel = statusMap[formData.status] || formData.status || '상태미정';
            const scheduleTitle = `[금액변동] [${formData.name}] · (${formatCurrency(newTotal)} 만원)`;
            // Color: Orange (#fd7e14) for Price Change
            await addScheduleEvent(scheduleTitle, priceHistoryForm.date, 'price_change', '#fd7e14', formData.id);
        }

        // Auto-save
        if (formData.id) {
            try {
                const res = await fetch(`/api/properties?id=${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFormData),
                });
                if (res.ok) {
                    onRefresh?.();
                } else {
                    alert('자동 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('Failed to auto-save history:', error);
                alert('자동 저장 중 오류가 발생했습니다.');
            }
        } else {
            alert('신규 등록 중인 물건입니다. 전체 저장을 눌러야 반영됩니다.');
        }
    };

    const handleAddWorkHistory = () => {
        setEditingHistoryId(null);
        setWorkHistoryForm({
            date: new Date().toISOString().split('T')[0],
            content: '',
            details: '',
            targetType: 'customer',
            targetKeyword: '',
            targetId: ''
        });
        setIsWorkHistoryOpen(true);
    };

    const handleEditWorkHistory = (item: any) => {
        setEditingHistoryId(item.id);
        setWorkHistoryForm({
            date: item.date,
            content: item.content,
            details: item.details,
            targetType: item.targetType,
            targetKeyword: item.targetKeyword,
            targetId: item.targetId || ''
        });
        setIsWorkHistoryOpen(true);
    };

    const handleDeleteWorkHistory = async () => {
        if (!editingHistoryId) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const updatedWorkHistory = formData.workHistory.filter((item: any) => item.id !== editingHistoryId);
        const updatedFormData = { ...formData, workHistory: updatedWorkHistory };

        setFormData(updatedFormData);
        setIsWorkHistoryOpen(false);

        // Auto-save
        if (formData.id) {
            try {
                const res = await fetch(`/api/properties?id=${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFormData),
                });
                if (res.ok) {
                    onRefresh?.();
                    // Sync Delete to Person
                    const deletedItem = formData.workHistory.find((item: any) => item.id === editingHistoryId);
                    if (deletedItem && deletedItem.targetId) {
                        deleteWorkHistoryFromPerson(deletedItem.targetId, deletedItem.targetType || 'customer', deletedItem);
                    }
                } else {
                    alert('자동 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('Failed to auto-save history:', error);
                alert('자동 저장 중 오류가 발생했습니다.');
            }
        } else {
            alert('신규 등록 중인 물건입니다. 전체 저장을 눌러야 반영됩니다.');
        }
    };

    const deleteWorkHistoryFromPerson = async (personId: string, type: string, historyItem: any) => {
        try {
            const endpoint = type === 'customer'
                ? `/api/customers?id=${personId}`
                : `/api/business-cards?id=${personId}`;

            const res = await fetch(endpoint);
            if (!res.ok) return;
            const personData = await res.json();

            const updatedHistory = (personData.history || []).filter((h: any) => {
                let isMatch = false;
                // 1. Strict ID Match
                if (h.targetId && formData.id) {
                    isMatch = h.targetId === formData.id &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                // 2. Fallback Match (Only if targetId is missing in history item)
                if (!isMatch && !h.targetId) {
                    isMatch = h.relatedProperty === formData.name &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                return !isMatch;
            });

            if (updatedHistory.length === (personData.history || []).length) return;

            const updatedPerson = {
                ...personData,
                history: updatedHistory
            };

            const updateUrl = type === 'customer' ? '/api/customers' : '/api/business-cards';
            await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPerson)
            });
        } catch (e) {
            console.error('Failed to sync delete to person:', e);
        }
    };

    const deletePromotedPropertyFromPerson = async (personId: string, type: string, propertyId: string) => {
        try {
            const endpoint = type === 'customer'
                ? `/api/customers?id=${personId}`
                : `/api/business-cards?id=${personId}`;

            const res = await fetch(endpoint);
            if (!res.ok) return;
            const personData = await res.json();

            // Filter out the promoted property
            const updatedPromoted = (personData.promotedProperties || []).filter((p: any) => p.id !== propertyId);

            if (updatedPromoted.length === (personData.promotedProperties || []).length) return;

            const updatedPerson = {
                ...personData,
                promotedProperties: updatedPromoted
            };

            const updateUrl = type === 'customer' ? '/api/customers' : '/api/business-cards';
            await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPerson)
            });
        } catch (e) {
            console.error('Failed to sync promoted property deletion to person:', e);
        }
    };

    const syncWorkHistoryToPerson = async (personId: string, type: string, historyItem: WorkHistoryItem, propertyName: string) => {
        try {
            const endpoint = type === 'customer'
                ? `/api/customers?id=${personId}`
                : `/api/business-cards?id=${personId}`;

            const res = await fetch(endpoint);
            if (!res.ok) {
                console.error(`Sync Error: Failed to fetch person data (Status: ${res.status})`);
                return;
            }
            const personData = await res.json();

            // Create History Item for Person
            const newHistory = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: historyItem.date,
                manager: historyItem.manager,
                relatedProperty: propertyName, // LINKED PROPERTY NAME
                content: historyItem.content,
                details: historyItem.details || '',
                type: 'auto',
                targetId: formData.id // Link back to Property ID
            };

            const updatedPerson = {
                ...personData,
                history: [newHistory, ...(personData.history || [])]
            };

            const updateUrl = type === 'customer' ? '/api/customers' : '/api/business-cards';
            const putRes = await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPerson)
            });

            if (putRes.ok) {
                // Success silently
            } else {
                console.error(`Sync Error: Person Update Failed (Status: ${putRes.status})`);
            }

        } catch (e) {
            console.error('Failed to sync work history to person:', e);
            alert(`Sync Failed: ${e}`);
        }
    };



    // New function: sync promoted property to person without adding work history
    const syncPromotedProperty = async (personId: string, type: 'customer' | 'businessCard', propertyData: any) => {
        try {
            const endpoint = type === 'customer'
                ? `/api/customers?id=${personId}`
                : `/api/business-cards?id=${personId}`;
            const res = await fetch(endpoint);
            if (!res.ok) {
                console.error(`Sync Error: Failed to fetch person data (Status: ${res.status})`);
                return;
            }
            const personData = await res.json();
            const currentPromoted = personData.promotedProperties || [];
            const exists = currentPromoted.some((p: any) => p.id === propertyData.id);
            if (!exists) {
                const newPromoted = {
                    id: propertyData.id,
                    name: propertyData.name,
                    status: propertyData.status,
                    type: propertyData.type || '',
                    dealType: propertyData.dealType || '',
                    price: propertyData.totalPrice || 0,
                    addedDate: new Date().toISOString().split('T')[0]
                };
                const updatedPerson = {
                    ...personData,
                    promotedProperties: [...currentPromoted, newPromoted]
                };
                const updateUrl = type === 'customer' ? '/api/customers' : '/api/business-cards';
                await fetch(updateUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedPerson)
                });
            }
        } catch (e) {
            console.error('Failed to sync promoted property to person:', e);
        }
    };

    const handleSaveWorkHistory = async () => {
        if (!workHistoryForm.content) {
            alert('내역을 입력해주세요.');
            return;
        }

        const newItem: WorkHistoryItem = {
            id: editingHistoryId || Date.now().toString(),
            date: workHistoryForm.date,
            manager: formData.managerName || 'Unknown',
            content: workHistoryForm.content,
            details: workHistoryForm.details,
            targetType: workHistoryForm.targetType,
            targetKeyword: workHistoryForm.targetKeyword,
            targetId: (workHistoryForm as any).targetId // Access generic prop
        };

        // DEBUG - removed


        let updatedFormData;
        const currentList = formData.workHistory || [];

        if (editingHistoryId) {
            updatedFormData = {
                ...formData,
                workHistory: currentList.map((item: any) => item.id === editingHistoryId ? newItem : item)
            };
        } else {
            updatedFormData = {
                ...formData,
                workHistory: [...currentList, newItem]
            };
        }

        setFormData(updatedFormData);
        setIsWorkHistoryOpen(false);
        setEditingHistoryId(null);

        // Auto-save
        if (formData.id) {
            try {
                const res = await fetch(`/api/properties?id=${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFormData),
                });
                if (res.ok) {
                    onRefresh?.();

                    // Single Schedule Event Creation
                    // Only for NEW items (editingHistoryId is null)
                    if (!editingHistoryId) {
                        const targetId = (workHistoryForm as any).targetId;
                        const targetType = workHistoryForm.targetType;

                        let scheduleTitle = `[작업] [${formData.name}] · ${workHistoryForm.content}`;
                        let additionalProps: any = {};
                        let eventColor = '#20c997'; // Default Teal for generic work

                        if (targetId) {
                            // If linked to a person, customize the title and props
                            if (targetType === 'customer') {
                                scheduleTitle = `[고객작업] ${workHistoryForm.targetKeyword || 'Unknown'} - [${formData.name}] · ${workHistoryForm.content}`;
                                additionalProps.customerId = targetId;
                            } else if (targetType === 'businessCard') {
                                scheduleTitle = `[명함작업] ${workHistoryForm.targetKeyword || 'Unknown'} - [${formData.name}] · ${workHistoryForm.content}`;
                                additionalProps.businessCardId = targetId;
                            }
                        }

                        await addScheduleEvent(
                            scheduleTitle,
                            workHistoryForm.date,
                            'work',
                            eventColor,
                            formData.id,
                            undefined, // No specific scheduleId needed
                            additionalProps
                        );
                    }

                    // Sync to Person if targetId exists
                    if ((workHistoryForm as any).targetId) {
                        await syncWorkHistoryToPerson(
                            (workHistoryForm as any).targetId,
                            workHistoryForm.targetType,
                            newItem,
                            formData.name
                        );
                    }
                } else {
                    alert('자동 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('Failed to auto-save history:', error);
                alert('자동 저장 중 오류가 발생했습니다.');
            }
        } else {
            alert('신규 등록 중인 물건입니다. 전체 저장을 눌러야 반영됩니다.');
        }
    };

    // Address Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Area Unit State
    const [areaUnit, setAreaUnit] = useState<'pyeong' | 'm2'>('pyeong');
    const PYEONG_TO_M2 = 3.305785;

    const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow empty string for clearing input
        if (val === '') {
            setFormData((prev: any) => ({ ...prev, area: '' }));
            return;
        }

        const numVal = Number(val);
        if (isNaN(numVal)) return;

        if (areaUnit === 'pyeong') {
            // Direct update (assuming stored in Pyeong)
            setFormData((prev: any) => ({ ...prev, area: numVal }));
        } else {
            // Convert m2 input to Pyeong for storage
            // m2 = py * 3.3... -> py = m2 / 3.3...
            const pyeongVal = numVal / PYEONG_TO_M2;
            setFormData((prev: any) => ({ ...prev, area: pyeongVal }));
        }
    };

    const getDisplayArea = () => {
        const val = Number(formData.area);
        if (!val && val !== 0) return '';

        if (areaUnit === 'pyeong') {
            // If stored as Pyeong, ensure we limit decimals for display if needed, 
            // but usually raw input is fine unless it's result of calculation
            // Let's allow up to 2 decimal places for cleanliness if it's a long float
            return Math.round(val * 100) / 100;
        } else {
            // Convert to m2
            return (val * PYEONG_TO_M2).toFixed(2);
        }
    };

    // Brand Search State
    const [isBrandSearchOpen, setIsBrandSearchOpen] = useState(false);
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    const [brandSearchResults, setBrandSearchResults] = useState<any[]>([]);
    const [isSearchingBrand, setIsSearchingBrand] = useState(false);

    // Initial Empty Data for "New" mode
    const initialEmptyData = {
        name: '',
        status: '진행', // Default status
        managerId: '',
        managerName: '',
        address: '',
        addressDetail: '',
        buildingName: '',
        coordinates: { lat: 33.450701, lng: 126.570667 },
        isFavorite: false,
        area: '',
        floors: '',
        floorRange: '',
        deposit: 0,
        monthlyRent: 0,
        maintenance: 0,
        rentMaintenance: 0,
        premium: 0,
        totalPrice: 0,
        monthlyRevenue: 0,
        materialCost: 0,
        laborCost: 0,
        taxUtilities: 0,
        maintenanceDepreciation: 0,
        promoMisc: 0,
        totalExpense: 0,
        monthlyProfit: 0,
        yieldPercent: 0,
        locationMemo: '',
        featureMemo: '',
        contactMemo: '',
        memo: '',

        franchiseBrand: '',
        hqDeposit: 0,
        franchiseFee: 0,
        educationFee: 0,
        renewal: 0,
        royalty: 0,
        operationCustomFields: [],
        leaseCustomFields: []
    };

    // Custom Category State
    const [newOperationCategory, setNewOperationCategory] = useState('');
    const [newLeaseCategory, setNewLeaseCategory] = useState('');
    const [isAddingOperationCategory, setIsAddingOperationCategory] = useState(false);
    const [isAddingLeaseCategory, setIsAddingLeaseCategory] = useState(false);

    // Revenue State
    const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
    const [revenueForm, setRevenueForm] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        cash: 0,
        card: 0
    });
    const [selectedRevenueIds, setSelectedRevenueIds] = useState<string[]>([]);
    const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const photoInputRef = React.useRef<HTMLInputElement>(null);

    // Photo Handlers
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            // Check Size Limit (5MB)
            const validFiles = files.filter(file => {
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSize) {
                    alert(`파일 용량이 너무 큽니다 (5MB 제한): ${file.name}`);
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) return;

            const readers = validFiles.map(file => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') resolve(reader.result);
                        else reject('Failed to read file');
                    };
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(readers).then(results => {
                const updatedPhotos = [...(formData.photos || []), ...results];
                const updatedFormData = { ...formData, photos: updatedPhotos };

                setFormData(updatedFormData);
                if (photoInputRef.current) photoInputRef.current.value = '';

                // Auto Save
                autoSaveProperty(updatedFormData);
            });
        }
    };

    const handleDeletePhoto = (index: number) => {
        if (!window.confirm('사진을 삭제하시겠습니까?')) return;

        const updatedPhotos = formData.photos.filter((_: any, i: number) => i !== index);
        const updatedFormData = { ...formData, photos: updatedPhotos };

        setFormData(updatedFormData);
        // Auto Save
        autoSaveProperty(updatedFormData);
    };

    const handleDeleteAllPhotos = () => {
        if (!window.confirm('모든 사진을 삭제하시겠습니까?')) return;

        const updatedFormData = { ...formData, photos: [] };
        setFormData(updatedFormData);
        // Auto Save
        autoSaveProperty(updatedFormData);
    };

    const handleDownloadPhoto = (photoUrl: string, index: number) => {
        const link = document.createElement('a');
        link.href = photoUrl;
        link.download = `property-photo-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        document.body.removeChild(link);
    };

    const handleDownloadAllPhotos = async () => {
        if (!formData.photos || formData.photos.length === 0) {
            alert('다운로드할 사진이 없습니다.');
            return;
        }

        const zip = new JSZip();
        formData.photos.forEach((photo: string, index: number) => {
            // Check if photo is base64
            if (photo.startsWith('data:image')) {
                const base64Data = photo.split(',')[1];
                zip.file(`property-photo-${index + 1}.png`, base64Data, { base64: true });
            }
        });

        try {
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `property-${formData.name || 'photos'}.zip`);
        } catch (error) {
            console.error('Failed to zip photos:', error);
            alert('사진 다운로드 중 오류가 발생했습니다.');
        }
    };

    // Revenue Handlers
    // Revenue Handlers
    const handleAddRevenue = () => {
        setEditingRevenueId(null);
        setRevenueForm({
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            cash: 0,
            card: 0
        });
        setIsRevenueModalOpen(true);
    };

    const handleEditRevenue = (item: any) => {
        setEditingRevenueId(item.id);
        const [year, month] = item.date.split('-');
        setRevenueForm({
            year: Number(year),
            month: Number(month),
            cash: item.cash,
            card: item.card
        });
        setIsRevenueModalOpen(true);
    };

    const handleSaveRevenue = async () => {
        const dateStr = `${revenueForm.year}-${String(revenueForm.month).padStart(2, '0')}`;
        const currentHistory = formData.revenueHistory || [];

        // Check duplicate (exclude current editing item)
        const exists = currentHistory.find((item: any) => item.date === dateStr && item.id !== editingRevenueId);
        if (exists) {
            if (!confirm(`${dateStr} 매출 데이터가 이미 존재합니다. 덮어씌우시겠습니까?`)) return;
        }

        const cash = Number(revenueForm.cash) || 0;
        const card = Number(revenueForm.card) || 0;
        const total = cash + card;

        let newHistory;

        if (editingRevenueId) {
            // Edit existing
            newHistory = currentHistory.map((item: any) =>
                item.id === editingRevenueId ? { ...item, date: dateStr, cash, card, total } : item
            );
            // If we overwrote another date by changing date, remove the old one? 
            // The duplicate check above asked to overwrite. 
            // If "exists", we should actually merge/replace the *other* one, or just update *this* one?
            // Simple logic: If confirmed overwrite, we filter out the `exists` item (if it's different ID) and update `editingRevenueId`.
            if (exists) {
                newHistory = newHistory.filter((item: any) => item.id !== exists.id);
            }
        } else {
            // Add New
            const newItem: RevenueItem = {
                id: exists ? exists.id : Date.now().toString(), // If exists confirmed, reuse ID or overwrite? Let's just create/overwrite.
                date: dateStr,
                cash,
                card,
                total
            };

            if (exists) {
                newHistory = currentHistory.map((item: any) => item.date === dateStr ? newItem : item);
            } else {
                newHistory = [...currentHistory, newItem];
            }
        }

        // Sort by date desc
        newHistory.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const updatedFormData = { ...formData, revenueHistory: newHistory };
        setFormData(updatedFormData);
        setIsRevenueModalOpen(false);
        setEditingRevenueId(null);

        // Auto-save logic reuse
        await autoSaveProperty(updatedFormData);
    };

    const handleDeleteRevenue = async () => {
        if (selectedRevenueIds.length === 0) {
            alert('삭제할 항목을 선택해주세요.');
            return;
        }
        if (!confirm(`${selectedRevenueIds.length}건의 매출 내역을 삭제하시겠습니까?`)) return;

        const newHistory = (formData.revenueHistory || []).filter((item: any) => !selectedRevenueIds.includes(item.id));
        const updatedFormData = { ...formData, revenueHistory: newHistory };
        setFormData(updatedFormData);
        setSelectedRevenueIds([]);

        await autoSaveProperty(updatedFormData);
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws_data = [
            ['년', '월', '현금매출', '카드매출'],
            ['2024', '1', '1000', '2000'],
            ['2024', '2', '1500', '2500']
        ];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, "매출양식");
        XLSX.writeFile(wb, "월별매출등록양식.xlsx");
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
            const data = XLSX.utils.sheet_to_json(ws);

            const newItems: RevenueItem[] = [];
            data.forEach((row: any) => {
                const year = row['년'] || row['Year'];
                const month = row['월'] || row['Month'];
                const cash = Number(row['현금매출']) || 0;
                const card = Number(row['카드매출']) || 0;

                if (year && month) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}`;
                    newItems.push({
                        id: Date.now().toString() + Math.random().toString(),
                        date: dateStr,
                        cash,
                        card,
                        total: cash + card
                    });
                }
            });

            if (newItems.length > 0) {
                // Merge logic (overwrite existing dates)
                const currentHistory = formData.revenueHistory || [];
                const mergedHistory = [...currentHistory];

                newItems.forEach(newItem => {
                    const idx = mergedHistory.findIndex((item: any) => item.date === newItem.date);
                    if (idx >= 0) {
                        mergedHistory[idx] = newItem;
                    } else {
                        mergedHistory.push(newItem);
                    }
                });

                mergedHistory.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const updated = { ...formData, revenueHistory: mergedHistory };
                setFormData(updated);
                autoSaveProperty(updated);
                alert(`${newItems.length}건의 매출 데이터가 등록되었습니다.`);
            }
        };
        reader.readAsBinaryString(file);
    };



    // Manager State (existing)

    useEffect(() => {
        setFormData(property);
    }, [property]);

    // Fetch Managers
    useEffect(() => {
        const loadManagers = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const currentUser = user.user || user; // Handle wrapped 'user' object

                    if (currentUser.companyName) {
                        const res = await fetch(`/api/users?company=${encodeURIComponent(currentUser.companyName)}`);
                        if (res.ok) {
                            const data = await res.json();
                            setManagers(data);
                        }
                    } else {
                        setManagers([currentUser]);
                    }

                    // Default to current user if new property and no manager set
                    if (!property.id && !formData.managerId) {
                        setFormData((prev: any) => ({
                            ...prev,
                            managerId: currentUser.id,
                            managerName: currentUser.name
                        }));
                    }
                }
            } catch (error) {
                console.error('Failed to load managers:', error);
            }
        };
        loadManagers();
    }, []);

    // Handle ESC key to close
    useEffect(() => {
        // Only attach if Person Selector is NOT open
        if (isPersonSelectorOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Priority 1: Top-level overlays
                if (previewImage) {
                    setPreviewImage(null);
                    return;
                }
                if (isMapOpen) {
                    setIsMapOpen(false);
                    return;
                }
                if (isSearchOpen) {
                    setIsSearchOpen(false);
                    return;
                }
                if (isBrandSearchOpen) {
                    setIsBrandSearchOpen(false);
                    return;
                }

                // Priority 2: Content Modals
                if (isWorkHistoryOpen) {
                    setIsWorkHistoryOpen(false);
                    return;
                }
                if (isPriceHistoryOpen) {
                    setIsPriceHistoryOpen(false);
                    return;
                }
                if (isRevenueModalOpen) {
                    setIsRevenueModalOpen(false);
                    return;
                }

                // Priority 3: Close Property Card itself
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [
        isPersonSelectorOpen,
        previewImage,
        isMapOpen,
        isSearchOpen,
        isBrandSearchOpen,
        isWorkHistoryOpen,
        isPriceHistoryOpen,
        isRevenueModalOpen,
        onClose
    ]);


    if (!formData) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    // Handle Manager Change
    const handleManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedManager = managers.find(m => m.id === selectedId);
        setFormData((prev: any) => ({
            ...prev,
            managerId: selectedId,
            managerName: selectedManager ? selectedManager.name : ''
        }));
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const rawValue = value.replace(/,/g, '');
        if (isNaN(Number(rawValue))) return;
        const numValue = Number(rawValue);

        setFormData((prev: any) => {
            const newData = { ...prev, [name]: numValue };

            const newRent = name === 'monthlyRent' ? numValue : (prev.monthlyRent || 0);
            const newMaint = name === 'maintenance' ? numValue : (prev.maintenance || 0);
            newData.rentMaintenance = newRent + newMaint;

            // Recalculate Financials based on new rentMaintenance
            const monthlyRevenue = newData.monthlyRevenue || 0;
            const materialCost = Math.round(monthlyRevenue * ((newData.materialCostPercent || 0) / 100));
            const totalExpense = (newData.laborCost || 0) + newData.rentMaintenance + (newData.taxUtilities || 0) + (newData.maintenanceDepreciation || 0) + (newData.promoMisc || 0) + materialCost;
            newData.monthlyProfit = monthlyRevenue - totalExpense;

            const investment = (newData.deposit || 0) + (newData.premium || 0);
            newData.yieldPercent = investment > 0 ? (newData.monthlyProfit / investment) * 100 : 0;


            // Sync Premium if Briefing Price changes (Delta Logic)
            if (name === 'briefingPrice') {
                const delta = numValue - (prev.briefingPrice || 0);
                newData.premium = (prev.premium || 0) + delta;
            }

            // Auto-calculate total price (Deposit + Premium)
            if (['deposit', 'premium', 'briefingPrice'].includes(name)) {
                newData.totalPrice = (newData.deposit || 0) + (newData.premium || 0);

                // Recalculate Yield if deposit/premium changes
                const monthlyProfit = newData.monthlyProfit || 0;
                const investment = (newData.deposit || 0) + (newData.premium || 0);
                newData.yieldPercent = investment > 0 ? (monthlyProfit / investment) * 100 : 0;
            }
            return newData;
        });
    };

    // Financial Logic (Synced with Register Page)
    const handleFinancialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const rawValue = value.replace(/,/g, '');
        if (isNaN(Number(rawValue))) return;
        const numValue = Number(rawValue);

        setFormData((prev: any) => {
            const newData = { ...prev, [name]: numValue };

            const monthlyRevenue = newData.monthlyRevenue || 0;
            const materialCostPercent = newData.materialCostPercent || 0;
            const materialCost = Math.round(monthlyRevenue * (materialCostPercent / 100));
            newData.materialCost = materialCost; // Store calculated material cost

            const totalExpense = (newData.laborCost || 0) + (newData.rentMaintenance || 0) + (newData.taxUtilities || 0) + (newData.maintenanceDepreciation || 0) + (newData.promoMisc || 0) + materialCost;
            newData.monthlyProfit = monthlyRevenue - totalExpense;

            const investment = (newData.deposit || 0) + (newData.premium || 0);
            newData.yieldPercent = investment > 0 ? (newData.monthlyProfit / investment) * 100 : 0;

            return newData;
        });
    };

    const toggleFavorite = () => {
        const newData = { ...formData, isFavorite: !formData.isFavorite };
        setFormData(newData);
        autoSaveProperty(newData);
    };

    // Address Search Handler
    const handleComplete = (data: any) => {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
            if (data.bname !== '') extraAddress += data.bname;
            if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }

        setFormData((prev: any) => ({ ...prev, address: fullAddress }));
        setIsSearchOpen(false);

        // Update Map Coordinates
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.addressSearch(fullAddress, (result: any, status: any) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    setFormData((prev: any) => ({
                        ...prev,
                        coordinates: {
                            lat: Number(result[0].y),
                            lng: Number(result[0].x),
                        }
                    }));
                    setIsMapOpen(true); // Auto open map
                }
            });
        }
    };

    // Brand Search Handlers
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
        setFormData((prev: any) => ({
            ...prev,
            franchiseBrand: brand.brandNm,
            industryCategory: brand.indutyLclasNm || prev.industryCategory,
            industrySector: brand.indutyMlsfcNm || prev.industrySector
        }));
        setIsBrandSearchOpen(false);
        setBrandSearchResults([]);
        setBrandSearchQuery('');
    };

    // Custom Field Handlers
    const addCustomField = (type: 'operation' | 'lease') => {
        if (type === 'operation') {
            if (newOperationCategory.trim()) {
                const newFields = [...(formData.operationCustomFields || []), { label: newOperationCategory, value: '' }];
                setFormData({ ...formData, operationCustomFields: newFields });
                setNewOperationCategory('');
                setIsAddingOperationCategory(false);
            }
        } else {
            if (newLeaseCategory.trim()) {
                const newFields = [...(formData.leaseCustomFields || []), { label: newLeaseCategory, value: '' }];
                setFormData({ ...formData, leaseCustomFields: newFields });
                setNewLeaseCategory('');
                setIsAddingLeaseCategory(false);
            }
        }
    };

    const handleCustomFieldChange = (type: 'operation' | 'lease', index: number, value: string) => {
        if (type === 'operation') {
            const newFields = [...formData.operationCustomFields];
            newFields[index].value = value;
            setFormData({ ...formData, operationCustomFields: newFields });
        } else {
            const newFields = [...formData.leaseCustomFields];
            newFields[index].value = value;
            setFormData({ ...formData, leaseCustomFields: newFields });
        }
    };

    const formatCurrency = (value: number | string) => {
        if (!value) return '0';
        return Number(value).toLocaleString();
    };

    const formatInput = (value: number | undefined | null) => {
        if (value === undefined || value === null || value === 0 || Number.isNaN(value)) return '';
        return value.toLocaleString();
    };

    const addScheduleEvent = async (title: string, date: string, type: string = 'work', color: string = '#7950f2', propertyId?: string, details?: string, additionalProps: any = {}) => {
        try {
            const getUserInfo = () => {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed; // Handle wrapped 'user' object
                    return { userId: user.id, companyName: user.companyName || '' };
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
                    status: 'completed',
                    type,
                    color,
                    details: details || '자동 생성된 내역입니다.',
                    propertyId,
                    userId,
                    companyName,
                    ...additionalProps // Merge additional props (customerId, etc.)
                })
            });
        } catch (error) {
            console.error('Failed to add schedule event:', error);
        }
    };

    const handleSave = async () => {
        if (!window.confirm('저장하시겠습니까?')) return;
        setIsLoading(true);
        try {
            const isNew = !formData.id;
            const method = isNew ? 'POST' : 'PUT';
            const url = isNew ? '/api/properties' : `/api/properties?id=${formData.id}`;

            // Auto-add Price History if changed (Request 3)
            const lastHistory = formData.priceHistory && formData.priceHistory.length > 0
                ? formData.priceHistory[formData.priceHistory.length - 1]
                : null;

            const currentTotal = Number(formData.totalPrice) || 0;
            const lastTotal = lastHistory ? Number(lastHistory.amount) : -1; // -1 to force add if no history

            let finalFormData = { ...formData };

            // Ensure companyName is present for data isolation
            if (!finalFormData.companyName) {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed; // Handle wrapped 'user' object
                    finalFormData.companyName = user.companyName;
                }
            }

            if (currentTotal !== lastTotal) {
                const newHistoryItem: PriceHistoryItem = {
                    id: Date.now().toString(),
                    date: new Date().toISOString().split('T')[0],
                    manager: formData.managerName || 'Unknown',
                    amount: currentTotal,
                    isImportant: false,
                    details: isNew ? '신규 등록 (자동저장)' : '금액 정보 수정 (자동저장)'
                };
                const newHistory = [...(formData.priceHistory || []), newHistoryItem];
                finalFormData.priceHistory = newHistory;

                // Moved addScheduleEvent logic to after success response
                // ...
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalFormData),
            });

            if (res.ok) {
                const savedData = await res.json();
                alert('저장되었습니다.');

                // Update local state with saved data
                setFormData(savedData);

                // Add Schedule Event AFTER Save (so we have ID)
                if (currentTotal !== lastTotal) {
                    const statusMap: Record<string, string> = {
                        'progress': '진행',
                        'manage': '관리',
                        'hold': '보류',
                        'joint': '공동',
                        'complete': '완료'
                    };

                    const statusText = statusMap[savedData.status] || '진행';
                    const eventTitle = isNew
                        ? `[신규] [${savedData.name || '무명'}] · (${formatCurrency(currentTotal)} 만원)`
                        : `[금액변동] [${savedData.name}] · (${formatCurrency(currentTotal)} 만원)`;

                    // Colors: New=#7950f2 (Purple), PriceChange=#fd7e14 (Orange)
                    const eventColor = isNew ? '#7950f2' : '#fd7e14';

                    await addScheduleEvent(
                        eventTitle,
                        new Date().toISOString().split('T')[0],
                        isNew ? 'work' : 'price_change', // Differentiate type if needed
                        eventColor,
                        savedData.id // Use the confirmed ID
                    );
                }

                // Notify parent list to refresh immediately
                if (onRefresh) {
                    onRefresh();
                }
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to save property:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!formData.id) {
            alert('저장되지 않은 물건입니다.');
            return;
        }
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/properties?id=${formData.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                alert('삭제되었습니다.');
                if (onRefresh) onRefresh();
                onClose();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 4000); // 4 seconds total (matches animation)
    };

    const handleNew = () => {
        if (!window.confirm('작성 중인 내용이 초기화됩니다. 신규 물건을 작성하시겠습니까?')) return;

        const emptyData = {
            name: '',
            status: 'progress',
            priceHistory: [],
            workHistory: [],
            managerId: '',
            managerName: ''
        };

        // Inject company info and manager info
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const parsed = JSON.parse(userStr);
            const user = parsed.user || parsed; // Handle wrapped 'user' object
            (emptyData as any).companyName = user.companyName;
            (emptyData as any).managerId = user.id;
            (emptyData as any).managerName = user.name;
        }

        setFormData(emptyData);
    };

    const handleCopy = async () => {
        if (!window.confirm('현재 물건을 복사하여 새로운 물건을 생성하시겠습니까?')) return;
        setIsLoading(true);
        try {
            // Clone formData and modify for new entry
            const { id, ...rest } = formData;
            const newProperty = {
                ...rest,
                name: `${formData.name} (복사본)`,
                createdAt: new Date().toISOString(),
            };

            // Ensure companyName is present check
            if (!newProperty.companyName) {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed; // Handle wrapped 'user' object
                    newProperty.companyName = user.companyName;
                }
            }

            const res = await fetch('/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProperty),
            });

            if (res.ok) {
                const createdProperty = await res.json();

                // Add to Schedule (New Property from Copy)
                const totalPrice = (createdProperty.deposit || 0) + (createdProperty.premium || 0) + (createdProperty.briefingPrice || 0);
                const scheduleTitle = `[신규] [${createdProperty.name}] · (${formatCurrency(totalPrice)} 만원)`;
                await addScheduleEvent(scheduleTitle, new Date().toISOString().split('T')[0], 'work', '#7950f2', createdProperty.id);

                alert('물건이 복사되었습니다.');
                if (onRefresh) onRefresh();
                onClose();
            } else {
                alert('복사에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // Document State & Handlers
    const docInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

    // Updated Interface in implementation (needs to be consistent with top of file, but here we modify usage)
    // IMPORTANT: Ideally I should update the interface definition at the top of the file too.
    // However, since I am replacing a block in the middle, I cannot easily reach the top interface definition in the same tool call without reading it all specifically.
    // TypeScript might complain if I use 'path' property without updating interface.
    // I will try to use 'any' casting or rely on the previous ViewFile showing I can maybe reach it? 
    // Wait, the interface is at line 105. I should probably update that in a separate call or hope TS is lenient/inferred.
    // Re-reading: The replacement target is lines 1892-1956.
    // The Interface update is necessary. I will handle Interface update in a separate MultiReplace or just cast to any for now to ensure runtime works, then cleanup.
    // Actually, I can allow implicit typing or just cast `newDocs` item.

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true); // Show loading state
        const newDocs: PropertyDocument[] = [];
        const maxSize = 50 * 1024 * 1024; // 50MB
        const supabase = getSupabase();

        const userStr = localStorage.getItem('user');
        let userName = 'Unknown';
        if (userStr) {
            const user = JSON.parse(userStr);
            userName = (user.user || user).name || 'Unknown'; // Simplified
        }

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > maxSize) {
                    alert(`파일 '${file.name}'의 용량이 50MB를 초과하여 제외됩니다.`);
                    continue;
                }

                const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';

                // 1. Upload to Supabase Storage
                // Path: properties/{propertyId}/{timestamp}_{filename}
                const timestamp = Date.now();
                // Sanitize filename to avoid weird character issues
                const sanitizedName = file.name.replace(/[^\x00-\x7F]/g, "_");
                const filePath = `properties/${property.id || 'temp'}/${timestamp}_${sanitizedName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('property-documents')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    alert(`Upload failed for ${file.name}: ${uploadError.message}`);
                    continue;
                }

                // 2. Get Public URL
                const { data: urlData } = supabase.storage
                    .from('property-documents')
                    .getPublicUrl(filePath);

                // 3. Create Document Metadata
                newDocs.push({
                    id: timestamp.toString() + Math.random().toString().substr(2, 5),
                    date: new Date().toISOString().split('T')[0],
                    uploader: userName,
                    type: ext,
                    name: file.name,
                    size: file.size,
                    url: urlData.publicUrl,
                    path: filePath // Store path for deletion
                } as PropertyDocument);
            }

            if (newDocs.length > 0) {
                const currentDocs = formData.documents || [];
                const updatedDocs = [...newDocs, ...currentDocs];
                const updatedFormData = { ...formData, documents: updatedDocs };
                setFormData(updatedFormData);
                await autoSaveProperty(updatedFormData);
                alert(`${newDocs.length}개의 문서가 등록되었습니다.`);
            }
        } catch (error) {
            console.error('Doc upload process error:', error);
            alert('문서 업로드 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            if (docInputRef.current) docInputRef.current.value = '';
        }
    };

    const handleDeleteDocuments = async () => {
        if (selectedDocIds.length === 0) {
            alert('삭제할 문서를 선택해주세요.');
            return;
        }
        if (!confirm(`${selectedDocIds.length}개의 문서를 삭제하시겠습니까?`)) return;

        setIsLoading(true);
        const supabase = getSupabase();

        try {
            const currentDocs = formData.documents || [];

            // 1. Find files to delete from Storage (those with 'path')
            const docsToDelete = currentDocs.filter((doc: any) => selectedDocIds.includes(doc.id));
            const pathsToDelete = docsToDelete
                .filter((doc: any) => doc.path)
                .map((doc: any) => doc.path);

            if (pathsToDelete.length > 0) {
                const { error: deleteError } = await supabase.storage
                    .from('property-documents')
                    .remove(pathsToDelete);

                if (deleteError) {
                    console.error('Storage delete error:', deleteError);
                    // Decide whether to stop or continue. Usually safe to continue removing metadata.
                    // alert('Error deleting files from storage, but metadata will be removed.');
                }
            }

            // 2. Remove from State
            const updatedDocs = currentDocs.filter((doc: any) => !selectedDocIds.includes(doc.id));
            const updatedFormData = { ...formData, documents: updatedDocs };

            setFormData(updatedFormData);
            setSelectedDocIds([]);
            await autoSaveProperty(updatedFormData);
        } catch (error) {
            console.error('Delete docs error:', error);
            alert('문서 삭제 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFranchiseChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const val = e.target.value.replace(/,/g, '');
        if (val === '') {
            setFormData((prev: any) => ({ ...prev, [field]: 0 }));
            return;
        }
        if (isNaN(Number(val))) return;
        setFormData((prev: any) => ({ ...prev, [field]: Number(val) }));
    };

    const handleMultiSelect = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const { value, checked } = e.target;
        setFormData((prev: any) => {
            const currentStr = prev[field] || '';
            const currentArr = currentStr ? currentStr.split(',').map((s: string) => s.trim()) : [];

            let newArr;
            if (checked) {
                if (!currentArr.includes(value)) newArr = [...currentArr, value];
                else newArr = currentArr;
            } else {
                newArr = currentArr.filter((item: string) => item !== value);
            }

            return { ...prev, [field]: newArr.join(', ') };
        });
    };

    const getDocIcon = (type: string) => {
        const t = type.toLowerCase();
        if (['pdf'].includes(t)) return <span style={{ backgroundColor: '#ff6b6b', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>PDF</span>;
        if (['xls', 'xlsx', 'csv'].includes(t)) return <span style={{ backgroundColor: '#217346', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>EXCEL</span>;
        if (['doc', 'docx'].includes(t)) return <span style={{ backgroundColor: '#2b579a', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>WORD</span>;
        if (['ppt', 'pptx'].includes(t)) return <span style={{ backgroundColor: '#d24726', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>PPT</span>;
        if (['jpg', 'png', 'jpeg', 'gif'].includes(t)) return <span style={{ backgroundColor: '#1098ad', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>IMG</span>;
        if (['zip', 'rar', '7z'].includes(t)) return <span style={{ backgroundColor: '#fcc419', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>ZIP</span>;
        return <span style={{ backgroundColor: '#868e96', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>ETC</span>;
    };

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className={styles.cardContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        {formData.processStatus && (
                            <span style={{
                                backgroundColor: '#7950f2',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>
                                {formData.processStatus}
                            </span>
                        )}
                    </div>
                    <input
                        name="name"
                        className={styles.titleInput}
                        value={formData.name || ''}
                        onChange={handleChange}
                        placeholder="물건명"
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginRight: '20px' }}>
                    <div
                        onClick={toggleFavorite}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', marginRight: '8px' }}
                    >
                        <Star
                            size={20}
                            fill={formData.isFavorite ? "#fab005" : "none"}
                            color={formData.isFavorite ? "#fab005" : "#adb5bd"}
                        />
                    </div>
                    <div className={styles.managerInfo}>
                        <User size={14} />
                        <select
                            name="managerId"
                            value={formData.managerId || ''}
                            onChange={handleManagerChange}
                            className={styles.managerSelect}
                        >
                            <option value="">담당자 미지정</option>
                            {managers.map(mgr => (
                                <option key={mgr.id} value={mgr.id}>
                                    {mgr.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div >

            <div className={styles.mainLayout}>
                {/* Left Side: Property Details Form (Table Style) */}
                <div className={styles.leftPanel}>

                    {/* 1. 물건개요 (Overview) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            onClick={() => toggleSection('overview')}
                            style={{ cursor: 'pointer' }}
                        >물<br />건<br />개<br />요</div>
                        {openSections.overview && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>물건명</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="name" className={styles.input} value={formData.name || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>업종</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                                                {/* Level 1: Industry Category */}
                                                <select
                                                    name="industryCategory"
                                                    className={styles.select}
                                                    value={formData.industryCategory || ''}
                                                    onChange={(e) => {
                                                        setFormData((prev: any) => ({
                                                            ...prev,
                                                            industryCategory: e.target.value,
                                                            industrySector: '', // Reset Level 2
                                                            industryDetail: '' // Reset Level 3
                                                        }));
                                                    }}
                                                >
                                                    <option value="">대분류</option>
                                                    {Object.keys(INDUSTRY_DATA).map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>

                                                {/* Level 2: Industry Sector (Category) */}
                                                <select
                                                    name="industrySector"
                                                    className={styles.select}
                                                    value={formData.industrySector || ''}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        const details = (formData.industryCategory && INDUSTRY_DATA[formData.industryCategory])
                                                            ? (INDUSTRY_DATA[formData.industryCategory][newVal] || [])
                                                            : [];
                                                        setFormData((prev: any) => ({
                                                            ...prev,
                                                            industrySector: newVal,
                                                            // Auto select if no details (use sector) or single detail (use detail)
                                                            industryDetail: details.length === 0 ? newVal : (details.length === 1 ? details[0] : '')
                                                        }));
                                                    }}
                                                    disabled={!formData.industryCategory}
                                                >
                                                    <option value="">중분류</option>
                                                    {formData.industryCategory && Object.keys(INDUSTRY_DATA[formData.industryCategory] || {}).map(sec => (
                                                        <option key={sec} value={sec}>{sec}</option>
                                                    ))}
                                                </select>

                                                {/* Level 3: Industry Detail */}
                                                <select
                                                    name="industryDetail"
                                                    className={styles.select}
                                                    value={formData.industryDetail || ''}
                                                    onChange={handleChange}
                                                    disabled={!formData.industrySector || !formData.industryCategory || !INDUSTRY_DATA[formData.industryCategory] || (INDUSTRY_DATA[formData.industryCategory][formData.industrySector]?.length === 0)}
                                                    style={(!formData.industrySector || !formData.industryCategory || !INDUSTRY_DATA[formData.industryCategory] || (INDUSTRY_DATA[formData.industryCategory][formData.industrySector]?.length === 0)) ? { backgroundColor: '#e9ecef' } : {}}
                                                >
                                                    <option value="">소분류</option>
                                                    {/* If no details, show the category name as option or simple hidden? User said "auto select". */}
                                                    {formData.industryCategory && formData.industrySector && INDUSTRY_DATA[formData.industryCategory] && (
                                                        (INDUSTRY_DATA[formData.industryCategory][formData.industrySector]?.length > 0) ? (
                                                            INDUSTRY_DATA[formData.industryCategory][formData.industrySector].map(det => (
                                                                <option key={det} value={det}>{det}</option>
                                                            ))
                                                        ) : (
                                                            // If empty details, show the selected sector as the only option (auto-selected)
                                                            <option value={formData.industrySector}>{formData.industrySector}</option>
                                                        )
                                                    )}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>물건등급</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {['추진', '관리', '보류', '공동', '완료'].map(status => (
                                                    <label key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                        <input
                                                            type="radio"
                                                            name="status"
                                                            value={status === '추진' ? 'progress' : status === '관리' ? 'manage' : status === '보류' ? 'hold' : status === '공동' ? 'joint' : 'complete'}
                                                            checked={formData.status === (status === '추진' ? 'progress' : status === '관리' ? 'manage' : status === '보류' ? 'hold' : status === '공동' ? 'joint' : 'complete')}
                                                            onChange={handleChange}
                                                        />
                                                        {status}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>진행상황</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                {['계약상황', '계약완료', '금액작업', '광고중', '신규입점', '양도양수', '교환물건'].map(item => (
                                                    <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                                        <input
                                                            type="radio"
                                                            name="processStatus"
                                                            value={item}
                                                            checked={formData.processStatus === item}
                                                            onChange={handleChange}
                                                        />
                                                        {item}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>운영형태</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {['직영', '풀오토', '반오토', '위탁', '본사'].map(type => (
                                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                        <input
                                                            type="checkbox"
                                                            name="operationType"
                                                            value={type}
                                                            checked={formData.operationType?.includes(type)}
                                                            onChange={(e) => handleMultiSelect(e, 'operationType')}
                                                        />
                                                        {type}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>소재지</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                            <div style={{ display: 'flex', width: '100%', gap: 4 }}>
                                                <input name="address" className={styles.input} value={formData.address || ''} readOnly onClick={() => setIsSearchOpen(true)} placeholder="주소 검색" />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSearchOpen(true)}
                                                    className={styles.smallBtn}
                                                >
                                                    <Search size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMapOpen(!isMapOpen)}
                                                    className={styles.smallBtn}
                                                    style={{ width: 'auto', whiteSpace: 'nowrap' }}
                                                >
                                                    {isMapOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 지도
                                                </button>
                                            </div>
                                            {isMapOpen && formData.coordinates && (
                                                <div style={{ width: '100%', height: '200px', marginTop: 4, border: '1px solid #dee2e6' }}>
                                                    <Map
                                                        center={{ lat: formData.coordinates.lat, lng: formData.coordinates.lng }}
                                                        style={{ width: "100%", height: "100%" }}
                                                        level={3}
                                                    >
                                                        <MapMarker position={{ lat: formData.coordinates.lat, lng: formData.coordinates.lng }} />
                                                    </Map>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>상세주소</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="detailAddress" className={styles.input} value={formData.detailAddress || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>면적</div>
                                        <div className={styles.fieldValue}>
                                            <input
                                                name="area"
                                                type="number"
                                                className={styles.input}
                                                value={getDisplayArea()}
                                                onChange={handleAreaChange}
                                                placeholder={areaUnit === 'pyeong' ? '평수' : 'm²'}
                                            />
                                            <div
                                                onClick={() => setAreaUnit(prev => prev === 'pyeong' ? 'm2' : 'pyeong')}
                                                style={{
                                                    fontSize: 12,
                                                    marginLeft: 4,
                                                    cursor: 'pointer',
                                                    backgroundColor: '#f1f3f5',
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    minWidth: 30,
                                                    textAlign: 'center',
                                                    userSelect: 'none',
                                                    border: '1px solid #dee2e6'
                                                }}
                                                title="클릭하여 단위 변경 (평 <-> m²)"
                                            >
                                                {areaUnit === 'pyeong' ? '평' : 'm²'}
                                            </div>
                                        </div>
                                        <div className={styles.fieldLabel}>층수</div>
                                        <div className={styles.fieldValue}>
                                            <input name="totalFloor" className={styles.input} style={{ width: 40 }} value={formData.totalFloor || ''} onChange={handleChange} />
                                            <span style={{ margin: '0 4px' }}>층 중</span>
                                            <input name="currentFloor" className={styles.input} style={{ width: 40 }} value={formData.currentFloor || ''} onChange={handleChange} />
                                            <span style={{ marginLeft: 4 }}>층</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>주차</div>
                                        <div className={styles.fieldValue}>
                                            <input name="parking" className={styles.input} value={formData.parking || ''} onChange={handleChange} />
                                        </div>
                                        <div className={styles.fieldLabel}>개업일</div>
                                        <div className={styles.fieldValue}>
                                            <input name="openingDate" type="date" className={styles.input} value={formData.openingDate || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>프랜차이즈</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                                                <input name="franchiseBrand" className={styles.input} value={formData.franchiseBrand || ''} readOnly placeholder="브랜드명" />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsBrandSearchOpen(true)}
                                                    className={styles.smallBtn}
                                                    style={{ width: 'auto', whiteSpace: 'nowrap' }}
                                                >
                                                    <Search size={14} /> 검색
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>위치/상권</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="locationMemo" className={styles.textarea} value={formData.locationMemo || ''} onChange={handleChange} placeholder="위치 및 상권 특징을 입력하세요" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>특징</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="featureMemo" className={styles.textarea} value={formData.featureMemo || ''} onChange={handleChange} placeholder="물건 특징을 입력하세요" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="overviewMemo" className={styles.textarea} value={formData.overviewMemo || ''} onChange={handleChange} placeholder="기타 메모를 입력하세요" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. 연락처정보 (Contact) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#e64980', cursor: 'pointer' }}
                            onClick={() => toggleSection('contact')}
                        >연<br />락<br />처</div>
                        {openSections.contact && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>업소전화</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="storePhone" className={styles.input} value={formData.storePhone || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>임대인</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="landlordName" className={styles.input} placeholder="이름" value={formData.landlordName || ''} onChange={handleChange} style={{ width: '30%', marginRight: 8 }} />
                                            <input name="landlordPhone" className={styles.input} placeholder="연락처" value={formData.landlordPhone || ''} onChange={handleChange} style={{ width: '60%' }} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>임차인</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="tenantName" className={styles.input} placeholder="이름" value={formData.tenantName || ''} onChange={handleChange} style={{ width: '30%', marginRight: 8 }} />
                                            <input name="tenantPhone" className={styles.input} placeholder="연락처" value={formData.tenantPhone || ''} onChange={handleChange} style={{ width: '60%' }} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>기타</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="otherContactName" className={styles.input} placeholder="이름" value={formData.otherContactName || ''} onChange={handleChange} style={{ width: '30%', marginRight: 8 }} />
                                            <input name="otherContactPhone" className={styles.input} placeholder="연락처" value={formData.otherContactPhone || ''} onChange={handleChange} style={{ width: '60%' }} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>연락처메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="contactMemo" className={styles.input} value={formData.contactMemo || ''} onChange={handleChange} placeholder="연락처 관련 특이사항" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. 금액정보 (Price) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#7950f2', cursor: 'pointer' }}
                            onClick={() => toggleSection('price')}
                        >금<br />액<br />정<br />보</div>
                        {openSections.price && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    {/* Left: Capital */}
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>보증금</div>
                                        <div className={styles.fieldValue}>
                                            <input name="deposit" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.deposit)} onChange={handlePriceChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}>월임대료</div>
                                        <div className={styles.fieldValue}>
                                            <input name="monthlyRent" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.monthlyRent)} onChange={handlePriceChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>권리금</div>
                                        <div className={styles.fieldValue}>
                                            <input name="premium" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.premium)} onChange={handlePriceChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}>관리비</div>
                                        <div className={styles.fieldValue}>
                                            <input name="maintenance" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.maintenance)} onChange={handlePriceChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>브리핑가</div>
                                        <div className={styles.fieldValue}>
                                            <input name="briefingPrice" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.briefingPrice)} onChange={handlePriceChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}>부가세</div>
                                        <div className={styles.fieldValue}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '100%' }}>
                                                {['별도', '포함'].map(option => (
                                                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: 0 }}>
                                                        <input
                                                            type="radio"
                                                            name="vat"
                                                            value={option}
                                                            checked={formData.vat === option}
                                                            onChange={handleChange}
                                                        />
                                                        <span style={{ fontSize: '12px' }}>{option}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            {/* <span style={{ fontSize: 12, marginLeft: 4 }}>만</span> - Removed for radio */}
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel} style={{ backgroundColor: '#ffe3e3', color: '#c92a2a', fontWeight: 'bold' }}>합계금</div>
                                        <div className={styles.fieldValue} style={{ backgroundColor: '#ffe3e3' }}>
                                            <span className={styles.totalPrice}>{formatCurrency(formData.totalPrice)}</span>
                                            <span style={{ fontSize: 12, marginLeft: 4, color: '#c92a2a', fontWeight: 'bold' }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}></div>
                                        <div className={styles.fieldValue}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Franchise Status (Moved from Right Tab) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#15aabf', cursor: 'pointer' }}
                            onClick={() => toggleSection('franchise')}
                        >가<br />맹<br />현<br />황</div>
                        {openSections.franchise && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>본사보증금</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                value={formatInput(formData.hqDeposit)}
                                                onChange={(e) => handleFranchiseChange(e, 'hqDeposit')}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>가맹비</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                value={formatInput(formData.franchiseFee)}
                                                onChange={(e) => handleFranchiseChange(e, 'franchiseFee')}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>교육비</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                value={formatInput(formData.educationFee)}
                                                onChange={(e) => handleFranchiseChange(e, 'educationFee')}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>리뉴얼</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                value={formatInput(formData.renewal)}
                                                onChange={(e) => handleFranchiseChange(e, 'renewal')}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>로열티(월)</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                value={formatInput(formData.royalty)}
                                                onChange={(e) => handleFranchiseChange(e, 'royalty')}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel} style={{ fontWeight: 'bold', color: '#15aabf' }}>합계금</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={`${styles.input} ${styles.priceInput}`}
                                                style={{ fontWeight: 'bold', color: '#15aabf', backgroundColor: '#f8f9fa' }}
                                                value={formatCurrency((Number(formData.hqDeposit) || 0) + (Number(formData.franchiseFee) || 0) + (Number(formData.educationFee) || 0) + (Number(formData.renewal) || 0))}
                                                readOnly
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="franchiseMemo" className={styles.textarea} value={formData.franchiseMemo || ''} onChange={handleChange} placeholder="가맹 관련 메모를 입력하세요" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. 매출지출분석 (Revenue/Expense) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#339af0', cursor: 'pointer' }}
                            onClick={() => toggleSection('revenue')}
                        >매<br />출<br />현<br />황</div>
                        {openSections.revenue && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>월총매출</div>
                                        <div className={styles.fieldValue}>
                                            <input name="monthlyRevenue" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.monthlyRevenue)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}>인건비</div>
                                        <div className={styles.fieldValue}>
                                            <input name="laborCost" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.laborCost)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>재료비(%)</div>
                                        <div className={styles.fieldValue}>
                                            <input name="materialCostPercent" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.materialCostPercent)} onChange={handleFinancialChange} style={{ width: '60px' }} placeholder="0" />
                                            <span style={{ fontSize: 12, margin: '0 4px' }}>%</span>
                                            <span style={{ fontSize: 12, color: '#868e96' }}>({formatCurrency(formData.materialCost)})</span>
                                        </div>
                                        <div className={styles.fieldLabel}>임대관리비</div>
                                        <div className={styles.fieldValue}>
                                            <input name="rentMaintenance" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.rentMaintenance)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>제세공과금</div>
                                        <div className={styles.fieldValue}>
                                            <input name="taxUtilities" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.taxUtilities)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel}>유지보수</div>
                                        <div className={styles.fieldValue}>
                                            <input name="maintenanceDepreciation" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.maintenanceDepreciation)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>기타경비</div>
                                        <div className={styles.fieldValue}>
                                            <input name="promoMisc" type="text" className={`${styles.input} ${styles.priceInput}`} value={formatInput(formData.promoMisc)} onChange={handleFinancialChange} placeholder="0" />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                        </div>
                                        <div className={styles.fieldLabel} style={{ fontWeight: 'bold' }}>월순수익</div>
                                        <div className={styles.fieldValue}>
                                            <span style={{ fontWeight: 'bold', color: '#f08c00' }}>{formatCurrency(formData.monthlyProfit)} 만</span>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>수익률</div>
                                        <div className={styles.fieldValue}>
                                            <span style={{ fontWeight: 'bold', color: '#fa5252' }}>
                                                {formData.yieldPercent ? Number(formData.yieldPercent).toFixed(2) : '0.00'}%
                                            </span>
                                        </div>
                                        <div className={styles.fieldLabel}>매출오픈여부</div>
                                        <div className={styles.fieldValue}>
                                            <select name="revenueOpen" className={styles.select} value={formData.revenueOpen || ''} onChange={handleChange}>
                                                <option value="">선택</option>
                                                <option value="공개">공개</option>
                                                <option value="조건부공개">조건부공개</option>
                                                <option value="비공개">비공개</option>
                                                <option value="협의">협의</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>매출/지출 메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="revenueMemo" className={styles.textarea} value={formData.revenueMemo || ''} onChange={handleChange} placeholder="매출 및 지출 관련 특이사항" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. 영업현황 (Operation Status) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#82c91e', cursor: 'pointer' }}
                            onClick={() => toggleSection('operation')}
                        >영<br />업<br />현<br />황</div>
                        {openSections.operation && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>시설/인테리어</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="facilityInterior" className={styles.input} value={formData.facilityInterior || ''} onChange={handleChange} placeholder="예: 상, 중, 하" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>주요고객층</div>
                                        <div className={styles.fieldValue}>
                                            <input name="mainCustomer" className={styles.input} value={formData.mainCustomer || ''} onChange={handleChange} />
                                        </div>
                                        <div className={styles.fieldLabel}>피크타임</div>
                                        <div className={styles.fieldValue}>
                                            <input name="peakTime" className={styles.input} value={formData.peakTime || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>테이블/룸</div>
                                        <div className={styles.fieldValue}>
                                            <input name="tableCount" className={styles.input} value={formData.tableCount || ''} onChange={handleChange} />
                                        </div>
                                        <div className={styles.fieldLabel}>추천업종</div>
                                        <div className={styles.fieldValue}>
                                            <input name="recommendedBusiness" className={styles.input} value={formData.recommendedBusiness || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                    {/* Custom Operation Fields */}
                                    {formData.operationCustomFields?.map((field: any, idx: number) => (
                                        <div className={styles.fieldRow} key={`op-${idx}`}>
                                            <div className={styles.fieldLabel}>{field.label}</div>
                                            <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                                <input
                                                    value={field.value}
                                                    className={styles.input}
                                                    onChange={(e) => handleCustomFieldChange('operation', idx, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="operationMemo" className={styles.textarea} value={formData.operationMemo || ''} onChange={handleChange} placeholder="영업 관련 메모를 입력하세요" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>
                                            <button className={styles.smallBtn} onClick={() => setIsAddingOperationCategory(true)}><Plus size={12} /> 추가</button>
                                        </div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            {isAddingOperationCategory && (
                                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%', flexWrap: 'nowrap' }}>
                                                    <input
                                                        className={styles.input}
                                                        placeholder="새 항목 이름"
                                                        value={newOperationCategory}
                                                        onChange={(e) => setNewOperationCategory(e.target.value)}
                                                        style={{ flex: 1, minWidth: 0 }}
                                                    />
                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexShrink: 0 }}>
                                                        <button className={styles.smallBtn} onClick={() => addCustomField('operation')} style={{ whiteSpace: 'nowrap' }}>확인</button>
                                                        <button className={styles.smallBtn} onClick={() => setIsAddingOperationCategory(false)} style={{ whiteSpace: 'nowrap' }}>취소</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        )}
                    </div>

                    {/* 6. 임대차관리 (Lease Management) */}
                    <div className={styles.sectionRow}>
                        <div
                            className={styles.verticalHeader}
                            style={{ backgroundColor: '#fab005', cursor: 'pointer' }}
                            onClick={() => toggleSection('lease')}
                        >임<br />대<br />차<br />관<br />리</div>
                        {openSections.lease && (
                            <div className={styles.contentArea}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>임대기간</div>
                                        <div className={styles.fieldValue}>
                                            <input name="leasePeriod" className={styles.input} value={formData.leasePeriod || ''} onChange={handleChange} placeholder="예: 2년" />
                                        </div>
                                        <div className={styles.fieldLabel}>임대료변동</div>
                                        <div className={styles.fieldValue}>
                                            <input name="rentFluctuation" className={styles.input} value={formData.rentFluctuation || ''} onChange={handleChange} placeholder="예: 5% 인상" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>공부서류 하자</div>
                                        <div className={styles.fieldValue}>
                                            <input name="docDefects" className={styles.input} value={formData.docDefects || ''} onChange={handleChange} placeholder="없음" />
                                        </div>
                                        <div className={styles.fieldLabel}>양수도통보</div>
                                        <div className={styles.fieldValue}>
                                            <input name="transferNotice" className={styles.input} value={formData.transferNotice || ''} onChange={handleChange} placeholder="완료" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>화해조서</div>
                                        <div className={styles.fieldValue}>
                                            <input name="settlementDefects" className={styles.input} value={formData.settlementDefects || ''} onChange={handleChange} placeholder="없음" />
                                        </div>
                                        <div className={styles.fieldLabel}>임대인정보</div>
                                        <div className={styles.fieldValue}>
                                            <input name="lessorInfo" className={styles.input} value={formData.lessorInfo || ''} onChange={handleChange} placeholder="성향 등" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>동업/권리</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input name="partnershipRights" className={styles.input} value={formData.partnershipRights || ''} onChange={handleChange} placeholder="특이사항 없음" />
                                        </div>
                                    </div>
                                    {/* Custom Lease Fields */}
                                    {formData.leaseCustomFields?.map((field: any, idx: number) => (
                                        <div className={styles.fieldRow} key={`ls-${idx}`}>
                                            <div className={styles.fieldLabel}>{field.label}</div>
                                            <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                                <input
                                                    value={field.value}
                                                    className={styles.input}
                                                    onChange={(e) => handleCustomFieldChange('lease', idx, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>메모</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <textarea name="leaseMemo" className={styles.textarea} value={formData.leaseMemo || ''} onChange={handleChange} placeholder="임대차 관련 메모를 입력하세요" />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>
                                            <button className={styles.smallBtn} onClick={() => setIsAddingLeaseCategory(true)}><Plus size={12} /> 추가</button>
                                        </div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            {isAddingLeaseCategory && (
                                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%', flexWrap: 'nowrap' }}>
                                                    <input
                                                        className={styles.input}
                                                        placeholder="새 항목 이름"
                                                        value={newLeaseCategory}
                                                        onChange={(e) => setNewLeaseCategory(e.target.value)}
                                                        style={{ flex: 1, minWidth: 0 }}
                                                    />
                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexShrink: 0 }}>
                                                        <button className={styles.smallBtn} onClick={() => addCustomField('lease')} style={{ whiteSpace: 'nowrap' }}>확인</button>
                                                        <button className={styles.smallBtn} onClick={() => setIsAddingLeaseCategory(false)} style={{ whiteSpace: 'nowrap' }}>취소</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Tabs */}
                <div className={styles.rightPanel}>
                    <div className={styles.tabs}>
                        {['priceWork', 'revenue', 'photos', 'contracts', 'reports', 'transfer', 'docs'].map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'priceWork' && '금액작업'}
                                {tab === 'revenue' && '매출'}
                                {tab === 'photos' && '사진지도'}
                                {tab === 'contracts' && '고객계약'}
                                {tab === 'reports' && '리포트'}
                                {tab === 'transfer' && '물건전송'}
                                {tab === 'docs' && '관련문서'}
                            </button>
                        ))}
                    </div>
                    <div className={styles.tabContent}>
                        {activeTab === 'priceWork' && (
                            <div className={styles.tabPane}>
                                <div className={styles.paneHeader}>
                                    <h3>금액변동내역</h3>
                                    <button className={styles.smallBtn} onClick={handleAddPriceHistory}><Plus size={14} /> 내역추가</button>
                                </div>
                                <table className={styles.listTable}>
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>날짜</th>
                                            <th>작업자</th>
                                            <th>변동후금액</th>
                                            <th>내역</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Initial Entry */}
                                        {/* Dynamic Entries */}
                                        {(formData.priceHistory && formData.priceHistory.length > 0 ? formData.priceHistory : [{
                                            id: 'initial',
                                            date: formData.createdAt || new Date(),
                                            manager: formData.managerName,
                                            amount: formData.totalPrice,
                                            details: '최초입력 금액합계 (자동저장)'
                                        }]).map((item: any, index: number) => (
                                            <tr key={item.id || index} onClick={() => item.id !== 'initial' && handleEditPriceHistory(item)} style={{ cursor: item.id !== 'initial' ? 'pointer' : 'default', ':hover': { backgroundColor: '#f8f9fa' } } as any}>
                                                <td>{index + 1}</td>
                                                <td>{formatDate(item.date)}</td>
                                                <td>{item.manager}</td>
                                                <td style={{ color: '#c92a2a', fontWeight: 'bold' }}>{formatCurrency(item.amount)}</td>
                                                <td>
                                                    {item.isImportant && <span style={{ color: 'red', marginRight: 4 }}>[중요]</span>}
                                                    {item.details ? (item.details.length > 20 ? item.details.substring(0, 20) + '...' : item.details) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className={styles.paneHeader} style={{ marginTop: 24 }}>
                                    <h3>물건작업내역</h3>
                                    <button className={styles.smallBtn} onClick={handleAddWorkHistory}><Plus size={14} /> 작업추가</button>
                                </div>
                                <table className={styles.listTable}>
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>날짜</th>
                                            <th>작업자</th>
                                            <th>내역</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(!formData.workHistory || formData.workHistory.length === 0) ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#868e96' }}>등록된 작업 내역이 없습니다.</td>
                                            </tr>
                                        ) : (
                                            formData.workHistory.map((item: any, index: number) => (
                                                <tr key={item.id || index} onClick={() => handleEditWorkHistory(item)} style={{ cursor: 'pointer', ':hover': { backgroundColor: '#f8f9fa' } } as any}>
                                                    <td>{index + 1}</td>
                                                    <td>{formatDate(item.date)}</td>
                                                    <td>{item.manager}</td>
                                                    <td>
                                                        [{item.targetType === 'customer' ? '고객' : '매물'}] {item.content}
                                                        {item.details && <div style={{ fontSize: 11, color: '#868e96' }}>{item.details.length > 30 ? item.details.substring(0, 30) + '...' : item.details}</div>}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'revenue' && (
                            <div className={styles.tabPane}>
                                <div className={styles.paneHeader}>
                                    <h3>월별매출현황</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className={styles.smallBtn} onClick={handleDownloadTemplate} style={{ backgroundColor: '#107c41', color: 'white' }}><FileText size={14} /> 양식</button>
                                        <button className={styles.smallBtn} onClick={() => fileInputRef.current?.click()} style={{ backgroundColor: '#217346', color: 'white' }}><FileText size={14} /> 업로드</button>
                                        <input type="file" ref={fileInputRef} onChange={handleExcelUpload} style={{ display: 'none' }} accept=".xlsx, .xls" />
                                        <div style={{ width: 1, height: 20, backgroundColor: '#ddd', margin: '0 4px' }}></div>
                                        <button className={styles.smallBtn} onClick={handleAddRevenue}><Plus size={14} /> 매출추가</button>
                                        <button className={styles.smallBtn} onClick={handleDeleteRevenue} style={{ backgroundColor: '#fa5252', color: 'white' }}><Trash2 size={14} /> 매출삭제</button>
                                    </div>
                                </div>

                                <div style={{ height: '300px', overflowY: 'scroll', marginBottom: 20 }}>
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}><input type="checkbox" onChange={(e) => {
                                                    if (e.target.checked) setSelectedRevenueIds(formData.revenueHistory?.map((i: any) => i.id) || []);
                                                    else setSelectedRevenueIds([]);
                                                }} checked={selectedRevenueIds.length > 0 && selectedRevenueIds.length === (formData.revenueHistory?.length || 0)} /></th>
                                                <th>날짜</th>
                                                <th>현금매출</th>
                                                <th>%</th>
                                                <th>카드매출</th>
                                                <th>%</th>
                                                <th>합계</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(!formData.revenueHistory || formData.revenueHistory.length === 0) ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>등록된 매출 데이터가 없습니다.</td></tr>
                                            ) : (
                                                formData.revenueHistory.map((item: any) => {
                                                    const cashPct = item.total > 0 ? Math.round((item.cash / item.total) * 100) : 0;
                                                    const cardPct = item.total > 0 ? Math.round((item.card / item.total) * 100) : 0;
                                                    return (
                                                        <tr key={item.id} onClick={() => handleEditRevenue(item)} style={{ cursor: 'pointer', ':hover': { backgroundColor: '#f8f9fa' } } as any}>
                                                            <td onClick={(e) => e.stopPropagation()}>
                                                                <input type="checkbox" checked={selectedRevenueIds.includes(item.id)} onChange={(e) => {
                                                                    if (e.target.checked) setSelectedRevenueIds([...selectedRevenueIds, item.id]);
                                                                    else setSelectedRevenueIds(selectedRevenueIds.filter(id => id !== item.id));
                                                                }} />
                                                            </td>
                                                            <td>{item.date.substring(2)}</td>
                                                            <td style={{ color: '#1c7ed6' }}>{formatCurrency(item.cash)} 만원</td>
                                                            <td style={{ color: '#1c7ed6' }}>{cashPct}%</td>
                                                            <td style={{ color: '#37b24d' }}>{formatCurrency(item.card)} 만원</td>
                                                            <td style={{ color: '#37b24d' }}>{cardPct}%</td>
                                                            <td style={{ fontWeight: 'bold' }}>{formatCurrency(item.total)} 만원</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                        {formData.revenueHistory && formData.revenueHistory.length > 0 && (
                                            <tfoot>
                                                <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                                                    <td colSpan={2}>총합계</td>
                                                    <td>{formatCurrency(formData.revenueHistory.reduce((acc: number, curr: any) => acc + (curr.cash || 0), 0))} 만원</td>
                                                    <td></td>
                                                    <td>{formatCurrency(formData.revenueHistory.reduce((acc: number, curr: any) => acc + (curr.card || 0), 0))} 만원</td>
                                                    <td></td>
                                                    <td>{formatCurrency(formData.revenueHistory.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0))} 만원</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>

                                <div className={styles.paneHeader}>
                                    <h3>월별매출그래프</h3>
                                </div>
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={[...(formData.revenueHistory || [])].reverse()}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis yAxisId="left" />
                                            <YAxis yAxisId="right" orientation="right" />
                                            <Tooltip formatter={(value: number) => `${value.toLocaleString()} 만원`} />
                                            <Legend />
                                            <Bar yAxisId="left" dataKey="cash" name="현금" fill="#1c7ed6" stackId="a" />
                                            <Bar yAxisId="left" dataKey="card" name="카드" fill="#37b24d" stackId="a" />
                                            <Line yAxisId="right" type="monotone" dataKey="total" name="합계" stroke="#fab005" strokeWidth={2} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {activeTab === 'photos' && (
                            <div className={styles.tabPane}>
                                <div className={styles.photoContainer}>
                                    <div className={styles.photoSectionHeader}>
                                        <span>물건사진</span>
                                        <div className={styles.headerActions}>
                                            <button className={styles.actionBtn} onClick={() => photoInputRef.current?.click()}>
                                                <Plus size={14} /> 사진추가
                                            </button>
                                            <input
                                                type="file"
                                                ref={photoInputRef}
                                                onChange={handlePhotoUpload}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                multiple
                                            />
                                            <button className={styles.actionBtn} style={{ borderColor: '#66d9e8', color: '#fff', backgroundColor: '#1098ad' }} onClick={handleDownloadAllPhotos}>
                                                <Download size={14} /> 전체다운로드
                                            </button>
                                            <button className={styles.actionBtn} style={{ borderColor: '#ff8787', color: '#fff', backgroundColor: '#fa5252' }} onClick={handleDeleteAllPhotos}>
                                                <Trash2 size={14} /> 사진모두삭제
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.photoGrid}>
                                        {Array.from({ length: Math.max(12, (formData.photos?.length || 0)) }).map((_, index) => {
                                            const photo = formData.photos?.[index];
                                            return (
                                                <div
                                                    key={index}
                                                    className={styles.photoItem}
                                                    onClick={() => photo ? setPreviewImage(photo) : photoInputRef.current?.click()}
                                                >
                                                    {photo ? (
                                                        <>
                                                            <img src={photo} alt={`Property ${index}`} />
                                                            <div className={styles.photoActions}>
                                                                <button
                                                                    className={styles.downloadPhoto}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownloadPhoto(photo, index);
                                                                    }}
                                                                >
                                                                    <Download size={12} />
                                                                </button>
                                                                <button
                                                                    className={styles.deletePhoto}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeletePhoto(index);
                                                                    }}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className={styles.photoPlaceholder}>PHOTO</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ marginTop: 20, borderTop: '1px solid #dee2e6', paddingTop: 20 }}>
                                    {formData.coordinates ? (
                                        <div style={{ width: '100%', height: '400px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid #dee2e6' }}>
                                            {/* Overlay Header */}
                                            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>위치 및 지도</h4>
                                            </div>
                                            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                                                <div className={styles.toggleGroup}>
                                                    <button
                                                        className={`${styles.mapBtn} ${activeMapOverlay === 'skyview' ? styles.active : ''}`}
                                                        onClick={() => setActiveMapOverlay(activeMapOverlay === 'skyview' ? null : 'skyview')}
                                                    >
                                                        지도/스카이뷰
                                                    </button>
                                                    <button
                                                        className={`${styles.mapBtn} ${activeMapOverlay === 'use_district' ? styles.active : ''}`}
                                                        onClick={() => setActiveMapOverlay(activeMapOverlay === 'use_district' ? null : 'use_district')}
                                                    >
                                                        지적편집도
                                                    </button>
                                                </div>
                                            </div>

                                            <Map
                                                center={{ lat: formData.coordinates.lat, lng: formData.coordinates.lng }}
                                                style={{ width: "100%", height: "100%" }}
                                                level={3}
                                            >
                                                <MapMarker position={{ lat: formData.coordinates.lat, lng: formData.coordinates.lng }} />
                                                {activeMapOverlay === 'skyview' && mapConstants && <MapTypeId type={mapConstants.HYBRID} />}
                                                {activeMapOverlay === 'use_district' && mapConstants && <MapTypeId type={mapConstants.USE_DISTRICT} />}
                                            </Map>
                                        </div>
                                    ) : (
                                        <div style={{ width: '100%', height: '200px', backgroundColor: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#868e96', borderRadius: '4px' }}>
                                            좌표 정보가 없습니다. 주소를 검색해주세요.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'contracts' && (
                            <div className={styles.tabPane}>
                                {/* Promoted Customers Section */}
                                <div className={styles.paneHeader}>
                                    <h3>추진고객</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className={styles.smallBtn} onClick={() => { setPersonSelectorMode('promotedCustomer'); setInitialPersonTab('customer'); setIsPersonSelectorOpen(true); }}><Plus size={14} /> 고객추가</button>
                                        <button className={styles.smallBtn} onClick={() => { setPersonSelectorMode('promotedCustomer'); setInitialPersonTab('businessCard'); setIsPersonSelectorOpen(true); }}><Plus size={14} /> 명함추가</button>
                                    </div>
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>날짜</th>
                                                <th>이름</th>
                                                <th>분류</th>
                                                <th>예산</th>
                                                <th>특징</th>
                                                <th>관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(!formData.promotedCustomers || formData.promotedCustomers.length === 0) ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>등록된 추진 고객이 없습니다.</td></tr>
                                            ) : (
                                                formData.promotedCustomers.map((customer: any, index: number) => (
                                                    <tr key={customer.id || index}>
                                                        <td>{index + 1}</td>
                                                        <td>{formatDate(customer.date)}</td>
                                                        <td>
                                                            <span style={{
                                                                backgroundColor: customer.type === 'customer' ? '#e64980' : '#7950f2',
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: 4,
                                                                fontSize: 11,
                                                                marginRight: 6
                                                            }}>
                                                                {customer.type === 'customer' ? '고객' : '명함'}
                                                            </span>
                                                            {customer.name}
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                backgroundColor: customer.classification === 'progress' ? '#339af0' :
                                                                    customer.classification === 'manage' ? '#fab005' :
                                                                        customer.classification === 'contract' ? '#51cf66' :
                                                                            customer.classification === 'hold' ? '#ff6b6b' : '#868e96',
                                                                color: 'white',
                                                                padding: '2px 8px',
                                                                borderRadius: 4,
                                                                fontSize: 11
                                                            }}>
                                                                {customer.classification === 'progress' ? '추진' :
                                                                    customer.classification === 'manage' ? '관리' :
                                                                        customer.classification === 'contract' ? '계약' :
                                                                            customer.classification === 'hold' ? '보류' :
                                                                                customer.classification === 'complete' ? '완료' :
                                                                                    customer.classification || '-'}
                                                            </span>
                                                        </td>
                                                        <td>{(customer.budget && !isNaN(Number(customer.budget))) ? formatCurrency(customer.budget) : '-'}</td>
                                                        <td>{customer.features}</td>
                                                        <td>
                                                            <button className={styles.deletePhoto} onClick={() => handleRemovePromotedCustomer(index)}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Contract History Section */}
                                <div className={styles.paneHeader} style={{ marginTop: 20, borderTop: '1px solid #dee2e6', paddingTop: 20 }}>
                                    <h3>계약히스토리</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className={styles.smallBtn} onClick={handleAddContract}><Plus size={14} /> 계약추가</button>
                                    </div>
                                </div>
                                <div>
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>계약일</th>
                                                <th>종류</th>
                                                <th>매매가</th>
                                                <th>보증금</th>
                                                <th>임대료</th>
                                                <th>계약자</th>
                                                <th>전화번호</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(!formData.contractHistory || formData.contractHistory.length === 0) ? (
                                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>등록된 계약 내역이 없습니다.</td></tr>
                                            ) : (
                                                formData.contractHistory.map((contract: any, index: number) => (
                                                    <tr key={contract.id || index} onClick={() => handleEditContract(contract)} style={{ cursor: 'pointer', ':hover': { backgroundColor: '#f8f9fa' } } as any}>
                                                        <td>{index + 1}</td>
                                                        <td>{contract.contractDate}</td>
                                                        <td>
                                                            <span style={{
                                                                backgroundColor: contract.type === '매매' ? '#339af0' : contract.type === '전세' ? '#51cf66' : contract.type === '월세' ? '#ff6b6b' : '#cc5de8',
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: 4,
                                                                fontSize: 11
                                                            }}>
                                                                {contract.type}
                                                            </span>
                                                        </td>
                                                        <td>{contract.type === '매매' ? formatCurrency(contract.deposit) : '-'}</td>
                                                        <td>{contract.type !== '매매' ? formatCurrency(contract.deposit) : '-'}</td>
                                                        <td>{formatCurrency(contract.monthlyRent)}</td>
                                                        <td>{contract.contractorName}</td>
                                                        <td>{contract.contractorPhone}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeTab === 'docs' && (
                            <div className={styles.tabPane}>
                                <div className={styles.paneHeader} style={{ backgroundColor: '#339af0', color: 'white', padding: '10px 15px', borderRadius: '4px 4px 0 0', margin: '-15px -15px 15px -15px' }}>
                                    <h3 style={{ color: 'white', margin: 0, fontSize: 15 }}>물건관련문서</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            className={styles.smallBtn}
                                            onClick={() => docInputRef.current?.click()}
                                            style={{ backgroundColor: 'white', color: '#339af0', border: 'none', fontWeight: 'bold' }}
                                        >
                                            <Plus size={14} /> 문서추가
                                        </button>
                                        <input type="file" ref={docInputRef} onChange={handleDocUpload} style={{ display: 'none' }} multiple />
                                        <button
                                            className={styles.smallBtn}
                                            onClick={handleDeleteDocuments}
                                            style={{ backgroundColor: '#ffa8a5', color: '#c92a2a', border: '1px solid #ff8787', fontWeight: 'bold' }}
                                        >
                                            <Trash2 size={14} /> 문서삭제
                                        </button>
                                    </div>
                                </div>
                                <div style={{ height: '500px', overflowY: 'auto' }}>
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40, textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedDocIds(formData.documents?.map((d: any) => d.id) || []);
                                                            else setSelectedDocIds([]);
                                                        }}
                                                        checked={formData.documents?.length > 0 && selectedDocIds.length === formData.documents.length}
                                                    />
                                                </th>
                                                <th style={{ width: 50, textAlign: 'center' }}>No</th>
                                                <th style={{ width: 120, textAlign: 'center' }}>날짜</th>
                                                <th style={{ width: 100, textAlign: 'center' }}>첨부자</th>
                                                <th style={{ width: 80, textAlign: 'center' }}>종류</th>
                                                <th>문서명</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(!formData.documents || formData.documents.length === 0) ? (
                                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 50, color: '#868e96' }}>등록된 관련 문서가 없습니다.</td></tr>
                                            ) : (
                                                formData.documents.map((doc: any, index: number) => (
                                                    <tr key={doc.id || index}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDocIds.includes(doc.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedDocIds([...selectedDocIds, doc.id]);
                                                                    else setSelectedDocIds(selectedDocIds.filter(id => id !== doc.id));
                                                                }}
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>{formData.documents.length - index}</td>
                                                        <td style={{ textAlign: 'center', color: '#1c7ed6' }}>{doc.date} <span style={{ color: '#868e96', fontSize: 11 }}>({new Date(doc.date).toLocaleDateString('ko-KR', { weekday: 'short' })})</span></td>
                                                        <td style={{ textAlign: 'center', color: '#1098ad' }}>{doc.uploader}</td>
                                                        <td style={{ textAlign: 'center' }}>{getDocIcon(doc.type)}</td>
                                                        <td style={{ fontWeight: '500' }}>
                                                            {doc.url ? (
                                                                <a
                                                                    href={doc.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: 'inherit', textDecoration: 'none', ':hover': { textDecoration: 'underline', color: '#339af0' } } as any}
                                                                >
                                                                    {doc.name}
                                                                </a>
                                                            ) : (
                                                                doc.name
                                                            )}
                                                            <span style={{ fontSize: 11, color: '#adb5bd', marginLeft: 6 }}>
                                                                ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reports' && (
                            <div className={styles.tabPane} style={{ padding: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <PropertyReportTab
                                    data={formData}
                                    onChange={(field, value) => handleChange({ target: { name: field, value } } as any)}
                                    onSave={() => autoSaveProperty(formData)}
                                    initialDirectPreview={directReportPreview}
                                />
                            </div>
                        )}

                        {activeTab !== 'priceWork' && activeTab !== 'revenue' && activeTab !== 'photos' && activeTab !== 'contracts' && activeTab !== 'docs' && activeTab !== 'transfer' && activeTab !== 'reports' && (
                            <div style={{ padding: 20, textAlign: 'center', color: '#868e96' }}>
                                준비 중인 기능입니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    <button className={styles.footerBtn} onClick={handleSave} disabled={isLoading}>
                        <Save size={14} /> 저장
                    </button>
                    <button className={styles.footerBtn} onClick={handleDelete} disabled={isLoading}>
                        <Trash2 size={14} /> 삭제
                    </button>
                </div>
                <div className={styles.footerRight}>
                    <button className={styles.footerBtn} onClick={handleNew}><Plus size={14} /> 신규</button>
                    <button className={styles.footerBtn} onClick={handleCopy} disabled={isLoading}><Copy size={14} /> 복사</button>
                    <button className={styles.footerBtn} onClick={() => {
                        // Check if favorite exists to provide guidance if not
                        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                        let userId = 'default';
                        if (userStr) {
                            try {
                                const u = JSON.parse(userStr);
                                userId = (u.user || u).id || (u.user || u).userId || (u.user || u).name || 'default';
                            } catch (e) { }
                        }
                        const favId = localStorage.getItem(`favorite_report_format_${userId}`);

                        if (!favId) {
                            showToast('인쇄형식을 즐겨찾기(별 아이콘) 해두시면 다음부터는 해당 양식으로 바로 인쇄 미리보기가 열립니다.');
                        }

                        setActiveTab('reports');
                        setDirectReportPreview(Date.now());
                    }}><Printer size={14} /> 인쇄</button>
                    <button className={styles.footerBtn} onClick={onClose}>닫기</button>
                </div>
            </div>

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
                                    <button type="button" className={styles.smallBtn} onClick={searchBrands} disabled={isSearchingBrand} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
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
            {/* Price History Modal */}
            {
                isPriceHistoryOpen && (
                    <div className={styles.searchModal}>
                        <div className={styles.modalContent} style={{ width: '800px', maxWidth: '95vw' }}>
                            <div className={styles.modalHeader}>
                                <h3>{editingHistoryId ? '금액작업내역 수정' : '금액작업내역 추가'}</h3>
                                <button type="button" onClick={() => setIsPriceHistoryOpen(false)}><X size={20} /></button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>변동후금액</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                style={{ width: '150px' }}
                                                value={priceHistoryForm.amount}
                                                onChange={(e) => setPriceHistoryForm(prev => ({ ...prev, amount: Number(e.target.value.replace(/,/g, '')) }))}
                                            />
                                            <span style={{ fontSize: 12, marginLeft: 4 }}>만</span>
                                            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={priceHistoryForm.isImportant}
                                                    onChange={(e) => setPriceHistoryForm(prev => ({ ...prev, isImportant: e.target.checked }))}
                                                />
                                                중요체크
                                            </label>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>날짜</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                style={{ width: '150px' }}
                                                value={priceHistoryForm.date}
                                                onChange={(e) => setPriceHistoryForm(prev => ({ ...prev, date: e.target.value }))}
                                            />
                                            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => adjustDate(-1, 'price')}>-1일</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('yesterday', 'price')}>어제</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('today', 'price')}>오늘</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('tomorrow', 'price')}>내일</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => adjustDate(1, 'price')}>+1일</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>상세내역</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3', height: '100px' }}>
                                            <textarea
                                                className={styles.textarea}
                                                value={priceHistoryForm.details}
                                                onChange={(e) => setPriceHistoryForm(prev => ({ ...prev, details: e.target.value }))}
                                                style={{ height: '100%' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    {editingHistoryId && (
                                        <button className={styles.footerBtn} style={{ backgroundColor: '#fa5252', color: 'white', marginRight: 'auto' }} onClick={handleDeletePriceHistory}>
                                            <Trash2 size={14} /> 삭제
                                        </button>
                                    )}
                                    <button className={styles.footerBtn} style={{ backgroundColor: '#339af0', color: 'white' }} onClick={handleSavePriceHistory}>
                                        <Save size={14} /> {editingHistoryId ? '수정사항 저장' : '내역저장후 닫기'}
                                    </button>
                                    <button className={styles.footerBtn} onClick={() => setIsPriceHistoryOpen(false)}>
                                        <X size={14} /> 닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Revenue Modal */}
            {
                isRevenueModalOpen && (
                    <div className={styles.searchModal}>
                        <div className={styles.modalContent} style={{ width: '400px' }}>
                            <div className={styles.modalHeader}>
                                <h3>{editingRevenueId ? '월매출내역 수정' : '월매출내역 추가'}</h3>
                                <button type="button" onClick={() => setIsRevenueModalOpen(false)}><X size={20} /></button>
                            </div>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 15, alignItems: 'center' }}>
                                    <input className={styles.input} type="number" style={{ width: 80 }} value={revenueForm.year} onChange={(e) => setRevenueForm({ ...revenueForm, year: Number(e.target.value) })} />
                                    <span>년</span>
                                    <input className={styles.input} type="number" style={{ width: 60 }} value={revenueForm.month} onChange={(e) => setRevenueForm({ ...revenueForm, month: Number(e.target.value) })} />
                                    <span>월</span>
                                </div>
                                <div className={styles.fieldRow} style={{ marginBottom: 10 }}>
                                    <div className={styles.fieldLabel}>현금매출</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} type="number" value={revenueForm.cash || ''} onChange={(e) => setRevenueForm({ ...revenueForm, cash: Number(e.target.value) })} placeholder="0" />
                                        <span style={{ fontSize: 12, marginLeft: 4 }}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>카드매출</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} type="number" value={revenueForm.card || ''} onChange={(e) => setRevenueForm({ ...revenueForm, card: Number(e.target.value) })} placeholder="0" />
                                        <span style={{ fontSize: 12, marginLeft: 4 }}>만원</span>
                                    </div>
                                </div>
                                <div style={{ marginTop: 20, textAlign: 'right' }}>
                                    <button className={styles.primaryBtn} onClick={handleSaveRevenue}>{editingRevenueId ? '수정사항 저장' : '저장후 계속입력'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Work History Modal */}
            {
                isWorkHistoryOpen && (
                    <div className={styles.searchModal}>
                        <div className={styles.modalContent} style={{ width: '800px', maxWidth: '95vw' }}>
                            <div className={styles.modalHeader}>
                                <h3>{editingHistoryId ? '작업내역 수정' : '작업내역 추가'}</h3>
                                <button type="button" onClick={() => setIsWorkHistoryOpen(false)}><X size={20} /></button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <div className={styles.fieldGrid}>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>내역</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                className={styles.input}
                                                value={workHistoryForm.content}
                                                onChange={(e) => setWorkHistoryForm(prev => ({ ...prev, content: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>날짜</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                style={{ width: '150px' }}
                                                value={workHistoryForm.date}
                                                onChange={(e) => setWorkHistoryForm(prev => ({ ...prev, date: e.target.value }))}
                                            />
                                            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => adjustDate(-1, 'work')}>-1일</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('yesterday', 'work')}>어제</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('today', 'work')}>오늘</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => setDateTo('tomorrow', 'work')}>내일</button>
                                                <button className={styles.smallBtn} style={{ padding: '6px 12px', height: 'auto', whiteSpace: 'nowrap' }} onClick={() => adjustDate(1, 'work')}>+1일</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>상세내역</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3', height: '100px' }}>
                                            <textarea
                                                className={styles.textarea}
                                                value={workHistoryForm.details}
                                                onChange={(e) => setWorkHistoryForm(prev => ({ ...prev, details: e.target.value }))}
                                                style={{ height: '100%' }}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <div className={styles.fieldLabel}>대상</div>
                                        <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                            <select
                                                className={styles.select}
                                                style={{ width: '80px', marginRight: 4 }}
                                                value={workHistoryForm.targetType}
                                                onChange={(e) => setWorkHistoryForm(prev => ({ ...prev, targetType: e.target.value }))}
                                            >
                                                <option value="customer">고객</option>
                                                <option value="businessCard">명함</option>
                                            </select>
                                            <input
                                                className={styles.input}
                                                value={workHistoryForm.targetKeyword}
                                                onChange={(e) => setWorkHistoryForm(prev => ({ ...prev, targetKeyword: e.target.value }))}
                                                style={{ backgroundColor: '#fff9db' }}
                                            />
                                            <button className={styles.smallBtn} style={{ marginLeft: 4 }} onClick={() => setIsPersonSelectorOpen(true)}><Plus size={12} /> 목록에서 찾기</button>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    {editingHistoryId && (
                                        <button className={styles.footerBtn} style={{ backgroundColor: '#fa5252', color: 'white', marginRight: 'auto' }} onClick={handleDeleteWorkHistory}>
                                            <Trash2 size={14} /> 삭제
                                        </button>
                                    )}
                                    <button className={styles.footerBtn} style={{ backgroundColor: '#339af0', color: 'white' }} onClick={handleSaveWorkHistory}>
                                        <Save size={14} /> {editingHistoryId ? '수정사항 저장' : '내역저장후 닫기'}
                                    </button>
                                    <button className={styles.footerBtn} onClick={() => setIsWorkHistoryOpen(false)}>
                                        <X size={14} /> 닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Image Preview Modal */}
            {
                previewImage && (
                    <div className={styles.imageModalOverlay} onClick={() => setPreviewImage(null)}>
                        <div className={styles.imageModalContent} onClick={e => e.stopPropagation()}>
                            <button className={styles.closeImageModal} onClick={() => setPreviewImage(null)}>
                                <X size={24} />
                            </button>
                            <img src={previewImage} alt="Preview" />
                        </div>
                    </div>
                )
            }

            {/* Contract History Modal */}
            {isContractModalOpen && (
                <div className={styles.searchModal}>
                    <div className={styles.modalContent} style={{ width: '800px', maxWidth: '95vw' }}>
                        <div className={styles.modalHeader}>
                            <h3>{editingContractId ? '계약히스토리 수정' : '계약히스토리 추가'}</h3>
                            <button type="button" onClick={() => setIsContractModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div className={styles.fieldGrid}>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>계약종류</div>
                                    <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            {['매매', '전세', '월세', '연세'].map(type => (
                                                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="contractType"
                                                        checked={contractForm.type === type}
                                                        onChange={() => setContractForm(prev => ({ ...prev, type }))}
                                                    />
                                                    <span style={{
                                                        backgroundColor: type === '매매' ? '#339af0' : type === '전세' ? '#51cf66' : type === '월세' ? '#ff6b6b' : '#cc5de8',
                                                        color: 'white',
                                                        padding: '2px 8px',
                                                        borderRadius: 4,
                                                        fontSize: 12
                                                    }}>{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>계약자</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} value={contractForm.contractorName} onChange={(e) => setContractForm(prev => ({ ...prev, contractorName: e.target.value }))} />
                                    </div>
                                    <div className={styles.fieldLabel}>연락처</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} value={contractForm.contractorPhone} onChange={(e) => setContractForm(prev => ({ ...prev, contractorPhone: e.target.value }))} />
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>계약일</div>
                                    <div className={styles.fieldValue}>
                                        <input type="date" className={styles.input} value={contractForm.contractDate} onChange={(e) => setContractForm(prev => ({ ...prev, contractDate: e.target.value }))} />
                                    </div>
                                    <div className={styles.fieldLabel}>만기일</div>
                                    <div className={styles.fieldValue}>
                                        <input type="date" className={styles.input} value={contractForm.expirationDate} onChange={(e) => setContractForm(prev => ({ ...prev, expirationDate: e.target.value }))} />
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>보증금</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} style={{ textAlign: 'right' }} value={formatInput(contractForm.deposit)} onChange={(e) => setContractForm(prev => ({ ...prev, deposit: Number(e.target.value.replace(/,/g, '')) }))} />
                                        <span style={{ fontSize: 12, marginLeft: 4 }}>만원</span>
                                    </div>
                                    <div className={styles.fieldLabel}>임대료</div>
                                    <div className={styles.fieldValue}>
                                        <input className={styles.input} style={{ textAlign: 'right' }} value={formatInput(contractForm.monthlyRent)} onChange={(e) => setContractForm(prev => ({ ...prev, monthlyRent: Number(e.target.value.replace(/,/g, '')) }))} />
                                        <span style={{ fontSize: 12, marginLeft: 4 }}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>권리금</div>
                                    <div className={styles.fieldValue} style={{ gridColumn: 'span 3' }}>
                                        <input className={styles.input} style={{ width: '150px', textAlign: 'right' }} value={formatInput(contractForm.premium)} onChange={(e) => setContractForm(prev => ({ ...prev, premium: Number(e.target.value.replace(/,/g, '')) }))} />
                                        <span style={{ fontSize: 12, marginLeft: 4 }}>만원</span>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <div className={styles.fieldLabel}>계약정보</div>
                                    <div className={styles.fieldValue} style={{ gridColumn: 'span 3', height: '120px' }}>
                                        <textarea className={styles.textarea} style={{ height: '100%' }} value={contractForm.details} onChange={(e) => setContractForm(prev => ({ ...prev, details: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                {editingContractId && (
                                    <button className={styles.footerBtn} style={{ backgroundColor: '#fa5252', color: 'white', marginRight: 'auto' }} onClick={handleDeleteContract}>
                                        <Trash2 size={14} /> 삭제
                                    </button>
                                )}
                                <button className={styles.footerBtn} style={{ backgroundColor: '#339af0', color: 'white' }} onClick={handleSaveContract}>
                                    <Save size={14} /> {editingContractId ? '수정사항 저장' : '내역저장후 닫기'}
                                </button>
                                <button className={styles.footerBtn} onClick={() => setIsContractModalOpen(false)}>
                                    <X size={14} /> 닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            <PersonSelectorModal
                isOpen={isPersonSelectorOpen}
                onClose={() => setIsPersonSelectorOpen(false)}
                onSelect={handlePersonSelect}
                companyName={formData.companyName || ''}
                initialTab={personSelectorMode === 'promotedCustomer' ? initialPersonTab : (workHistoryForm.targetType === 'businessCard' ? 'businessCard' : 'customer')}
            />

            {/* Custom Toast */}
            {toast.visible && (
                <div className={styles.toastContainer}>
                    <div className={styles.toastContent}>
                        <Star size={16} fill="#fab005" color="#fab005" />
                        {toast.message}
                    </div>
                </div>
            )}
        </div >
    );
}
