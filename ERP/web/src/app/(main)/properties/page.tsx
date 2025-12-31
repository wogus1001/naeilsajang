"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Search, Filter, Plus, MoreHorizontal, Printer, Save, Trash2, X, ChevronDown, ChevronUp, Download, ChevronLeft, ChevronRight, Settings, Layout, Check, MapPin, Users, Banknote, Maximize, TrendingUp, Star, Eye, EyeOff, Type, Calendar } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import styles from './page.module.css';
import PropertyCard from '@/components/properties/PropertyCard';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';

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

    // Initial Filter Data
    const [managers, setManagers] = useState<{ id: string, name: string }[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null); // Track logged-in user

    // Area Unit State (Global for this page)
    const [areaUnit, setAreaUnit] = useState<'pyeong' | 'm2'>('pyeong');
    const PYEONG_TO_M2 = 3.305785;

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        let query = '';
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user); // Set current user state
                if (user.companyName) {
                    query = `?company=${encodeURIComponent(user.companyName)}`;
                }
            } catch (e) {
                console.error("Error parsing user from localStorage", e);
            }
        }
        fetch(`/api/users${query}`).then(res => res.json()).then(data => setManagers(data)).catch(err => console.error(err));
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
        setIsLoading(true);
        try {
            const userStr = localStorage.getItem('user');
            let query = '';
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.companyName && user.role !== 'admin' && user.id !== 'admin') {
                    query = `?company=${encodeURIComponent(user.companyName)}`;
                }
            }

            const res = await fetch(`/api/properties${query}`);
            if (res.ok) {
                const data = await res.json();
                setProperties(data);
            }
        } catch (error) {
            console.error('Failed to fetch properties:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

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
            alert('삭제할 항목을 선택해주세요.');
            return;
        }

        if (!confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;

        setIsLoading(true);
        try {
            // Sequential delete as API likely doesn't support bulk yet
            // Ideally: await fetch('/api/properties/bulk-delete', { ... })
            const deletePromises = Array.from(selectedIds).map(id =>
                fetch(`/api/properties?id=${id}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);

            alert('삭제되었습니다.');
            setSelectedIds(new Set());
            fetchProperties(); // Refresh list
        } catch (error) {
            console.error('Failed to delete properties:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
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

    // Excel Upload Ref
    const fileInputRefExport = React.useRef<HTMLInputElement>(null);

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // Use header:1 to get array of arrays first to find header row (some excel files have headers on row 2)
                // Assuming standard header on row 1 for now based on request.
                // However, user said "Column text below" which usually implies merging or 2nd row?
                // But typically xlsx.utils.sheet_to_json handles keys well.
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('데이터가 없습니다.');
                    setIsLoading(false);
                    return;
                }

                if (!confirm(`${data.length}개의 데이터를 업로드하시겠습니까?`)) {
                    setIsLoading(false);
                    return;
                }

                let successCount = 0;
                let failCount = 0;
                let hasSpecialWarning = false;

                // Helper to find value by aliases
                const getVal = (row: any, keys: string[]) => {
                    for (const k of keys) {
                        if (row[k] !== undefined) return String(row[k]).trim();
                    }
                    return undefined;
                };

                // Helper to parse amount (remove commas)
                const parseAmt = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === 'number') return val;
                    // Handle "3,000" -> 3000, remove all non-numeric except dot/dash
                    const cleanStr = String(val).replace(/,/g, '').trim();
                    return parseFloat(cleanStr) || 0;
                };

                for (const row of data as any[]) {
                    try {
                        // 1. Status Mapping
                        let status = 'manage'; // Default
                        const rawStatus = getVal(row, ['등급', '물건등급']);
                        if (rawStatus === '보류') status = 'hold';
                        else if (rawStatus === '완료' || rawStatus === '계약완료') status = 'complete';
                        // else if (rawStatus === '추진' || rawStatus === '진행' || rawStatus === '계약진행') status = 'progress'; // Removed per request? No, keep standard. User didn't ask to remove.
                        else if (rawStatus === '공동') status = 'common';
                        // Default is manage (Active/General)

                        // 2. Operation Type Logic
                        const ops = [];
                        if (row['직영']) ops.push('직영');
                        if (row['오토']) ops.push('오토');
                        if (row['반오토']) ops.push('반오토');

                        // Special logic: "특수" checked -> means "위탁" AND "본사"
                        if (row['특수']) {
                            ops.push('특수'); // Keep "특수" label or...
                            ops.push('위탁');
                            ops.push('본사');
                            hasSpecialWarning = true;
                        }

                        // 3. Address & Detail Address
                        // "위치컬럼은 상세주소에 입력" -> Append '위치' to '주소' or separate?
                        // "소재지의 경우 db에 작성... 지도 매핑 안됨" -> Just save string.
                        const rawAddr = getVal(row, ['주소', '소재지']) || '';
                        const rawLocation = getVal(row, ['위치', '상세주소']) || '';
                        const fullAddress = `${rawAddr} ${rawLocation}`.trim();

                        const rawIndustryDetail = (getVal(row, ['업종', '소분류']) || '').trim();
                        let industryInfo = findIndustryByDetail([rawIndustryDetail]); // Auto-find Sector/Category

                        // Special Handling for "기타" using "종류" column
                        if (rawIndustryDetail === '기타' || !industryInfo.category) {
                            const rawKind = (getVal(row, ['종류']) || '').trim();

                            const KIND_MAPPING: Record<string, { category: string, sector: string }> = {
                                '휴게음료점': { category: '요식업', sector: '기타외식' },
                                '일반음식점': { category: '요식업', sector: '기타외식' },
                                '외식음식점': { category: '요식업', sector: '기타외식' },
                                '주류점': { category: '요식업', sector: '주점' },
                                '유흥주점': { category: '요식업', sector: '주점' },
                                '서비스점': { category: '서비스업', sector: '기타서비스' },
                                '판매점': { category: '유통업', sector: '기타도소매' },
                                '오락스포츠': { category: '서비스업', sector: '기타서비스' },
                                '특수상권': { category: '유통업', sector: '기타도소매' },
                                '기타': { category: '서비스업', sector: '기타서비스' }
                            };

                            if (rawKind && KIND_MAPPING[rawKind]) {
                                industryInfo = KIND_MAPPING[rawKind];
                            }
                        }

                        // Geocoding (Add delay to prevent rate limit)
                        let coords = null;
                        if (fullAddress && window.kakao && window.kakao.maps && window.kakao.maps.services) {
                            try {
                                coords = await new Promise<{ lat: number, lng: number } | null>((resolve) => {
                                    const geocoder = new window.kakao.maps.services.Geocoder();
                                    geocoder.addressSearch(fullAddress, (result: any, status: any) => {
                                        if (status === window.kakao.maps.services.Status.OK) {
                                            resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
                                        } else {
                                            resolve(null);
                                        }
                                    });
                                });
                                // Rate limit delay (100ms)
                                await new Promise(r => setTimeout(r, 100));
                            } catch (e) {
                                console.log('Geocoding failed for:', fullAddress);
                            }
                        }

                        // 5. Floor
                        // "층수컬럼이 매칭이안돼 전체층수만 들어가있음" -> '층수' might be missing in Excel row object if header has spaces?
                        // User wrote: No. 등급 ... 총층수 층수 ...
                        // Check for '층수 ' or ' 층수'?
                        const floorVal = getVal(row, ['층수', '층수(해당건물)', '해당층']);
                        const totalFloorVal = getVal(row, ['총층수', '층수(전체층수)', '전체층수']);

                        const propertyPayload = {
                            name: getVal(row, ['물건명']),
                            status: status, // mapped status
                            industryCategory: industryInfo?.category || '',
                            industrySector: industryInfo?.sector || '',
                            industryDetail: rawIndustryDetail,

                            address: fullAddress, // Combined Address
                            coordinates: coords, // Geocoded Coordinates

                            featureMemo: getVal(row, ['특징', '특징메모']),

                            // People
                            storePhone: getVal(row, ['업소전화']),
                            landlordName: getVal(row, ['물건주', '임대인이름']),
                            landlordPhone: getVal(row, ['물건주번호', '임대인연락처', '임대인연락처 ']), // Space trap
                            tenantName: getVal(row, ['임차인', '임차인이름']),
                            tenantPhone: getVal(row, ['임차인번호', '임차인연락처']),
                            otherContactName: getVal(row, ['관리인1', '기타이름']),
                            otherContactPhone: getVal(row, ['관리인1번호', '기타연락처']),


                            // Building Info
                            totalFloor: String(totalFloorVal || ''),
                            floor: String(floorVal || ''),
                            area: String(getVal(row, ['실면적평', '면적', '실면적']) || ''),
                            parking: String(getVal(row, ['주차']) || ''),
                            openDate: String(getVal(row, ['개업일']) || ''),
                            facilityInterior: getVal(row, ['시설인테리어', '시설/인테리어']),

                            // Business Info
                            operationType: ops.join(', '),
                            mainCustomer: getVal(row, ['주요고객층']),
                            peakTime: getVal(row, ['골든피크타임', '피크타임']),
                            tableCount: getVal(row, ['테이블룸개수', '테이블/룸']),
                            recommendedBusiness: getVal(row, ['추천업종']),

                            // Contract Info
                            leasePeriod: getVal(row, ['임대기간']),
                            rentFluctuation: getVal(row, ['임대료변동']),
                            docDefects: getVal(row, ['공부서류하자', '공부서류 하자']),
                            transferNotice: getVal(row, ['양수도통보']),
                            settlementDefects: getVal(row, ['화해조서공증', '화해조서']),
                            lessorInfo: getVal(row, ['임대인정보']),
                            partnershipRights: getVal(row, ['동업권리관계', '동업/권리']),

                            // Financials (Ensure numbers)
                            deposit: parseAmt(getVal(row, ['보증금'])),
                            monthlyRent: parseAmt(getVal(row, ['임대료', '월임대료'])),
                            premium: parseAmt(getVal(row, ['권리금'])),
                            maintenance: parseAmt(getVal(row, ['관리비'])),

                            // Revenue & Expenses
                            monthlyRevenue: parseAmt(getVal(row, ['월총매출'])),
                            laborCost: parseAmt(getVal(row, ['인건비'])),
                            materialCost: parseAmt(getVal(row, ['재료비'])),
                            rentMaintenance: parseAmt(getVal(row, ['임대관리비'])),
                            taxUtilities: parseAmt(getVal(row, ['제세공과금'])),
                            maintenanceDepreciation: parseAmt(getVal(row, ['유지보수감가', '유지보수'])),
                            promoMisc: parseAmt(getVal(row, ['홍보기타잡비', '기타경비', '홍보/기타'])),

                            monthlyProfit: parseAmt(getVal(row, ['월예상수익', '월순수익'])),
                            yieldPercent: parseAmt(getVal(row, ['월예상수익률', '수익률'])),
                            revenueMemo: getVal(row, ['매출오픈여부', '매출/지출 메모']),

                            // Franchise
                            hqDeposit: parseAmt(getVal(row, ['본사보증금'])),
                            franchiseFee: parseAmt(getVal(row, ['가맹비'])),
                            educationFee: parseAmt(getVal(row, ['교육비'])),
                            renewal: parseAmt(getVal(row, ['리뉴얼'])),
                            royalty: parseAmt(getVal(row, ['로열티', '로열티(월)'])),

                            isFavorite: false,
                            processStatus: '접수',
                            createdAt: new Date().toISOString()
                        };

                        const res = await fetch('/api/properties', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(propertyPayload)
                        });

                        if (res.ok) successCount++;
                        else failCount++;

                    } catch (err) {
                        console.error('Row import failed', err);
                        failCount++;
                    }
                }

                let msg = `업로드 완료: 성공 ${successCount}건, 실패 ${failCount}건`;
                if (hasSpecialWarning) {
                    msg += `\n\n[알림] '특수' 운영형태가 포함된 항목이 있습니다.\n위탁 및 본사 운영으로 자동 체크되었으니, 추후 상세 내용을 확인 후 수정해주세요.`;
                }
                alert(msg);
                fetchProperties();

            } catch (error) {
                console.error('File parse error:', error);
                alert('파일을 처리하는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
                if (fileInputRefExport.current) fileInputRefExport.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Resizer component removed from here


    // Toggle Favorite
    const handleToggleFavorite = async (id: string, current: boolean) => {
        try {
            const res = await fetch(`/api/properties?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !current })
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
                    <td className={styles.cellCompact}>
                        {item.processStatus && (
                            <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                backgroundColor: '#7950f2', // Uniform color as requested, or customize per status
                                color: 'white'
                            }}>
                                {item.processStatus}
                            </span>
                        )}
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
            address: '주소', status: '물건등급', type: '업종(중분류)', industryDetail: '업종(소분류)', operationType: '운영형태', processStatus: '진행상황', features: '특징', floor: '층수', area: '실면적',
            deposit: '보증금', monthlyRent: '임대료', premium: '권리금', totalPrice: '합계',
            monthlyProfit: '월순익', monthlyRevenue: '월매출', manager: '담당자',
            createdAt: '등록일', updatedAt: '최종작성일', yield: '수익률'
        }[col] || col;
    };

    // Legacy getHeaderLabel (kept for table headers mostly but can assume overlap)
    const getHeaderLabel = (column: string) => {
        const labels: { [key: string]: string } = {
            no: 'NO', isFavorite: '★', processStatus: '진행상황', name: '물건명', grade: '물건등급', address: '주소', status: '물건등급', type: '업종(중분류)', industryDetail: '업종(소분류)', operationType: '운영형태',
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

                    {/* VIEW MODE SWITCHER */}
                    <ViewModeSwitcher currentMode={viewMode} onModeChange={handleModeChange} />

                    {/* SORT BUTTON */}
                    <div style={{ position: 'relative' }} ref={sortDropdownRef}>
                        <button
                            className={`${styles.actionBtn} ${isSortDropdownOpen ? styles.active : ''}`}
                            style={sortRules.length > 0 ? { color: '#228be6', borderColor: '#228be6', backgroundColor: '#e7f5ff' } : {}}
                            onClick={() => {
                                setIsSortDropdownOpen(!isSortDropdownOpen);
                                setIsColumnSelectorOpen(false);
                                // Default to picker if empty, else rules list (adding is false)
                                setIsAddingSort(sortRules.length === 0);
                            }}
                        >
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
                            <ChevronDown size={14} />
                        </button>
                        {isSortDropdownOpen && (
                            <div className={styles.dropdownMenu} style={{
                                width: (isAddingSort || sortRules.length === 0) ? 200 : 320,
                                zIndex: 1001
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
                    <div style={{ position: 'relative' }} ref={toolbarFilterRef}>
                        <button
                            className={`${styles.actionBtn} ${isFilterMenuOpen ? styles.active : ''}`}
                            onClick={() => {
                                setIsFilterMenuOpen(!isFilterMenuOpen);
                                // setIsColumnSelectorOpen(false); // Valid to keep both open
                                setLastActiveDropdown('filter');
                            }}
                        >
                            <Filter size={16} />
                            <span>필터</span>
                            <ChevronDown size={14} />
                        </button>

                        {/* Filter Main Menu (Vertical List) */}
                        {isFilterMenuOpen && (
                            <div className={styles.filterMenuDropdown} style={{
                                zIndex: lastActiveDropdown === 'filter' ? 1002 : 1001
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


                    <div style={{ position: 'relative' }} ref={columnSelectorRef}>
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

                    <Link href="/properties/register" className={`${styles.actionBtn} ${styles.primaryBtn}`}>
                        <Plus size={16} />
                        <span>새로 만들기</span>
                    </Link>
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
                                                <label className={styles.checkboxLabel} style={{ width: '100%', cursor: 'pointer' }}>
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
                                                        <label key={status} className={styles.checkboxLabel}>
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
                                                        <label key={m.id} className={styles.checkboxLabel}>
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
                                                        <label key={type} className={styles.checkboxLabel}>
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
                                                        <label key={det} className={styles.checkboxLabel}>
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


            {/* Data Grid */}
            <div className={styles.gridContainer}>
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
            < div className={styles.footer} >
                <div className={styles.totalCount}>
                    전체 <strong>{filteredProperties.length}</strong>건 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProperties.length)}
                </div>

                <div className={styles.pagination}>
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
                    <input
                        type="file"
                        ref={fileInputRefExport}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        onChange={handleExcelUpload}
                    />
                    <button
                        className={styles.footerBtn}
                        onClick={() => fileInputRefExport.current?.click()}
                        style={{ color: '#217346', borderColor: '#217346', marginRight: '8px' }}
                    >
                        <Layout size={16} />
                        <span>엑셀 업로드</span>
                    </button>
                    <button className={styles.footerBtn} onClick={handleExcelExport}>
                        <Download size={16} />
                        <span>엑셀 저장</span>
                    </button>
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
            </div >


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
                            />
                        </div>
                    </div>
                )
            }
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
