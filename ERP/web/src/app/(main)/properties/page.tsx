"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { Search, Filter, Plus, MoreHorizontal, Printer, Save, Trash2, X, ChevronDown, ChevronUp, Download, ChevronLeft, ChevronRight, Settings, Layout, Check, MapPin, Users, Banknote, Maximize, TrendingUp, Star, Eye, EyeOff, Type, Calendar, FileSpreadsheet, Copy, Upload } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import styles from './page.module.css';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyUploadModal from '@/components/properties/PropertyUploadModal';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { getRequesterId, getStoredCompanyName, getStoredUser } from '@/utils/userUtils';

const Resizer = ({ onResize, onAutoFit }: { onResize: (e: React.MouseEvent) => void, onAutoFit: () => void }) => (
    <div
        className={styles.resizer}
        onMouseDown={onResize}
        onDoubleClick={(e) => {
            e.stopPropagation();
            onAutoFit();
        }}
        onClick={(e) => e.stopPropagation()}
        title="더블 클릭하여 너비 자동 맞춤"
    />
);

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

// Helper: Reverse lookup for industry
const findIndustryByDetail = (detailValues: string[]): { category: string, sector: string } | null => {
    // If multiple details (e.g. from Excel), try to find a match for any
    for (const detail of detailValues) {
        if (!detail) continue;
        const cleanDetail = detail.trim();
        for (const [category, sectors] of Object.entries(INDUSTRY_DATA)) {
            for (const [sector, details] of Object.entries(sectors)) {
                if (details.includes(cleanDetail)) {
                    return { category, sector };
                }
                // Also check if matches sector name
                if (sector === cleanDetail) {
                    return { category, sector };
                }
            }
        }
    }
    return null;
};

type SortKey = 'name' | 'createdAt' | 'deposit' | 'monthlyRent' | 'premium' | 'area' | 'totalPrice' | 'monthlyProfit' | 'monthlyRevenue' | 'yield';
type SortDirection = 'asc' | 'desc';
type SortRule = { key: SortKey; direction: SortDirection; };

// Kakao Map SDK URL (Same as Register Page)
const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=26c1197bae99e17f8c1f3e688e22914d&libraries=services,drawing&autoload=false`;

function PropertiesPageContent() {
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('center');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fetchControllerRef = useRef<AbortController | null>(null);
    const [isCustomLimit, setIsCustomLimit] = useState(false);


    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info'; onClose?: () => void }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void; isDanger?: boolean }>({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        isDanger: false
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
        setAlertConfig({ isOpen: true, message, type, onClose });
    };

    const closeAlert = () => {
        if (alertConfig.onClose) alertConfig.onClose();
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    const showConfirm = (message: string, onConfirm: () => void, isDanger = false) => {
        setConfirmModal({ isOpen: true, message, onConfirm, isDanger });
    };


    // Advanced Filter State
    const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
    const [openFilterId, setOpenFilterId] = useState<string | null>(null);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // UI Refs
    const filterContainerRef = React.useRef<HTMLDivElement>(null);
    const toolbarFilterRef = React.useRef<HTMLDivElement>(null);
    const sortDropdownRef = React.useRef<HTMLDivElement>(null);
    const columnSelectorRef = React.useRef<HTMLDivElement>(null);
    const [isInlineMenuOpen, setIsInlineMenuOpen] = useState(false);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [columnSearchTerm, setColumnSearchTerm] = useState('');
    const [draggedSortIndex, setDraggedSortIndex] = useState<number | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);



    // Click outside to close filter popovers & ESC key support
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideFilterBar = filterContainerRef.current?.contains(target);
            const isInsideToolbarFilter = toolbarFilterRef.current?.contains(target);
            const isInsideSort = sortDropdownRef.current?.contains(target);
            const isInsideColumnSelector = columnSelectorRef.current?.contains(target);
            const isContainerBackground = target === filterContainerRef.current;

            // Close if clicked outside OR if clicked directly on the container background (gap area)
            if ((!isInsideFilterBar && !isInsideToolbarFilter && !isInsideSort && !isInsideColumnSelector) || isContainerBackground) {
                setOpenFilterId(null);
                setIsInlineMenuOpen(false);
                setIsFilterMenuOpen(false);
                setIsSortDropdownOpen(false);
                setIsColumnSelectorOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenFilterId(null);
                setIsInlineMenuOpen(false);
                setIsFilterMenuOpen(false);
                setIsSortDropdownOpen(false);
                setIsColumnSelectorOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const hasFilterValue = (key: string) => {
        if (key === 'status') return statusFilter.length > 0;
        if (key === 'type') return typeFilter.length > 0;
        if (key === 'address') return addressFilter.trim().length > 0;
        if (key === 'manager') return managerFilters.length > 0;
        if (key === 'area') return areaFilter.min !== '' || areaFilter.max !== '';
        if (key === 'floor') return floorFilter.min !== '' || floorFilter.max !== '';
        if (key === 'premium') return priceFilter.premiumMin !== '' || priceFilter.premiumMax !== '';
        if (key === 'deposit') return priceFilter.depositMin !== '' || priceFilter.depositMax !== '';
        if (key === 'monthlyRent') return priceFilter.rentMin !== '' || priceFilter.rentMax !== '';
        if (key === 'totalPrice') return priceFilter.totalMin !== '' || priceFilter.totalMax !== '';
        if (key === 'monthlyProfit') return priceFilter.profitMin !== '' || priceFilter.profitMax !== '';
        if (key === 'monthlyRevenue') return priceFilter.revenueMin !== '' || priceFilter.revenueMax !== '';
        if (key === 'yield') return priceFilter.yieldMin !== '' || priceFilter.yieldMax !== '';
        if (key === 'price') return Object.values(priceFilter).some(v => v !== ''); // Legacy/Combined check
        if (key === 'industryDetail') return industryDetailFilter.length > 0;
        if (key === 'operationType') return operationTypeFilter.length > 0; // New: Operation Type Filter
        if (key === 'isFavorite') return showFavoritesOnly; // New: Favorite Filter
        return false;
    };

    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [addressFilter, setAddressFilter] = useState('');
    const [managerFilters, setManagerFilters] = useState<string[]>([]);
    const [typeFilter, setTypeFilter] = useState<string[]>([]);
    const [industryDetailFilter, setIndustryDetailFilter] = useState<string[]>([]);
    // Operation Type Filter
    const [operationTypeFilter, setOperationTypeFilter] = useState<string[]>([]);

    // Favorite Filter
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const [priceFilter, setPriceFilter] = useState({
        depositMin: '', depositMax: '',
        rentMin: '', rentMax: '',
        premiumMin: '', premiumMax: '',
        totalMin: '', totalMax: '',
        profitMin: '', profitMax: '',
        revenueMin: '', revenueMax: '',
        yieldMin: '', yieldMax: '',
    });

    const [areaFilter, setAreaFilter] = useState({ min: '', max: '' });
    const [floorFilter, setFloorFilter] = useState({ min: '', max: '' });


    // Sort & Pagination State
    // Refactored to support multiple sort rules
    type SortRule = { key: SortKey, direction: SortDirection };
    const [sortRules, setSortRules] = useState<SortRule[]>([{ key: 'createdAt', direction: 'desc' }]);
    const [isAddingSort, setIsAddingSort] = useState(false); // New state to toggle picker view
    // const [sortConfig, setSortConfig] = useState<{ key: SortKey | null, direction: SortDirection }>({ key: 'createdAt', direction: 'desc' }); // DEPRECATED
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [limit, setLimit] = useState<number | 'all'>(500); // 기본값 500건

    // 저장된 Limit / ItemsPerPage 불러오기
    useEffect(() => {
        const savedLimit = localStorage.getItem('propertyLimit');
        if (savedLimit) {
            const val = savedLimit === 'all' ? 'all' : Number(savedLimit);
            setLimit(val);
            // 표준 옵션이 아닌 경우 직접입력 모드로 전환
            const standardOptions: (number | string)[] = [100, 300, 500, 1000, 'all'];
            if (!standardOptions.includes(val)) {
                setIsCustomLimit(true);
            }
        }
        const savedItemsPerPage = localStorage.getItem('propertyItemsPerPage');
        if (savedItemsPerPage) {
            setItemsPerPage(Number(savedItemsPerPage));
        }
    }, []);

    // Limit 드롭다운 변경 핸들러
    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'custom') {
            setIsCustomLimit(true);
            // 아직 limit 값은 변경하지 않고 UI만 전환
        } else {
            const numVal = val === 'all' ? 'all' : Number(val);
            setLimit(numVal);
            localStorage.setItem('propertyLimit', numVal.toString());
            setIsCustomLimit(false);
        }
    };

    // 직접입력 핸들러
    const handleCustomLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
            setLimit(val);
            localStorage.setItem('propertyLimit', val.toString());
        }
    };

    // 페이지당 표시 건수 변경 핸들러
    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setItemsPerPage(val);
        setCurrentPage(1); // 첫 페이지로 리셋
        localStorage.setItem('propertyItemsPerPage', val.toString());
    };

    // Initial Filter Data
    const [managers, setManagers] = useState<{ id: string, name: string }[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null); // Track logged-in user

    // Area Unit State (Global for this page)
    const [areaUnit, setAreaUnit] = useState<'pyeong' | 'm2'>('pyeong');
    const PYEONG_TO_M2 = 3.305785;

    useEffect(() => {
        const user = getStoredUser();
        let query = '';
        if (user) {
            setCurrentUser(user); // Set current user state
            const companyName = getStoredCompanyName(user);
            const requesterId = getRequesterId(user);

            if (companyName) {
                query = `?company=${encodeURIComponent(companyName)}`;
                if (requesterId) {
                    query += `&requesterId=${encodeURIComponent(requesterId)}`;
                }
            } else if (requesterId) {
                setManagers([{ id: requesterId, name: String(user.name || requesterId) }]);
            }
        }
        if (query) {
            fetch(`/api/users${query}`).then(res => res.json()).then(data => setManagers(data)).catch(err => console.error(err));
        }
    }, []);



    // Column Resizing & Visibility State
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
        'no', 'isFavorite', 'processStatus', 'name', 'grade', 'address', 'status', 'type', 'industryDetail', 'operationType', 'features', 'floor', 'area',
        'deposit', 'monthlyRent', 'premium', 'totalPrice', 'monthlyProfit', 'monthlyRevenue',
        'manager', 'createdAt', 'updatedAt'
    ]));

    const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
        no: 50, isFavorite: 40, processStatus: 80, name: 200, grade: 80, address: 250, status: 80, type: 100, industryDetail: 100, operationType: 100, features: 150,
        floor: 60, area: 80, deposit: 100, monthlyRent: 100, premium: 100, totalPrice: 100,
        monthlyProfit: 100, monthlyRevenue: 100, yield: 80, manager: 80, createdAt: 100, updatedAt: 100
    });

    // Column Reordering State
    const [columnOrder, setColumnOrder] = useState<string[]>([
        'no', 'isFavorite', 'processStatus', 'grade', 'name', 'address', 'status', 'type', 'industryDetail', 'operationType', 'features', 'floor', 'area',
        'deposit', 'monthlyRent', 'premium', 'totalPrice', 'monthlyProfit', 'monthlyRevenue', 'yield',
        'manager', 'createdAt', 'updatedAt'
    ]);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

    // Z-Index Management (Last Active Dropdown)
    const [lastActiveDropdown, setLastActiveDropdown] = useState<'filter' | 'columns' | null>(null);

    // Load all saved settings on mount
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                const savedSettingsStr = localStorage.getItem(`property_settings_${user.id}`);

                // Legacy support for column order if unified settings don't exist
                const legacyOrder = localStorage.getItem(`property_column_order_${user.id}`);

                if (savedSettingsStr) {
                    const settings = JSON.parse(savedSettingsStr);

                    // SortRules Support & Migration
                    let loadedRules = settings.sortRules || (settings.sortConfig ? [settings.sortConfig] : []);
                    loadedRules = loadedRules.map((r: any) => ({ ...r, key: (r.key === 'monthlyIncome' ? 'monthlyProfit' : r.key) as SortKey }));
                    setSortRules(loadedRules);

                    if (settings.activeFilters) {
                        const af = new Set(settings.activeFilters as string[]);
                        if (af.has('monthlyIncome')) { af.delete('monthlyIncome'); af.add('monthlyProfit'); }
                        setActiveFilters(af);
                    }
                    if (settings.visibleColumns) {
                        const vc = new Set(settings.visibleColumns as string[]);
                        if (vc.has('monthlyIncome')) { vc.delete('monthlyIncome'); vc.add('monthlyProfit'); }
                        setVisibleColumns(vc);
                    }
                    if (settings.statusFilter) setStatusFilter(settings.statusFilter);
                    if (settings.typeFilter) setTypeFilter(settings.typeFilter);
                    if (settings.industryDetailFilter) setIndustryDetailFilter(settings.industryDetailFilter);
                    if (settings.addressFilter) setAddressFilter(settings.addressFilter);
                    if (settings.managerFilters) setManagerFilters(settings.managerFilters);
                    if (settings.priceFilter) {
                        // Migrate priceFilter
                        if (settings.priceFilter.incomeMin) {
                            settings.priceFilter.profitMin = settings.priceFilter.incomeMin;
                            delete settings.priceFilter.incomeMin;
                        }
                        if (settings.priceFilter.incomeMax) {
                            settings.priceFilter.profitMax = settings.priceFilter.incomeMax;
                            delete settings.priceFilter.incomeMax;
                        }
                        setPriceFilter(settings.priceFilter);
                    }
                    if (settings.areaFilter) setAreaFilter(settings.areaFilter);
                    if (settings.floorFilter) setFloorFilter(settings.floorFilter);
                    if (typeof settings.showFavoritesOnly === 'boolean') setShowFavoritesOnly(settings.showFavoritesOnly);

                    // Merge column order & Migrate
                    if (settings.columnOrder) {
                        let order = settings.columnOrder.map((k: string) => k === 'monthlyIncome' ? 'monthlyProfit' : k);
                        // Deduplicate logic
                        order = Array.from(new Set(order));
                        const currentKeys = Object.keys(columnWidths);
                        // Filter out invalid keys from order (optional, but safer) and append missing keys
                        order = order.filter((k: string) => currentKeys.includes(k));
                        const missingKeys = currentKeys.filter(key => !order.includes(key));
                        setColumnOrder([...order, ...missingKeys]);
                    }
                } else if (legacyOrder) {
                    // Fallback to legacy column order if new settings aren't found
                    const savedOrder = JSON.parse(legacyOrder);
                    let order = savedOrder.map((k: string) => k === 'monthlyIncome' ? 'monthlyProfit' : k);
                    const currentKeys = Object.keys(columnWidths);
                    const missingKeys = currentKeys.filter(key => !order.includes(key));
                    setColumnOrder([...order, ...missingKeys]);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        }
    }, [columnWidths]);

    // Save settings on change
    // Save settings on change
    useEffect(() => {
        if (!currentUser) return;

        const settings = {
            sortRules, // Saved as array now
            activeFilters: Array.from(activeFilters), // Convert Set to Array
            visibleColumns: Array.from(visibleColumns), // Convert Set to Array
            columnOrder,
            statusFilter,
            typeFilter,
            industryDetailFilter,
            addressFilter,
            managerFilters,
            priceFilter,
            areaFilter,
            floorFilter,
            showFavoritesOnly
        };

        localStorage.setItem(`property_settings_${currentUser.id}`, JSON.stringify(settings));
        // Also keep legacy column order for safety or other components if any
        localStorage.setItem(`property_column_order_${currentUser.id}`, JSON.stringify(columnOrder));

    }, [
        currentUser, sortRules, activeFilters, visibleColumns, columnOrder,
        statusFilter, typeFilter, industryDetailFilter, addressFilter, managerFilters, priceFilter, areaFilter, floorFilter, showFavoritesOnly
    ]);

    const handleColumnDragStart = (e: React.DragEvent, column: string) => {
        setDraggedColumn(column);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column);
    };

    const handleColumnDragOver = (e: React.DragEvent, column: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleColumnDrop = (e: React.DragEvent, targetColumn: string) => {
        e.preventDefault();
        if (!draggedColumn || draggedColumn === targetColumn) return;

        const newOrder = [...columnOrder];
        const draggedIdx = newOrder.indexOf(draggedColumn);
        const targetIdx = newOrder.indexOf(targetColumn);

        newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, draggedColumn);

        setColumnOrder(newOrder);
        setDraggedColumn(null);

        // Save to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                localStorage.setItem(`property_column_order_${user.id}`, JSON.stringify(newOrder));
            } catch (e) {
                console.error("Failed to save column order", e);
            }
        }
    };

    // Drawer Resizing State
    const [drawerWidth, setDrawerWidth] = useState(900);
    const drawerResizingRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

    const handleDrawerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        drawerResizingRef.current = {
            startX: e.clientX,
            startWidth: drawerWidth,
        };
        document.addEventListener('mousemove', handleDrawerMouseMove);
        document.addEventListener('mouseup', handleDrawerMouseUp);
        document.body.style.cursor = 'ew-resize';
    };

    const handleDrawerMouseMove = React.useCallback((e: MouseEvent) => {
        if (!drawerResizingRef.current) return;
        const { startX, startWidth } = drawerResizingRef.current;
        const diff = startX - e.clientX; // Dragging left increases width
        const newWidth = Math.max(400, Math.min(window.innerWidth * 0.9, startWidth + diff));
        setDrawerWidth(newWidth);
    }, []);

    const handleDrawerMouseUp = React.useCallback(() => {
        drawerResizingRef.current = null;
        document.removeEventListener('mousemove', handleDrawerMouseMove);
        document.removeEventListener('mouseup', handleDrawerMouseUp);
        document.body.style.cursor = '';
    }, [handleDrawerMouseMove]);

    // Cleanup for both resizers
    useEffect(() => {
        return () => {
            // ... existing cleanup
            document.removeEventListener('mousemove', handleDrawerMouseMove);
            document.removeEventListener('mouseup', handleDrawerMouseUp);
        };
    }, [handleDrawerMouseMove]);

    const resizingRef = React.useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent, column: string) => {
        e.preventDefault();
        resizingRef.current = {
            column,
            startX: e.clientX,
            startWidth: columnWidths[column] || 100,
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { column, startX, startWidth } = resizingRef.current;
        const diff = e.clientX - startX;
        const newWidth = Math.max(30, startWidth + diff); // Min width 30px

        setColumnWidths((prev) => ({
            ...prev,
            [column]: newWidth,
        }));
    }, []);

    const handleMouseUp = React.useCallback(() => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleDrawerMouseMove); // Note: Original code had typo here, referencing drawer handler
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
    }, [handleDrawerMouseMove, handleMouseMove]); // Cleaned up deps

    const fetchProperties = React.useCallback(async () => {
        // Cancel previous request
        if (fetchControllerRef.current) {
            fetchControllerRef.current.abort();
        }
        const controller = new AbortController();
        fetchControllerRef.current = controller;

        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            const user = getStoredUser();

            if (user) {
                const requesterId = getRequesterId(user);
                const companyName = getStoredCompanyName(user);
                const isAdmin = user.role === 'admin' || user.id === 'admin';

                if (requesterId) {
                    params.append('requesterId', requesterId);
                }
                if (companyName && !isAdmin) {
                    params.append('company', companyName);
                }
            }

            // Limit
            if (limit !== 'all') {
                params.append('limit', limit.toString());
            }

            const queryString = params.toString() ? `?${params.toString()}` : '';

            const res = await fetch(`/api/properties${queryString}`, { signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                setProperties(data);
            } else {
                setProperties([]);
                console.error('Failed to fetch properties:', await res.text());
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to fetch properties:', error);
        } finally {
            if (fetchControllerRef.current === controller) {
                fetchControllerRef.current = null;
                setIsLoading(false);
            }
        }
    }, [limit]);

    useEffect(() => {
        fetchProperties();
    }, [fetchProperties]);

    // Selection Handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSelected = new Set(selectedIds);
        if (e.target.checked) {
            paginatedProperties.forEach(p => newSelected.add(p.id));
        } else {
            paginatedProperties.forEach(p => newSelected.delete(p.id));
        }
        setSelectedIds(newSelected);
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            showAlert('삭제할 항목을 선택해주세요.', 'error');
            return;
        }

        showConfirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`, async () => {
            setIsLoading(true);
            try {
                const userStr = localStorage.getItem('user');
                const parsed = userStr ? JSON.parse(userStr) : {};
                const user = parsed.user || parsed;
                const userCompanyName = user?.companyName || '';
                const requesterId = user?.uid || user?.id || '';

                // Sequential delete as API likely doesn't support bulk yet
                // Ideally: await fetch('/api/properties/bulk-delete', { ... })
                const deletePromises = Array.from(selectedIds).map(id =>
                    fetch(`/api/properties?id=${id}&company=${encodeURIComponent(userCompanyName)}&requesterId=${encodeURIComponent(requesterId)}`, { method: 'DELETE' })
                );

                await Promise.all(deletePromises);

                showAlert('삭제되었습니다.', 'success');
                setSelectedIds(new Set());
                fetchProperties(); // Refresh list
            } catch (error) {
                console.error('Failed to delete properties:', error);
                showAlert('삭제 중 오류가 발생했습니다.', 'error');
            } finally {
                setIsLoading(false);
            }
        }, true);
    };

    // -------------------------------------------------------------------------
    // Logic & Handlers
    // -------------------------------------------------------------------------

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'manage': return <span className={`${styles.statusBadge} ${styles.manage}`}>관리</span>;
            case 'hold': return <span className={`${styles.statusBadge} ${styles.hold}`}>보류</span>;
            case 'progress': return <span className={`${styles.statusBadge} ${styles.progress}`}>추진</span>;
            case 'common': case 'joint': return <span className={`${styles.statusBadge} ${styles.common}`}>공동</span>;
            case 'complete': return <span className={`${styles.statusBadge} ${styles.complete}`}>완료</span>;
            default: return <span className={styles.statusBadge}>{status}</span>;
        }
    };

    const measureTextWidth = (text: string, font: string) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
            context.font = font;
            return context.measureText(text).width;
        }
        return 0;
    };

    const handleAutoFit = (column: string) => {
        const font = '14px "Pretendard", sans-serif';
        const padding = 60;
        let maxWidth = 0;

        const headerText = {
            status: '상태', name: '물건명', address: '주소', type: '업종', floor: '층수',
            area: '면적', deposit: '보증금', monthlyRent: '월세', premium: '권리금', createdAt: '등록일'
        }[column] || '';
        maxWidth = Math.max(maxWidth, measureTextWidth(headerText, font));

        filteredProperties.forEach(item => {
            let text = String(item[column] || '');
            if (column === 'status') text = '관리';
            else if (column === 'createdAt') text = new Date(item.createdAt).toLocaleDateString();
            else if (column === 'floor') text = `${item.floor}층`;
            else if (column === 'area') text = `${item.area}평`;
            maxWidth = Math.max(maxWidth, measureTextWidth(text, font));
        });
        if (column === 'status') maxWidth += 20;

        setColumnWidths(prev => ({ ...prev, [column]: Math.ceil(maxWidth + padding) }));
    };

    const handleSort = (key: SortKey) => {
        // Table Header Click Behavior:
        // Replace all rules with typical single sort toggle
        setSortRules(prev => {
            if (prev.length > 0 && prev[0].key === key) {
                // Toggle direction
                return [{ key, direction: prev[0].direction === 'asc' ? 'desc' : 'asc' }];
            }
            // New key
            return [{ key, direction: 'asc' }];
        });
    };

    const toggleStatusFilter = (status: string) => {
        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
        setCurrentPage(1);
    };

    const filteredProperties = useMemo(() => {
        let result = [...properties];

        // 1. Search Term
        // 1. Search Term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p => {
                // Search ALL fields in the property object (Deep Search)
                // This converts the entire object to a string and checks if the term exists.
                // It covers top-level fields, arrays (like operationCustomFields), and nested objects.
                return JSON.stringify(p).toLowerCase().includes(term);
            });
        }

        // 2. Status Filter
        if (statusFilter.length > 0) result = result.filter(p => statusFilter.includes(p.status));

        // 3. Address Filter
        if (addressFilter) result = result.filter(p => (p.address || '').toLowerCase().includes(addressFilter.toLowerCase()));

        // 4. Manager Filter
        // 4. Manager Filter (Multi-select)
        if (managerFilters.length > 0) {
            result = result.filter(p => {
                // strict match by ID first
                if (p.managerId) {
                    return managerFilters.includes(p.managerId);
                }
                // fallback to name match ONLY if ID is missing (legacy)
                const selectedManagers = managers.filter(m => managerFilters.includes(m.id));
                const selectedNames = selectedManagers.map(m => m.name);
                return selectedNames.includes(p.managerName) || selectedNames.includes(p.manager);
            });
        }

        // 5. Price & Area & Floor
        // 5. Price & Area & Floor & New Filters
        const parsePrice = (val: any) => parseFloat(String(val).replace(/,/g, '')) || 0;

        // Type
        if (typeFilter.length > 0) result = result.filter(p => typeFilter.includes(p.industrySector));
        if (industryDetailFilter.length > 0) result = result.filter(p => industryDetailFilter.includes(p.industryDetail));

        // Operation Type
        if (operationTypeFilter.length > 0) result = result.filter(p => operationTypeFilter.includes(p.operationType));

        // Favorite
        if (showFavoritesOnly) result = result.filter(p => p.isFavorite);

        // Floor
        if (floorFilter.min) result = result.filter(p => parseFloat(p.floor || p.currentFloor) >= parseFloat(floorFilter.min));
        if (floorFilter.max) result = result.filter(p => parseFloat(p.floor || p.currentFloor) <= parseFloat(floorFilter.max));

        // Area
        if (areaFilter.min) result = result.filter(p => parseFloat(p.area) >= parseFloat(areaFilter.min));
        if (areaFilter.max) result = result.filter(p => parseFloat(p.area) <= parseFloat(areaFilter.max));

        // Financials
        if (priceFilter.depositMin) result = result.filter(p => parsePrice(p.deposit) >= parsePrice(priceFilter.depositMin));
        if (priceFilter.depositMax) result = result.filter(p => parsePrice(p.deposit) <= parsePrice(priceFilter.depositMax));

        if (priceFilter.rentMin) result = result.filter(p => parsePrice(p.monthlyRent) >= parsePrice(priceFilter.rentMin));
        if (priceFilter.rentMax) result = result.filter(p => parsePrice(p.monthlyRent) <= parsePrice(priceFilter.rentMax));

        if (priceFilter.premiumMin) result = result.filter(p => parsePrice(p.premium) >= parsePrice(priceFilter.premiumMin));
        if (priceFilter.premiumMax) result = result.filter(p => parsePrice(p.premium) <= parsePrice(priceFilter.premiumMax));

        if (priceFilter.totalMin) result = result.filter(p => (parsePrice(p.deposit) + parsePrice(p.premium)) >= parsePrice(priceFilter.totalMin));
        if (priceFilter.totalMax) result = result.filter(p => (parsePrice(p.deposit) + parsePrice(p.premium)) <= parsePrice(priceFilter.totalMax));

        if (priceFilter.profitMin) result = result.filter(p => parsePrice(p.monthlyProfit) >= parsePrice(priceFilter.profitMin));
        if (priceFilter.profitMax) result = result.filter(p => parsePrice(p.monthlyProfit) <= parsePrice(priceFilter.profitMax));

        if (priceFilter.revenueMin) result = result.filter(p => parsePrice(p.monthlyRevenue) >= parsePrice(priceFilter.revenueMin));
        if (priceFilter.revenueMax) result = result.filter(p => parsePrice(p.monthlyRevenue) <= parsePrice(priceFilter.revenueMax));

        if (priceFilter.yieldMin) result = result.filter(p => parsePrice(p.yieldPercent) >= parsePrice(priceFilter.yieldMin));
        if (priceFilter.yieldMax) result = result.filter(p => parsePrice(p.yieldPercent) <= parsePrice(priceFilter.yieldMax));

        // 6. Sorting (Multi-Level)
        if (sortRules.length > 0) {
            result.sort((a, b) => {
                for (const rule of sortRules) {
                    const aVal = a[rule.key] || '';
                    const bVal = b[rule.key] || '';

                    let comparison = 0;

                    if (['deposit', 'monthlyRent', 'premium', 'area', 'totalPrice', 'monthlyProfit', 'monthlyRevenue', 'yield'].includes(rule.key)) {
                        const aNum = parsePrice(aVal);
                        const bNum = parsePrice(bVal);
                        comparison = aNum - bNum;
                    } else if (rule.key === 'createdAt') {
                        // Compare by Date Only (YYYY-MM-DD) to allow secondary sort for same-day items
                        const aDate = new Date(aVal).toLocaleDateString('en-CA'); // YYYY-MM-DD
                        const bDate = new Date(bVal).toLocaleDateString('en-CA');
                        comparison = aDate.localeCompare(bDate);
                    } else {
                        comparison = String(aVal).localeCompare(String(bVal));
                    }

                    if (comparison !== 0) {
                        return rule.direction === 'asc' ? comparison : -comparison;
                    }
                }
                return 0; // Equal
            });
        }
        return result;
    }, [properties, searchTerm, statusFilter, addressFilter, managerFilters, priceFilter, areaFilter, floorFilter, typeFilter, sortRules, showFavoritesOnly]);

    // Pagination
    const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
    const paginatedProperties = filteredProperties.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [searchTerm, priceFilter, areaFilter, statusFilter, managerFilters, addressFilter, showFavoritesOnly]);

    // Excel Export
    const handleExcelExport = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(filteredProperties.map(p => ({
            상태: p.status, 물건명: p.name, 주소: p.address, 업종: p.type, 층수: p.floor,
            면적: p.area, 보증금: p.deposit, 월세: p.monthlyRent, 권리금: p.premium, 등록일: p.createdAt
        })));
        XLSX.utils.book_append_sheet(wb, ws, "점포목록");
        XLSX.writeFile(wb, `점포매물목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Industry Data (Synced with PropertyCard.tsx)
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

    const findIndustryByDetail = (detailNames: string[]) => {
        for (const detailName of detailNames) {
            if (!detailName) continue;
            const cleanName = detailName.trim();
            for (const [category, sectors] of Object.entries(INDUSTRY_DATA)) {
                for (const [sector, details] of Object.entries(sectors)) {
                    if (details.includes(cleanName) || sector === cleanName) {
                        return { category, sector };
                    }
                }
            }
        }
        return { category: '', sector: '' };
    };

    const handleUploadSuccess = () => {
        fetchProperties();
    };

    const handleToggleFavorite = async (id: string, current: boolean) => {
        try {
            const requesterId = currentUser?.uid || currentUser?.id || '';
            const res = await fetch(`/api/properties?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !current, requesterId })
            });
            if (res.ok) {
                setProperties(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !current } : p));
            }
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
        }
    };

    const handleRowClick = (propertyId: string) => {
        if (viewMode === 'page') {
            router.push(`/properties/${propertyId}`);
        } else {
            setSelectedPropertyId(propertyId);
        }
    };

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);

    const handleModeChange = (mode: ViewMode) => {
        // alert(`모드 변경: ${mode}`); // Debug alert
        setViewMode(mode);
    };

    // Helper to render cell content based on column key
    const renderCell = (item: any, column: string, index: number) => {
        switch (column) {
            case 'no': return <td style={{ textAlign: 'center' }}>{(currentPage - 1) * itemsPerPage + index + 1}</td>;
            case 'isFavorite':
                return (
                    <td style={{ textAlign: 'center', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <button
                                onClick={() => handleToggleFavorite(item.id, item.isFavorite)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                            >
                                <Star
                                    size={16}
                                    fill={item.isFavorite ? '#fab005' : 'transparent'}
                                    color={item.isFavorite ? '#fab005' : '#ccc'}
                                />
                            </button>
                        </div>
                    </td>
                );
            case 'name': return <td className={styles.cellPrimary} title={item.name}>{item.name}</td>;
            case 'processStatus':
                return (
                    <td className={styles.cellCompact} style={{ minWidth: '100px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(item.processStatus || '').split(',').filter(Boolean).map((status: string, idx: number) => (
                                <span key={idx} style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    backgroundColor: '#7950f2',
                                    color: 'white'
                                }}>
                                    {status.trim()}
                                </span>
                            ))}
                        </div>
                    </td>
                );
            case 'grade': return <td className={styles.cellCompact}>{getStatusBadge(item.status)}</td>;
            case 'address': return <td title={item.address}>{item.address}</td>;
            case 'status': return <td>{item.industryCategory || '-'}</td>;
            case 'type': return <td>{item.industrySector || '-'}</td>;
            case 'industryDetail': return <td>{item.industryDetail || '-'}</td>;
            case 'operationType':
                const opTypes = (item.operationType || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                if (opTypes.length === 0) return <td>-</td>;
                return (
                    <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {opTypes.map((type: string) => (
                                <span key={type} style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    backgroundColor:
                                        type === '직영' ? '#339af0' :
                                            type === '풀오토' ? '#51cf66' :
                                                type === '반오토' ? '#22b8cf' :
                                                    type === '위탁' ? '#ff922b' :
                                                        type === '본사' ? '#845ef7' :
                                                            '#adb5bd'
                                }}>
                                    {type}
                                </span>
                            ))}
                        </div>
                    </td>
                );
            case 'features': return <td title={item.featureMemo}>{item.featureMemo || '-'}</td>;
            case 'floor': return <td>{item.floor || item.currentFloor}층</td>;
            case 'area':
                return (
                    <td>
                        {areaUnit === 'pyeong'
                            ? `${item.area}평`
                            : `${(Number(item.area) * PYEONG_TO_M2).toFixed(2)}m²`
                        }
                    </td>
                );
            case 'deposit': return <td>{item.deposit ? `${Number(item.deposit).toLocaleString()}만 원` : '-'}</td>;
            case 'monthlyRent': return <td>{item.monthlyRent ? `${Number(item.monthlyRent).toLocaleString()}만 원` : '-'}</td>;
            case 'premium': return <td>{item.premium ? `${Number(item.premium).toLocaleString()}만 원` : '-'}</td>;
            case 'totalPrice': return <td style={{ fontWeight: 'bold' }}>{((Number(item.deposit || 0) + Number(item.premium || 0))).toLocaleString()}만 원</td>;
            case 'monthlyProfit': return <td>{item.monthlyProfit ? `${Number(item.monthlyProfit).toLocaleString()}만 원` : '-'}</td>;
            case 'monthlyIncome': return <td>{item.monthlyProfit ? `${Number(item.monthlyProfit).toLocaleString()}만 원` : '-'}</td>; // Fallback for old data
            case 'monthlyRevenue': return <td>{item.monthlyRevenue ? `${Number(item.monthlyRevenue).toLocaleString()}만 원` : '-'}</td>;
            case 'yield': return <td>{item.yieldPercent ? `${Number(item.yieldPercent).toFixed(2)}%` : '-'}</td>;
            case 'manager': {
                const matchedManager = managers.find(m => m.id === item.managerId);
                return <td>{matchedManager ? matchedManager.name : (item.managerName || item.manager || '-')}</td>;
            }
            case 'createdAt': return <td>{new Date(item.createdAt).toLocaleDateString()}</td>;
            case 'updatedAt': return <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</td>;
            default: return null;
        }
    };

    const getLabel = (col: string) => {
        return {
            address: '주소', status: '업종(대분류)', type: '업종(중분류)', industryDetail: '업종(소분류)', operationType: '운영형태', processStatus: '진행상황', features: '특징', floor: '층수', area: '실면적',
            deposit: '보증금', monthlyRent: '임대료', premium: '권리금', totalPrice: '합계',
            monthlyProfit: '월순익', monthlyRevenue: '월매출', manager: '담당자',
            createdAt: '등록일', updatedAt: '최종작성일', yield: '수익률'
        }[col] || col;
    };

    // Legacy getHeaderLabel (kept for table headers mostly but can assume overlap)
    const getHeaderLabel = (column: string) => {
        const labels: { [key: string]: string } = {
            no: 'NO', isFavorite: '★', processStatus: '진행상황', name: '물건명', grade: '물건등급', address: '주소', status: '업종(대분류)', type: '업종(중분류)', industryDetail: '업종(소분류)', operationType: '운영형태',
            features: '특징', floor: '층수', area: '면적', deposit: '보증금', monthlyRent: '임대료', premium: '권리금',
            totalPrice: '합계', monthlyProfit: '월순수익', monthlyRevenue: '월매출', manager: '담당자', createdAt: '등록일', updatedAt: '최종작성',
            yield: '수익률', monthlyIncome: '월순수익' // Fallback for old data

        };
        // Use Star icon for header if key is isFavorite
        // Changed to yellow star as requested
        if (column === 'isFavorite') return <Star size={14} fill="#fab005" color="#fab005" />;

        return labels[column] || column;
    };

    // Calculate total width based on RENDERED columns only to prevent ghost space
    const renderedColumns = columnOrder.filter(col => visibleColumns.has(col));
    const tableWidth = 40 + renderedColumns.reduce((acc, col) => acc + (columnWidths[col] || 100), 0) + (renderedColumns.length * 2);
    const totalWidth = tableWidth; // Keep totalWidth for compatibility if used elsewhere

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="물건명, 주소, 연락처 등 전체 db 검색"
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#888'
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                {/* Add Filter Button (Moved to Filter Bar) */}
                <div className={styles.actions}>

                    {/* VIEW MODE SWITCHER - Desktop Only */}
                    <div className="hidden md:block">
                        <ViewModeSwitcher currentMode={viewMode} onModeChange={handleModeChange} />
                    </div>

                    {/* SORT BUTTON - Flexible on Mobile */}
                    <div className="relative flex-1 md:flex-none" ref={sortDropdownRef}>
                        <button
                            className={`${styles.actionBtn} ${isSortDropdownOpen ? styles.active : ''} w-full justify-between md:w-auto md:justify-start whitespace-nowrap`}
                            style={sortRules.length > 0 ? { color: '#228be6', borderColor: '#228be6', backgroundColor: '#e7f5ff' } : {}}
                            onClick={() => {
                                setIsSortDropdownOpen(!isSortDropdownOpen);
                                setIsColumnSelectorOpen(false);
                                // Default to picker if empty, else rules list (adding is false)
                                setIsAddingSort(sortRules.length === 0);
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Layout size={16} />
                                <span>
                                    {sortRules.length === 0 ? '정렬' : // Just "정렬" if empty
                                        sortRules.length === 1 ?
                                            {
                                                createdAt: '등록일', name: '물건명', area: '면적',
                                                deposit: '보증금', monthlyRent: '월세', premium: '권리금',
                                                totalPrice: '합계', monthlyIncome: '월순수익', monthlyProfit: '월순수익', monthlyRevenue: '월매출', yield: '수익률'
                                            }[sortRules[0].key] || '정렬'
                                            : `정렬 ${sortRules.length}개`}
                                </span>
                            </div>
                            <ChevronDown size={14} />
                        </button>
                        {isSortDropdownOpen && (
                            <div className={styles.dropdownMenu} style={{
                                width: (isAddingSort || sortRules.length === 0) ? 200 : 320,
                                zIndex: 1001,
                                left: 0, right: 'auto' // Fix left alignment
                            }}>
                                {isAddingSort || sortRules.length === 0 ? (
                                    // FIELD PICKER VIEW
                                    <>
                                        <div className={styles.dropdownHeader} style={{ position: 'relative', paddingRight: '24px' }}>
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="정렬 기준"
                                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                        </div>
                                        <div style={{ padding: '8px 0', maxHeight: '300px', overflowY: 'auto' }}>
                                            {[
                                                { key: 'createdAt', label: '등록일', icon: Calendar },
                                                { key: 'name', label: '물건명', icon: Type },
                                                { key: 'area', label: '면적', icon: Maximize },
                                                { key: 'deposit', label: '보증금', icon: Banknote },
                                                { key: 'monthlyRent', label: '월세', icon: Banknote },
                                                { key: 'premium', label: '권리금', icon: Banknote },
                                                { key: 'totalPrice', label: '합계', icon: Banknote },
                                                { key: 'monthlyProfit', label: '월 순수익', icon: Banknote },
                                                { key: 'monthlyRevenue', label: '월 매출', icon: Banknote },
                                                { key: 'yield', label: '수익률', icon: Banknote },
                                            ]
                                                .filter(opt => !sortRules.some(rule => rule.key === opt.key))
                                                .map(opt => (
                                                    <div
                                                        key={opt.key}
                                                        className={styles.dropdownItem}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '14px' }}
                                                        onClick={() => {
                                                            // Add rule
                                                            const newRule: SortRule = { key: opt.key as SortKey, direction: 'desc' };
                                                            setSortRules([...sortRules, newRule]);
                                                            setIsAddingSort(false); // Switch back to list view
                                                        }}
                                                    >
                                                        <opt.icon size={15} color="#666" />
                                                        <span>{opt.label}</span>
                                                    </div>
                                                ))}
                                        </div>
                                        {sortRules.length > 0 && (
                                            <div style={{ borderTop: '1px solid #eee', padding: '8px' }}>
                                                <button
                                                    className={styles.sortActionBtn}
                                                    onClick={() => setIsAddingSort(false)}
                                                >
                                                    <ChevronLeft size={14} /> 돌아가기
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // RULES LIST VIEW
                                    <>
                                        <div className={styles.dropdownHeader} style={{ position: 'relative', paddingRight: '24px' }}>
                                            정렬 기준

                                        </div>

                                        {/* Active Sort Rules */}
                                        {sortRules.map((rule, idx) => (
                                            <div
                                                key={idx}
                                                className={styles.sortRow}
                                                draggable
                                                onDragStart={(e) => {
                                                    setDraggedSortIndex(idx);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (draggedSortIndex === null || draggedSortIndex === idx) return;
                                                    const newRules = [...sortRules];
                                                    const [removed] = newRules.splice(draggedSortIndex, 1);
                                                    newRules.splice(idx, 0, removed);
                                                    setSortRules(newRules);
                                                    setDraggedSortIndex(null);
                                                }}
                                                style={{ opacity: draggedSortIndex === idx ? 0.5 : 1 }}
                                            >
                                                <div className={styles.sortHandle} style={{ cursor: 'grab' }}><MoreHorizontal size={14} /></div>
                                                <select
                                                    className={styles.sortSelect}
                                                    value={rule.key}
                                                    style={{ flex: 1 }}
                                                    onChange={(e) => {
                                                        const newRules = [...sortRules];
                                                        newRules[idx].key = e.target.value as SortKey;
                                                        setSortRules(newRules);
                                                    }}
                                                >
                                                    {[
                                                        { key: 'createdAt', label: '등록일' },
                                                        { key: 'name', label: '물건명' },
                                                        { key: 'area', label: '면적' },
                                                        { key: 'deposit', label: '보증금' },
                                                        { key: 'monthlyRent', label: '월세' },
                                                        { key: 'premium', label: '권리금' },
                                                        { key: 'totalPrice', label: '합계' },
                                                        { key: 'monthlyProfit', label: '월 순수익' },
                                                        { key: 'monthlyRevenue', label: '월 매출' },
                                                        { key: 'yield', label: '수익률' },
                                                    ].map(opt => (
                                                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className={styles.sortSelect}
                                                    value={rule.direction}
                                                    onChange={(e) => {
                                                        const newRules = [...sortRules];
                                                        newRules[idx].direction = e.target.value as SortDirection;
                                                        setSortRules(newRules);
                                                    }}
                                                >
                                                    <option value="asc">오름차순</option>
                                                    <option value="desc">내림차순</option>
                                                </select>
                                                <button
                                                    className={styles.sortRemoveBtn}
                                                    onClick={() => {
                                                        const newRules = sortRules.filter((_, i) => i !== idx);
                                                        setSortRules(newRules);
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Actions */}
                                        <div className={styles.sortActions}>
                                            <button
                                                className={styles.sortActionBtn}
                                                onClick={() => {
                                                    // Switch to picker view instead of just adding default
                                                    setIsAddingSort(true);
                                                }}
                                            >
                                                <Plus size={14} /> 정렬 추가
                                            </button>
                                            {sortRules.length > 0 && (
                                                <button
                                                    className={styles.sortActionBtn}
                                                    style={{ color: '#fa5252' }}
                                                    onClick={() => setSortRules([])}
                                                >
                                                    <Trash2 size={14} /> 정렬 제거
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {/* FILTER BUTTON */}
                    <div className="relative flex-1 md:flex-none" ref={toolbarFilterRef}>
                        <button
                            className={`${styles.actionBtn} ${isFilterMenuOpen ? styles.active : ''} w-full justify-between md:w-auto md:justify-start whitespace-nowrap`}
                            onClick={() => {
                                setIsFilterMenuOpen(!isFilterMenuOpen);
                                // setIsColumnSelectorOpen(false); // Valid to keep both open
                                setLastActiveDropdown('filter');
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Filter size={16} />
                                <span>필터</span>
                            </div>
                            <ChevronDown size={14} />
                        </button>

                        {/* Filter Main Menu (Vertical List) */}
                        {isFilterMenuOpen && (
                            <div className={styles.filterMenuDropdown} style={{
                                zIndex: lastActiveDropdown === 'filter' ? 1002 : 1001,
                                right: 0, left: 'auto' // Fix right alignment
                            }}>
                                <div className={styles.menuHeader}>필터 기준</div>
                                <ul className={styles.menuList}>
                                    {[
                                        { key: 'isFavorite', label: '관심매물', icon: Star },
                                        { key: 'status', label: '물건등급', icon: Layout },
                                        { key: 'type', label: '업종(중분류)', icon: Layout },
                                        { key: 'industryDetail', label: '업종(소분류)', icon: Layout },
                                        { key: 'address', label: '주소', icon: MapPin },
                                        { key: 'manager', label: '담당자', icon: Users },
                                        { key: 'area', label: '면적', icon: Maximize },
                                        { key: 'floor', label: '층수', icon: Maximize },
                                        { key: 'deposit', label: '보증금', icon: Banknote },
                                        { key: 'monthlyRent', label: '월 임대료', icon: Banknote },
                                        { key: 'premium', label: '권리금', icon: Banknote },
                                        { key: 'totalPrice', label: '합계금액', icon: Banknote },
                                        { key: 'monthlyProfit', label: '월 순익', icon: Banknote },
                                        { key: 'monthlyRevenue', label: '월 총매출', icon: Banknote },
                                        { key: 'yield', label: '월 수익률', icon: Banknote },
                                    ].map(item => (
                                        <li
                                            key={item.key}
                                            className={styles.menuItem}
                                            onClick={() => {
                                                const newSet = new Set(activeFilters);
                                                newSet.add(item.key);
                                                setActiveFilters(newSet);
                                                setOpenFilterId(item.key); // Auto open the new filter card
                                                setIsFilterMenuOpen(false);
                                            }}
                                        >
                                            <item.icon size={16} />
                                            <span>{item.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>


                    <div style={{ position: 'relative' }} ref={columnSelectorRef} className="hidden md:block">
                        <button
                            className={`${styles.actionBtn} ${isColumnSelectorOpen ? styles.active : ''}`}
                            onClick={() => {
                                setIsColumnSelectorOpen(!isColumnSelectorOpen);
                                setIsSortDropdownOpen(false);
                                setColumnSearchTerm(''); // Reset search on open
                                // Do NOT close Filter menu
                                setLastActiveDropdown('columns');
                            }}
                        >
                            <Settings size={16} />
                            <span>속성 표시</span>
                            <ChevronDown size={14} />
                        </button>
                        {isColumnSelectorOpen && (
                            <div className={styles.dropdownMenu} style={{
                                width: 280,
                                maxHeight: '400px',
                                overflowY: 'auto',
                                zIndex: lastActiveDropdown === 'columns' ? 1002 : 1001
                            }}>
                                {/* Header with Search */}
                                <div className={styles.dropdownHeader} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' }}>
                                    <button onClick={() => setIsColumnSelectorOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span style={{ fontWeight: 'bold flex-1' }}>속성 표시 여부</span>
                                    <button onClick={() => setIsColumnSelectorOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                {/* Area Unit Toggle inside Menu */}
                                <div style={{ padding: '0 12px 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>면적 단위</span>
                                    <div style={{ display: 'flex', background: '#f1f3f5', borderRadius: '4px', padding: '2px' }}>
                                        <button
                                            onClick={() => setAreaUnit('pyeong')}
                                            style={{
                                                padding: '4px 12px',
                                                border: 'none',
                                                borderRadius: '3px',
                                                background: areaUnit === 'pyeong' ? 'white' : 'transparent',
                                                boxShadow: areaUnit === 'pyeong' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                fontSize: '12px',
                                                fontWeight: areaUnit === 'pyeong' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                color: areaUnit === 'pyeong' ? '#228be6' : '#888'
                                            }}
                                        >평</button>
                                        <button
                                            onClick={() => setAreaUnit('m2')}
                                            style={{
                                                padding: '4px 12px',
                                                border: 'none',
                                                borderRadius: '3px',
                                                background: areaUnit === 'm2' ? 'white' : 'transparent',
                                                boxShadow: areaUnit === 'm2' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                fontSize: '12px',
                                                fontWeight: areaUnit === 'm2' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                color: areaUnit === 'm2' ? '#228be6' : '#888'
                                            }}
                                        >m²</button>
                                    </div>
                                </div>
                                <div style={{ padding: '0 12px 12px 12px' }}>
                                    <div className={styles.searchBox} style={{ width: '100%', height: '36px', border: '1px solid #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                                        <Search size={14} color="#888" style={{ marginRight: '6px' }} />
                                        <input
                                            type="text"
                                            placeholder="속성을 검색하세요"
                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                                            value={columnSearchTerm}
                                            onChange={(e) => setColumnSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {(() => {
                                    const fixedColumns = ['no', 'name', 'grade', 'isFavorite'];
                                    const allColumns = Object.keys(columnWidths).filter(col => !fixedColumns.includes(col));

                                    const getLabel = (col: string) => {
                                        return {
                                            address: '주소', status: '물건등급', type: '업종(중분류)', industryDetail: '업종(소분류)', operationType: '운영형태', processStatus: '진행상황', features: '특징', floor: '층수', area: '실면적',
                                            deposit: '보증금', monthlyRent: '임대료', premium: '권리금', totalPrice: '합계',
                                            monthlyProfit: '월순익', monthlyRevenue: '월매출', manager: '담당자',
                                            createdAt: '등록일', updatedAt: '최종작성일', yield: '수익률', isFavorite: '관심매물'
                                        }[col] || col;
                                    };

                                    const filteredColumns = allColumns.filter(col =>
                                        getLabel(col).toLowerCase().includes(columnSearchTerm.toLowerCase())
                                    );

                                    const shownColumns = filteredColumns.filter(col => visibleColumns.has(col));
                                    const hiddenColumns = filteredColumns.filter(col => !visibleColumns.has(col));

                                    return (
                                        <>
                                            {/* Shown Section */}
                                            <div style={{ padding: '8px 12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>점포목록에 표시하기</span>
                                                    <button
                                                        style={{ background: 'none', border: 'none', color: '#228be6', fontSize: '12px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const newSet = new Set(visibleColumns);
                                                            shownColumns.forEach(col => newSet.delete(col));
                                                            setVisibleColumns(newSet);
                                                        }}
                                                    >
                                                        모두 숨기기
                                                    </button>
                                                </div>
                                                {shownColumns.map(col => (
                                                    <div
                                                        key={col}
                                                        className={styles.dropdownItem}
                                                        style={{ justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const newSet = new Set(visibleColumns);
                                                            newSet.delete(col);
                                                            setVisibleColumns(newSet);
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {/* Icon placeholder if needed */}
                                                            <span>{getLabel(col)}</span>
                                                        </div>
                                                        <div style={{ color: '#666', display: 'flex' }}>
                                                            <Eye size={16} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Hidden Section */}
                                            <div style={{ padding: '8px 12px', borderTop: '1px solid #eee' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '4px' }}>
                                                    <span style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>점포목록에서 숨기기</span>
                                                    <button
                                                        style={{ background: 'none', border: 'none', color: '#228be6', fontSize: '12px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const newSet = new Set(visibleColumns);
                                                            hiddenColumns.forEach(col => newSet.add(col));
                                                            setVisibleColumns(newSet);
                                                        }}
                                                    >
                                                        모두 표시하기
                                                    </button>
                                                </div>
                                                {hiddenColumns.map(col => (
                                                    <div
                                                        key={col}
                                                        className={styles.dropdownItem}
                                                        style={{ justifyContent: 'space-between', padding: '6px 8px', color: '#aaa', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const newSet = new Set(visibleColumns);
                                                            newSet.add(col);
                                                            setVisibleColumns(newSet);
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span>{getLabel(col)}</span>
                                                        </div>
                                                        <div style={{ color: '#ccc', display: 'flex' }}>
                                                            <EyeOff size={16} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block">
                        {/* Excel Upload (New Modal) */}
                        <button className={styles.actionBtn} onClick={() => setIsUploadModalOpen(true)}>
                            <FileSpreadsheet size={16} />
                            <span>엑셀 업로드</span>
                        </button>
                    </div>
                    <div className="hidden md:block">
                        <Link href="/properties/register" className={`${styles.actionBtn} ${styles.primaryBtn}`}>
                            <Plus size={16} />
                            <span>새로 만들기</span>
                        </Link>
                    </div>
                </div>
            </div>
            {/* Active Filters & Filter Menu */}
            <div className={styles.filterBar} ref={filterContainerRef}>





                {
                    Array.from(activeFilters).map(filterKey => (
                        <div key={filterKey} style={{ position: 'relative' }}>
                            <button
                                className={`${styles.activeFilterBtn} ${hasFilterValue(filterKey) ? styles.active : ''} ${openFilterId === filterKey ? styles.open : ''}`}
                                onClick={() => setOpenFilterId(openFilterId === filterKey ? null : filterKey)}
                            >
                                <div className={styles.filterIconLabel}>
                                    {{
                                        status: <Layout size={16} />,
                                        type: <Layout size={16} />,
                                        industryDetail: <Layout size={16} />,
                                        address: <MapPin size={16} />,
                                        manager: <Users size={16} />,
                                        premium: <Banknote size={16} />,
                                        deposit: <Banknote size={16} />,
                                        totalPrice: <Banknote size={16} />,
                                        monthlyProfit: <Banknote size={16} />,
                                        area: <Maximize size={16} />,
                                        floor: <Maximize size={16} />,
                                        monthlyRent: <Banknote size={16} />,
                                        yield: <Banknote size={16} />,
                                        monthlyRevenue: <Banknote size={16} />,
                                        isFavorite: <Star size={16} />,
                                    }[filterKey] || <Filter size={16} />}
                                    <span>
                                        {{
                                            status: '물건등급', type: '업종(중분류)', industryDetail: '업종(소분류)', address: '주소', manager: '담당자',
                                            premium: '권리금', deposit: '보증금', totalPrice: '합계금액', monthlyProfit: '월 순익',
                                            area: '면적', floor: '층수', monthlyRent: '월 임대료', yield: '수익률', monthlyRevenue: '월 매출', isFavorite: '관심매물'
                                        }[filterKey] || filterKey}
                                    </span>
                                </div>
                                <ChevronDown size={14} />
                            </button>

                            {/* Detail Popover Card */}
                            {openFilterId === filterKey && (
                                <div className={styles.detailCard}>
                                    <div className={styles.cardHeader}>
                                        <span>
                                            {{
                                                status: '물건등급 선택', type: '업종(중분류) 선택', industryDetail: '업종(소분류) 선택', address: '주소 입력', manager: '담당자 선택',
                                                premium: '권리금 범위 (만원)', deposit: '보증금 범위 (만원)', totalPrice: '합계금액 범위 (만원)',
                                                monthlyProfit: '월 순익 (만원)', area: `면적 범위 (${areaUnit === 'pyeong' ? '평' : 'm²'})`, floor: '층수 범위',
                                                monthlyRent: '월 임대료 (만원)', yield: '수익률 (%)', monthlyRevenue: '월 매출 (만원)', isFavorite: '관심매물'
                                            }[filterKey] || '필터 설정'}
                                        </span>
                                        <button onClick={() => {
                                            const newSet = new Set(activeFilters);
                                            newSet.delete(filterKey);
                                            setActiveFilters(newSet);
                                            setOpenFilterId(null);
                                            // Reset specific filter state
                                            setOpenFilterId(null);
                                            // Reset specific filter state based on key
                                            if (filterKey === 'status') setStatusFilter([]);
                                            if (filterKey === 'type') setTypeFilter([]);
                                            if (filterKey === 'industryDetail') setIndustryDetailFilter([]);
                                            if (filterKey === 'address') setAddressFilter('');
                                            if (filterKey === 'manager') setManagerFilters([]);

                                            // Reset Financials
                                            if (filterKey === 'premium') setPriceFilter(p => ({ ...p, premiumMin: '', premiumMax: '' }));
                                            if (filterKey === 'deposit') setPriceFilter(p => ({ ...p, depositMin: '', depositMax: '' }));
                                            if (filterKey === 'monthlyRent') setPriceFilter(p => ({ ...p, rentMin: '', rentMax: '' }));
                                            if (filterKey === 'totalPrice') setPriceFilter(p => ({ ...p, totalMin: '', totalMax: '' }));
                                            if (filterKey === 'monthlyProfit') setPriceFilter(p => ({ ...p, profitMin: '', profitMax: '' }));
                                            if (filterKey === 'monthlyRevenue') setPriceFilter(p => ({ ...p, revenueMin: '', revenueMax: '' }));
                                            if (filterKey === 'yield') setPriceFilter(p => ({ ...p, yieldMin: '', yieldMax: '' }));

                                            if (filterKey === 'area') setAreaFilter({ min: '', max: '' });
                                            if (filterKey === 'floor') setFloorFilter({ min: '', max: '' });
                                            if (filterKey === 'isFavorite') setShowFavoritesOnly(false);
                                        }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className={styles.cardContent}>
                                        {filterKey === 'isFavorite' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                                                <label className={styles.filterCheckboxLabel} style={{ width: '100%', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={showFavoritesOnly}
                                                        onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                                                    />
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Star size={16} fill={showFavoritesOnly ? "#fab005" : "none"} color={showFavoritesOnly ? "#fab005" : "#555"} />
                                                        관심매물만 보기
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                        {filterKey === 'status' && (
                                            <div>
                                                {statusFilter.length > 0 && (
                                                    <div className={styles.selectedChips}>
                                                        {statusFilter.map(status => (
                                                            <div key={status} className={styles.chip}>
                                                                <span>{
                                                                    {
                                                                        progress: '추진', manage: '관리', hold: '보류',
                                                                        common: '공동', complete: '완료'
                                                                    }[status]
                                                                }</span>
                                                                <button onClick={() => toggleStatusFilter(status)}>
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className={styles.chipList}>
                                                    {['progress', 'manage', 'hold', 'common', 'complete'].map(status => (
                                                        <label key={status} className={styles.filterCheckboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={statusFilter.includes(status)}
                                                                onChange={() => toggleStatusFilter(status)}
                                                            />
                                                            {getStatusBadge(status)}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {filterKey === 'address' && (
                                            <input
                                                className={styles.filterInput}
                                                placeholder="예: 강남구, 역삼동"
                                                value={addressFilter}
                                                onChange={(e) => setAddressFilter(e.target.value)}
                                                autoFocus
                                            />
                                        )}
                                        {filterKey === 'manager' && (
                                            <div>
                                                {managerFilters.length > 0 && (
                                                    <div className={styles.selectedChips}>
                                                        {managerFilters.map(id => {
                                                            const m = managers.find(mgr => mgr.id === id);
                                                            return (
                                                                <div key={id} className={styles.chip}>
                                                                    <span>
                                                                        {m?.name}
                                                                        {m?.id === currentUser?.id ? ' (나)' : ''}
                                                                    </span>
                                                                    <button onClick={() => setManagerFilters(prev => prev.filter(mid => mid !== id))}>
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className={styles.chipList}>
                                                    {managers.map(m => (
                                                        <label key={m.id} className={styles.filterCheckboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={managerFilters.includes(m.id)}
                                                                onChange={() => setManagerFilters(prev =>
                                                                    prev.includes(m.id)
                                                                        ? prev.filter(id => id !== m.id)
                                                                        : [...prev, m.id]
                                                                )}
                                                            />
                                                            <span>
                                                                {m.name} {currentUser?.id === m.id ? '(나)' : ''}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Range Inputs for Financials & Sizes */}
                                        {['premium', 'deposit', 'monthlyRent', 'totalPrice', 'monthlyProfit', 'monthlyRevenue', 'yield'].includes(filterKey) && (
                                            <div className={styles.rangeInputs}>
                                                <input
                                                    type="number"
                                                    placeholder="최소"
                                                    value={
                                                        filterKey === 'premium' ? priceFilter.premiumMin :
                                                            filterKey === 'deposit' ? priceFilter.depositMin :
                                                                filterKey === 'monthlyRent' ? priceFilter.rentMin :
                                                                    filterKey === 'totalPrice' ? priceFilter.totalMin :
                                                                        filterKey === 'monthlyProfit' ? priceFilter.profitMin :
                                                                            filterKey === 'monthlyRevenue' ? priceFilter.revenueMin :
                                                                                filterKey === 'yield' ? priceFilter.yieldMin : ''
                                                    }
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const mapping: any = {
                                                            premium: 'premiumMin', deposit: 'depositMin', monthlyRent: 'rentMin',
                                                            totalPrice: 'totalMin', monthlyProfit: 'profitMin', monthlyRevenue: 'revenueMin',
                                                            yield: 'yieldMin'
                                                        };
                                                        setPriceFilter({ ...priceFilter, [mapping[filterKey]]: val });
                                                    }}
                                                />
                                                <span>~</span>
                                                <input
                                                    type="number"
                                                    placeholder="최대"
                                                    value={
                                                        filterKey === 'premium' ? priceFilter.premiumMax :
                                                            filterKey === 'deposit' ? priceFilter.depositMax :
                                                                filterKey === 'monthlyRent' ? priceFilter.rentMax :
                                                                    filterKey === 'totalPrice' ? priceFilter.totalMax :
                                                                        filterKey === 'monthlyProfit' ? priceFilter.profitMax :
                                                                            filterKey === 'monthlyRevenue' ? priceFilter.revenueMax :
                                                                                filterKey === 'yield' ? priceFilter.yieldMax : ''
                                                    }
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const mapping: any = {
                                                            premium: 'premiumMax', deposit: 'depositMax', monthlyRent: 'rentMax',
                                                            totalPrice: 'totalMax', monthlyProfit: 'profitMax', monthlyRevenue: 'revenueMax',
                                                            yield: 'yieldMax'
                                                        };
                                                        setPriceFilter({ ...priceFilter, [mapping[filterKey]]: val });
                                                    }}
                                                />
                                            </div>
                                        )}
                                        {filterKey === 'type' && (
                                            <div>
                                                {typeFilter.length > 0 && (
                                                    <div className={styles.selectedChips}>
                                                        {typeFilter.map(type => (
                                                            <div key={type} className={styles.chip}>
                                                                <span>{type}</span>
                                                                <button onClick={() => setTypeFilter(prev => prev.filter(t => t !== type))}>
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className={styles.chipList}>
                                                    {/* Unique Types from Data or Fallback */}
                                                    {(Array.from(new Set(properties.map(p => p.industrySector).filter(Boolean))).length > 0
                                                        ? Array.from(new Set(properties.map(p => p.industrySector).filter(Boolean))).sort()
                                                        : ['일반음식점', '휴게음식점', '카페', '베이커리', '주점', '노래방', 'PC방', '미용실', '네일아트', '피부관리', '헬스장', '필라테스', '요가', '학원', '교습소', '의원', '약국', '편의점', '마트', '부동산', '세탁소', '기타']
                                                    ).map((type: string) => (
                                                        <label key={type} className={styles.filterCheckboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={typeFilter.includes(type)}
                                                                onChange={() => setTypeFilter(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                                                            />
                                                            <span>{type}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {filterKey === 'industryDetail' && (
                                            <div>
                                                {industryDetailFilter.length > 0 && (
                                                    <div className={styles.selectedChips}>
                                                        {industryDetailFilter.map(det => (
                                                            <div key={det} className={styles.chip}>
                                                                <span>{det}</span>
                                                                <button onClick={() => setIndustryDetailFilter(prev => prev.filter(t => t !== det))}>
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className={styles.chipList}>
                                                    {/* Unique Details from Data */}
                                                    {(Array.from(new Set(properties.map(p => p.industryDetail).filter(Boolean))).length > 0
                                                        ? Array.from(new Set(properties.map(p => p.industryDetail).filter(Boolean))).sort()
                                                        : []
                                                    ).map((det: string) => (
                                                        <label key={det} className={styles.filterCheckboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={industryDetailFilter.includes(det)}
                                                                onChange={() => setIndustryDetailFilter(prev => prev.includes(det) ? prev.filter(t => t !== det) : [...prev, det])}
                                                            />
                                                            <span>{det}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {filterKey === 'floor' && (
                                            <div className={styles.rangeInputs}>
                                                <input type="number" placeholder="최소" value={floorFilter.min} onChange={e => setFloorFilter({ ...floorFilter, min: e.target.value })} />
                                                <span>~</span>
                                                <input type="number" placeholder="최대" value={floorFilter.max} onChange={e => setFloorFilter({ ...floorFilter, max: e.target.value })} />
                                            </div>
                                        )}
                                        {filterKey === 'area' && (
                                            <div className={styles.rangeInputs}>
                                                <input
                                                    type="number"
                                                    placeholder={areaUnit === 'pyeong' ? '최소 (평)' : '최소 (m²)'}
                                                    value={areaFilter.min}
                                                    onChange={e => setAreaFilter({ ...areaFilter, min: e.target.value })}
                                                />
                                                <span>~</span>
                                                <input
                                                    type="number"
                                                    placeholder={areaUnit === 'pyeong' ? '최대 (평)' : '최대 (m²)'}
                                                    value={areaFilter.max}
                                                    onChange={e => setAreaFilter({ ...areaFilter, max: e.target.value })}
                                                />
                                            </div>
                                        )}
                                        {filterKey === 'monthlyProfit' && (
                                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#888', padding: '0 4px' }}>
                                                * 월 순수익 (임대료 제외 수익)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                }

                {/* Inline Add Filter Button */}
                {
                    activeFilters.size > 0 && (
                        <div style={{ position: 'relative' }}>
                            <button
                                className={styles.addFilterBtn}
                                onClick={() => setIsInlineMenuOpen(!isInlineMenuOpen)}
                            >
                                <Plus size={16} />
                                <span>필터</span>
                            </button>
                            {isInlineMenuOpen && (
                                <div className={styles.filterMenuDropdown}>
                                    <div className={styles.menuHeader}>필터 추가</div>
                                    <ul className={styles.menuList}>
                                        {[
                                            { key: 'isFavorite', label: '관심매물', icon: Star },
                                            { key: 'status', label: '물건등급', icon: Layout },
                                            { key: 'type', label: '업종(중분류)', icon: Layout },
                                            { key: 'industryDetail', label: '업종(소분류)', icon: Layout },
                                            { key: 'address', label: '주소', icon: MapPin },
                                            { key: 'manager', label: '담당자', icon: Users },
                                            { key: 'area', label: '면적', icon: Maximize },
                                            { key: 'floor', label: '층수', icon: Maximize },
                                            { key: 'deposit', label: '보증금', icon: Banknote },
                                            { key: 'monthlyRent', label: '월 임대료', icon: Banknote },
                                            { key: 'premium', label: '권리금', icon: Banknote },
                                            { key: 'totalPrice', label: '합계금액', icon: Banknote },
                                            { key: 'monthlyProfit', label: '월 순익', icon: Banknote },
                                            { key: 'monthlyRevenue', label: '월 총매출', icon: Banknote },
                                            { key: 'yield', label: '월 수익률', icon: Banknote },
                                        ].map(item => (
                                            <li
                                                key={item.key}
                                                className={styles.menuItem}
                                                onClick={() => {
                                                    const newSet = new Set(activeFilters);
                                                    newSet.add(item.key);
                                                    setActiveFilters(newSet);
                                                    setOpenFilterId(item.key);
                                                    setIsInlineMenuOpen(false);
                                                }}
                                            >
                                                <item.icon size={16} />
                                                <span>{item.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >


            {/* Mobile List View (Visible only on mobile) */}
            <div className="md:hidden space-y-3 p-4 pb-24">
                {isLoading ? (
                    <div className="text-center py-10 text-gray-400">데이터를 불러오는 중...</div>
                ) : filteredProperties.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        {searchTerm || statusFilter.length > 0 ? "검색 결과가 없습니다." : "등록된 매물이 없습니다."}
                    </div>
                ) : (
                    paginatedProperties.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => handleRowClick(item.id)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {/* Status Badge */}
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.status === 'progress' ? 'bg-purple-100 text-purple-600' :
                                        item.status === 'manage' ? 'bg-blue-50 text-blue-600' :
                                            item.status === 'hold' ? 'bg-red-50 text-red-600' :
                                                item.status === 'complete' ? 'bg-green-50 text-green-600' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {item.status === 'progress' ? '추진' :
                                            item.status === 'manage' ? '관리' :
                                                item.status === 'hold' ? '보류' :
                                                    item.status === 'complete' ? '완료' : '공동'}
                                    </span>
                                    <span className="text-xs text-gray-500 font-medium">{item.industrySector || item.type}</span>
                                </div>
                                {item.isFavorite && <Star size={14} fill="#fab005" color="#fab005" />}
                            </div>

                            <div className="font-bold text-gray-900 text-lg mb-1 line-clamp-1">{item.name}</div>
                            <div className="text-gray-500 text-sm mb-3 flex items-center gap-1">
                                <MapPin size={12} />
                                <span className="line-clamp-1">{item.address} {item.floor ? `${item.floor}층` : ''}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-lg mb-3">
                                <div>
                                    <span className="text-gray-400 text-xs block">보증금/월세</span>
                                    <span className="font-bold text-gray-700">
                                        {item.deposit ? Number(String(item.deposit).replace(/,/g, '')).toLocaleString() : '0'} / {item.monthlyRent ? Number(String(item.monthlyRent).replace(/,/g, '')).toLocaleString() : '0'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-xs block">권리금</span>
                                    <span className="font-bold text-gray-700">
                                        {item.premium ? Number(String(item.premium).replace(/,/g, '')).toLocaleString() : '0'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-xs block">면적</span>
                                    <span className="font-bold text-gray-700">{item.area}평</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-xs block">담당자</span>
                                    <span className="font-bold text-gray-700">{item.manager || item.managerName}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-end text-xs text-gray-400">
                                <span>{new Date(item.updatedAt || item.createdAt).toLocaleDateString()} 업데이트</span>
                            </div>
                        </div>
                    ))
                )}

                {/* Mobile FAB (Floating Action Button) */}
                <Link
                    href="/properties/register"
                    className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white z-50 active:scale-90 transition-transform"
                >
                    <Plus size={28} strokeWidth={2.5} />
                </Link>
            </div>

            {/* Desktop Data Grid (Hidden on mobile) */}
            <div className={`${styles.gridContainer} hidden md:block`}>
                <div className={styles.gridWrapper} style={{ width: tableWidth }}>
                    <table className={styles.table} style={{ width: tableWidth, tableLayout: 'fixed' }}>
                        <thead>
                            <tr>
                                <th className={styles.checkboxCell} style={{ textAlign: 'center', position: 'sticky', left: 0, zIndex: 10 }}>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={paginatedProperties.length > 0 && paginatedProperties.every(p => selectedIds.has(p.id))}
                                            onChange={handleSelectAll}
                                        />
                                    </label>
                                </th>
                                {columnOrder.map(column => {
                                    if (!visibleColumns.has(column)) return null;
                                    const isSortable = ['name', 'area', 'deposit', 'monthlyRent', 'premium', 'totalPrice', 'createdAt'].includes(column);
                                    return (
                                        <th
                                            key={column}
                                            style={{ width: columnWidths[column] || 100, cursor: 'move' }}
                                            className={column === 'grade' ? styles.cellCompact : (isSortable ? styles.sortableHeader : '')}
                                            onClick={() => isSortable && handleSort(column as SortKey)}
                                            draggable
                                            onDragStart={(e) => handleColumnDragStart(e, column)}
                                            onDragOver={(e) => handleColumnDragOver(e, column)}
                                            onDrop={(e) => handleColumnDrop(e, column)}
                                        >
                                            <div className={styles.headerContent} style={column === 'grade' || column === 'no' || column === 'isFavorite' ? { justifyContent: 'center' } : {}}>
                                                {getHeaderLabel(column)}
                                                {isSortable && sortRules.length > 0 && sortRules[0].key === column && (sortRules[0].direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <Resizer onResize={(e) => handleMouseDown(e, column)} onAutoFit={() => handleAutoFit(column)} />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={visibleColumns.size + 1} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>데이터를 불러오는 중...</td>
                                </tr>
                            ) : paginatedProperties.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.size + 1} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                        {searchTerm || statusFilter.length > 0 ? "검색 결과가 없습니다." : "등록된 매물이 없습니다."}
                                    </td>
                                </tr>
                            ) : (
                                paginatedProperties.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleRowClick(item.id)}
                                        style={{ cursor: 'pointer' }}
                                        className={`${styles.tableRow} ${selectedIds.has(item.id) ? styles.selectedRow : ''}`}
                                    >
                                        <td
                                            className={styles.checkboxCell}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ textAlign: 'center', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}
                                        >
                                            <label className={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                                                />
                                            </label>
                                        </td>
                                        {columnOrder.map(column => visibleColumns.has(column) ? (
                                            <React.Fragment key={column}>
                                                {renderCell(item, column, index)}
                                            </React.Fragment>
                                        ) : null)}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer & Pagination */}
            <div className={`${styles.footer} flex-col md:flex-row gap-4 md:gap-0`}>
                <div className={`${styles.totalCount} text-center w-full md:w-auto flex items-center justify-center md:justify-start gap-3`}>
                    <div>전체 <strong>{filteredProperties.length}</strong>건 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProperties.length)}</div>

                    {/* Limit Selector - 직접입력 토글 지원 */}
                    <div style={{ position: 'relative' }}>
                        {!isCustomLimit ? (
                            <select
                                className={styles.footerBtn}
                                value={limit}
                                onChange={handleLimitChange}
                                style={{ padding: '0 8px', height: 32, borderColor: '#dee2e6', color: '#495057' }}
                            >
                                <option value={100}>100개</option>
                                <option value={300}>300개</option>
                                <option value={500}>500개</option>
                                <option value={1000}>1000개</option>
                                <option value="all">전체</option>
                                <option value="custom">직접입력</option>
                            </select>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                    type="number"
                                    className={styles.footerBtn}
                                    value={limit === 'all' ? '' : limit}
                                    onChange={handleCustomLimitChange}
                                    placeholder="입력"
                                    autoFocus
                                    style={{ padding: '0 8px', height: 32, borderColor: '#dee2e6', color: '#495057', width: 80, textAlign: 'center' }}
                                />
                                <button
                                    onClick={() => setIsCustomLimit(false)}
                                    className={styles.footerBtn}
                                    style={{ padding: '0 6px', height: 32, borderColor: '#dee2e6', color: '#868e96' }}
                                    title="목록으로 돌아가기"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.pagination}>
                    {/* Items Per Page */}
                    <select
                        className={styles.footerBtn}
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        style={{ padding: '0 8px', height: 32, borderColor: '#dee2e6', color: '#495057', marginRight: 10 }}
                    >
                        <option value="20">20개씩 보기</option>
                        <option value="50">50개씩 보기</option>
                        <option value="100">100개씩 보기</option>
                    </select>

                    <button
                        className={styles.pageBtn}
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className={styles.pageInfo}>{currentPage} / {totalPages || 1}</span>
                    <button
                        className={styles.pageBtn}
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className={styles.footerActions}>
                    {/* Excel Actions - HIDDEN on Mobile */}
                    <div className="hidden md:flex gap-2">
                        <button
                            className={styles.footerBtn}
                            onClick={() => setIsUploadModalOpen(true)}
                            style={{ color: '#217346', borderColor: '#217346' }}
                        >
                            <Layout size={16} />
                            <span>일괄 업로드</span>
                        </button>
                        <button className={styles.footerBtn} onClick={handleExcelExport}>
                            <Download size={16} />
                            <span>엑셀 저장</span>
                        </button>
                    </div>

                    {selectedIds.size > 0 && (
                        <button
                            className={`${styles.footerBtn} ${styles.deleteBtn}`}
                            onClick={handleBulkDelete}
                        >
                            <Trash2 size={16} />
                            <span>삭제 ({selectedIds.size})</span>
                        </button>
                    )}
                </div>
            </div>


            {/* Detail View Overlay */}
            {
                selectedPropertyId && selectedProperty && (
                    <div className={viewMode === 'center' ? styles.modalOverlay : styles.drawerOverlay} onClick={() => setSelectedPropertyId(null)}>
                        <div
                            className={viewMode === 'center' ? styles.modalContent : styles.drawerContent}
                            style={viewMode === 'center' ? {} : { width: drawerWidth }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {viewMode === 'side' && (
                                <div
                                    className={styles.drawerResizer}
                                    onMouseDown={handleDrawerMouseDown}
                                />
                            )}
                            <button className={styles.closeBtn} onClick={() => setSelectedPropertyId(null)}>
                                <X size={24} />
                            </button>
                            <PropertyCard
                                property={selectedProperty}
                                onClose={() => setSelectedPropertyId(null)}
                                onRefresh={fetchProperties}
                                onNavigate={(action) => {
                                    const currentIndex = filteredProperties.findIndex(p => p.id === selectedPropertyId);
                                    if (currentIndex === -1) return;

                                    let nextIndex = currentIndex;
                                    if (action === 'prev') nextIndex = Math.max(0, currentIndex - 1);
                                    else if (action === 'next') nextIndex = Math.min(filteredProperties.length - 1, currentIndex + 1);
                                    else if (action === 'first') nextIndex = 0;
                                    else if (action === 'last') nextIndex = filteredProperties.length - 1;

                                    if (nextIndex !== currentIndex) {
                                        setSelectedPropertyId(filteredProperties[nextIndex].id);
                                    }
                                }}
                                canNavigate={{
                                    first: filteredProperties.findIndex(p => p.id === selectedPropertyId) > 0,
                                    prev: filteredProperties.findIndex(p => p.id === selectedPropertyId) > 0,
                                    next: filteredProperties.findIndex(p => p.id === selectedPropertyId) < filteredProperties.length - 1,
                                    last: filteredProperties.findIndex(p => p.id === selectedPropertyId) < filteredProperties.length - 1
                                }}
                            />
                        </div>
                    </div>
                )
            }
            {/* Property Upload Modal */}
            <PropertyUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
            />
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                type={alertConfig.type}
            />
        </div >
    );
}

export default function PropertiesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PropertiesPageContent />
        </Suspense>
    );
}
