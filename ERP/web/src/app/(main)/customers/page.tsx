"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star, UserPlus, X, Trash2, RefreshCw, FileSpreadsheet, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from './page.module.css';
import CustomerCard from '@/components/customers/CustomerCard';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface Customer {
    id: string;
    name: string;
    grade: string;
    gender: 'M' | 'F';
    class: string;
    status: string;
    feature: string;
    address: string;
    mobile: string;
    companyPhone: string;
    wantedDepositMin: string;
    wantedDepositMax: string;
    wantedRentMin: string;
    wantedRentMax: string;
    wantedItem: string;
    wantedIndustry: string;
    wantedArea: string;
    createdAt: string;
    updatedAt: string;
    managerId: string;
    manager_id?: string; // UUID from DB
    isFavorite?: boolean;
    history?: any[];
}

const STATUS_OPTIONS = [
    { value: 'progress', label: '추진', class: styles.badgeProgress },
    { value: 'manage', label: '관리', class: styles.badgeManage },
    { value: 'hold', label: '보류', class: styles.badgeHold },
    { value: 'common', label: '공동', class: styles.badgeCommon },
    { value: 'complete', label: '완료', class: styles.badgeComplete },
];

interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

function CustomerListPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [managers, setManagers] = useState<Record<string, string>>({}); // id -> name map
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filter States
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['progress', 'manage', 'hold', 'common', 'complete']);

    // Selection State
    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // Limit State with Persistence
    const [limit, setLimit] = useState<number | 'all'>(500);
    const [isCustomLimit, setIsCustomLimit] = useState(false);

    // Load Limit from LocalStorage
    useEffect(() => {
        const savedLimit = localStorage.getItem('customerLimit');
        if (savedLimit) {
            const val = savedLimit === 'all' ? 'all' : Number(savedLimit);
            setLimit(val);
            // Check if saved value is a standard option
            const standardOptions = [100, 300, 500, 1000, 'all'];
            if (!standardOptions.includes(val)) {
                setIsCustomLimit(true);
            }
        }
    }, []);

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'custom') {
            setIsCustomLimit(true);
            // Don't change limit value yet, just switch UI
        } else {
            const numVal = val === 'all' ? 'all' : Number(val);
            setLimit(numVal);
            localStorage.setItem('customerLimit', numVal.toString());
            setIsCustomLimit(false);
        }
    };

    const handleCustomLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
            setLimit(val);
            localStorage.setItem('customerLimit', val.toString());
        }
    };

    // View Mode State
    const [viewMode, setViewMode] = useState<ViewMode>('center');
    const [isCardOpen, setIsCardOpen] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Drawer State
    const [drawerWidth, setDrawerWidth] = useState(1200);

    const drawerResizingRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<{ main: File | null, promoted: File | null, history: File | null }>({ main: null, promoted: null, history: null });

    // New Features State
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [colWidths, setColWidths] = useState<Record<string, number>>({
        checkbox: 30, no: 40, star: 30, name: 100, grade: 60, gender: 40,
        class: 90, status: 80, feature: 200, address: 300, mobile: 120,
        companyPhone: 120, deposit: 100, rent: 100, wantedItem: 80,
        wantedIndustry: 80, wantedArea: 80, createdAt: 120, manager: 80,
        latestWork: 140
    });
    const resizingRef = useRef<{ key: string, startX: number, startWidth: number } | null>(null);

    // Category Filter State
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const fetchControllerRef = useRef<AbortController | null>(null);

    // Derived Categories
    const categories = React.useMemo(() => {
        const unique = new Set(customers.map(c => c.class).filter(Boolean));
        return Array.from(unique);
    }, [customers]);

    // Initialize selected categories when categories change (optional: select all by default?)
    // Creating a default selection effect if needed, OR start with empty means 'ALL'.
    // Let's stick to: Empty = All (or handle explicitly).
    // Actually in BusinessCard we did: categories.length > 0 && selectedCategories.length === categories.length ? 'All'
    // Let's initialize selectedCategories with ALL when categories valid and empty.
    useEffect(() => {
        if (categories.length > 0 && selectedCategories.length === 0) {
            setSelectedCategories(categories);
        }
    }, [categories]);

    // Modal State
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', title: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => { } });

    const showAlert = (message: string, title?: string) => {
        setAlertConfig({ isOpen: true, message, title: title || '알림' });
    };

    const showConfirm = (message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, message, onConfirm });
    };

    const closeAlert = () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };


    useEffect(() => {
        const queryId = searchParams.get('id');
        if (queryId) {
            setSelectedCustomerId(queryId);
            setIsCardOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchCustomers();
        fetchManagers();
    }, [limit]);

    const parseExcel = (file: File) => {
        return new Promise<any[]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    };

    const handleBatchUpload = async () => {
        if (!uploadFiles.main) {
            showAlert('고객정보(Main) 파일은 필수입니다.');
            return;
        }

        showConfirm('선택한 파일들로 고객 데이터를 업로드하시겠습니까?\n(관리번호 기준 업데이트)', async () => {
            setLoading(true);
            try {
                const mainData = await parseExcel(uploadFiles.main!);
                const promotedData = uploadFiles.promoted ? await parseExcel(uploadFiles.promoted) : [];
                const historyData = uploadFiles.history ? await parseExcel(uploadFiles.history) : [];

                // Add metadata
                const userStr = localStorage.getItem('user');
                let userCompanyName = 'Unknown';
                let managerIdVal = '';
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed;
                    userCompanyName = user.companyName || 'Unknown';
                    managerIdVal = user.uid || user.id || '';
                }

                const payload = {
                    main: mainData,
                    promoted: promotedData,
                    history: historyData,
                    meta: {
                        userCompanyName,
                        managerId: managerIdVal
                    }
                };

                const res = await fetch('/api/customers/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const result = await res.json();
                    showAlert(`업로드 완료\n- 처리된 데이터: ${result.count || 0}건`);
                    setIsUploadModalOpen(false);
                    setUploadFiles({ main: null, promoted: null, history: null });
                    fetchCustomers();
                } else {
                    const err = await res.json();
                    showAlert(`업로드 실패: ${err.error || '알 수 없는 오류'}`);
                }
            } catch (error) {
                console.error(error);
                showAlert('오류 발생');
            } finally {
                setLoading(false);
            }
        });
    };

    const handleSync = async () => {
        showConfirm('고객 작업내역 및 추진물건을 시스템(일정/부동산)과 동기화하시겠습니까?', async () => {
            setLoading(true);
            try {
                const userStr = localStorage.getItem('user');
                const parsed = userStr ? JSON.parse(userStr) : {};
                const user = parsed.user || parsed; // Handle wrapped 'user'

                const res = await fetch('/api/customers/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId: user.companyId || user.company_id })
                });
                const result = await res.json();
                if (res.ok) {
                    showAlert(`동기화 완료\n- 일정 등록: ${result.results.history.matched}건\n- 물건 연결: ${result.results.promoted.linkFound}건`);
                    fetchCustomers();
                } else {
                    showAlert('동기화 실패: ' + result.error);
                }
            } catch (e) {
                console.error(e);
                showAlert('오류 발생');
            } finally {
                setLoading(false);
            }
        });
    };

    const fetchCustomers = async () => {
        // Cancel previous request if exists
        if (fetchControllerRef.current) {
            fetchControllerRef.current.abort();
        }
        const controller = new AbortController();
        fetchControllerRef.current = controller;

        try {
            setLoading(true);
            const userStr = localStorage.getItem('user');

            const queryParams = new URLSearchParams();

            // Limit Param
            if (limit !== 'all') {
                queryParams.append('limit', limit.toString());
            } else {
                queryParams.append('limit', 'all');
            }

            // Company Param
            if (userStr) {
                const parsed = JSON.parse(userStr);
                const user = parsed.user || parsed;
                if (user.companyName) {
                    queryParams.append('company', user.companyName);
                }
            }

            const query = `?${queryParams.toString()}`;
            const res = await fetch(`/api/customers${query}`, { signal: controller.signal });

            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error(error);
        } finally {
            if (fetchControllerRef.current === controller) {
                fetchControllerRef.current = null;
                setLoading(false);
            }
        }
    };

    const fetchManagers = async () => {
        try {
            const userStr = localStorage.getItem('user');
            const parsed = userStr ? JSON.parse(userStr) : {};
            const user = parsed.user || parsed;
            const companyQuery = user?.companyName ? `?company=${encodeURIComponent(user.companyName)}` : '';

            const res = await fetch(`/api/users${companyQuery}`);
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, string> = {};
                data.forEach((u: any) => {
                    if (u.id) map[u.id] = u.name;
                    if (u.uuid) map[u.uuid] = u.name; // Fallback for UUID based lookups
                });
                setManagers(map);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Drawer Resize Logic
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
        const diff = startX - e.clientX;
        const newWidth = Math.max(400, Math.min(window.innerWidth * 0.9, startWidth + diff));
        setDrawerWidth(newWidth);
    }, []);

    const handleDrawerMouseUp = React.useCallback(() => {
        drawerResizingRef.current = null;
        document.removeEventListener('mousemove', handleDrawerMouseMove);
        document.removeEventListener('mouseup', handleDrawerMouseUp);
        document.body.style.cursor = '';
    }, [handleDrawerMouseMove]);

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleDrawerMouseMove);
            document.removeEventListener('mouseup', handleDrawerMouseUp);
        };
    }, [handleDrawerMouseMove]);

    // Resize Handler
    const handleResizeMouseDown = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = {
            key,
            startX: e.clientX,
            startWidth: colWidths[key] || 100
        };
        document.addEventListener('mousemove', handleColumnResizeMouseMove);
        document.addEventListener('mouseup', handleColumnResizeMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleColumnResizeMouseMove = React.useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { key, startX, startWidth } = resizingRef.current;
        const diff = e.clientX - startX;
        setColWidths(prev => ({
            ...prev,
            [key]: Math.max(30, startWidth + diff)
        }));
    }, []);

    const handleColumnResizeMouseUp = React.useCallback(() => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleColumnResizeMouseMove);
        document.removeEventListener('mouseup', handleColumnResizeMouseUp);
        document.body.style.cursor = '';
    }, [handleColumnResizeMouseMove]);


    // Click Outside for Category Dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('mousemove', handleColumnResizeMouseMove); // Cleanup resize too just in case
            document.removeEventListener('mouseup', handleColumnResizeMouseUp);
        };
    }, [handleColumnResizeMouseMove, handleColumnResizeMouseUp]);


    const handleRowClick = (id: string) => {
        if (viewMode === 'page') {
            router.push(`/customers/register?id=${id}`);
        } else {
            setSelectedCustomerId(id);
            setIsCardOpen(true);
        }
    };

    const handleNewClick = () => {
        if (viewMode === 'page') {
            router.push(`/customers/register`);
        } else {
            setSelectedCustomerId(null);
            setIsCardOpen(true);
        }
    };

    const handleCloseCard = () => {
        setIsCardOpen(false);
        setSelectedCustomerId(null);
    };

    const handleCardSuccess = () => {
        handleCloseCard();
        fetchCustomers();
    };

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCloseCard();
            }
        };
        if (isCardOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCardOpen]);

    const getBadgeClass = (grade: string) => {
        switch (grade) {
            case 'progress': return styles.badgeProgress;
            case 'manage': return styles.badgeManage;
            case 'hold': return styles.badgeHold;
            case 'common': return styles.badgeCommon;
            case 'complete': return styles.badgeComplete;
            default: return styles.badgeManage;
        }
    };

    const getGradeLabel = (grade: string) => {
        const found = STATUS_OPTIONS.find(o => o.value === grade);
        return found ? found.label : grade;
    };

    const toggleStatusFilter = (value: string) => {
        setSelectedStatuses(prev =>
            prev.includes(value)
                ? prev.filter(s => s !== value)
                : [...prev, value]
        );
    };

    const toggleFavorite = async (e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        const updatedCustomer = { ...customer, isFavorite: !customer.isFavorite };

        // Optimistic update
        setCustomers(prev => prev.map(c => c.id === customer.id ? updatedCustomer : c));

        try {
            await fetch('/api/customers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCustomer)
            });
        } catch (error) {
            console.error('Failed to update favorite', error);
            // Revert on error
            setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
        }
    };

    const getLatestWorkDate = (history: any[]) => {
        if (!history || history.length === 0) return '-';
        const sorted = [...history].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return sorted[0].date || '-';
    };

    // Sorting Logic
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Category Filter Logic
    const toggleCategoryFilter = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat)
                ? prev.filter(c => c !== cat)
                : [...prev, cat]
        );
    };

    const handleSelectAllCategories = (select: boolean) => {
        if (select) setSelectedCategories(categories);
        else setSelectedCategories([]);
    };

    const filteredCustomers = React.useMemo(() => {
        let result = (Array.isArray(customers) ? customers : []).filter(c => {
            // 1. Favorite Filter
            if (showFavoritesOnly && !c.isFavorite) return false;

            // 2. Status Filter
            if (!selectedStatuses.includes(c.grade)) return false;

            // 3. Category Filter
            if (selectedCategories.length > 0 && !selectedCategories.includes(c.class)) return false;

            // 4. Search Term
            if (searchTerm) {
                const term = searchTerm.replace(/-/g, '').toLowerCase();
                const mobile = (c.mobile || '').replace(/-/g, '');
                const companyPhone = (c.companyPhone || '').replace(/-/g, '');
                const feature = (c.feature || '').toLowerCase();
                const address = (c.address || '').toLowerCase();
                const name = (c.name || '').toLowerCase();
                const wantedItem = (c.wantedItem || '').toLowerCase();
                const wantedIndustry = (c.wantedIndustry || '').toLowerCase();
                const wantedArea = (c.wantedArea || '').toLowerCase();

                return name.includes(term) ||
                    mobile.includes(term) ||
                    companyPhone.includes(term) ||
                    feature.includes(term) ||
                    address.includes(term) ||
                    wantedItem.includes(term) ||
                    wantedIndustry.includes(term) ||
                    wantedArea.includes(term);
            }
            return true;
        });

        // 5. Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                // Handle complex keys if any
                let valA = (a as any)[sortConfig.key];
                let valB = (b as any)[sortConfig.key];

                if (sortConfig.key === 'no') {
                    // Sort by createdAt for 'No' column logic usually, or just leave it since No is index
                    valA = a.createdAt;
                    valB = b.createdAt;
                } else if (sortConfig.key === 'manager') {
                    valA = managers[a.managerId || ''] || a.managerId || '';
                    valB = managers[b.managerId || ''] || b.managerId || '';
                } else if (sortConfig.key === 'latestWork') {
                    // This is derived, tricky to sort efficiently in memo, but okay for small datasets
                    valA = getLatestWorkDate(a.history || []);
                    valB = getLatestWorkDate(b.history || []);
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort by createdAt desc
            result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        }

        return result;
    }, [customers, showFavoritesOnly, selectedStatuses, selectedCategories, searchTerm, sortConfig, managers]);

    // Selection Handlers
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredCustomers.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev =>
            checked ? [...prev, id] : prev.filter(pid => pid !== id)
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        showConfirm(`${selectedIds.length}명의 고객을 삭제하시겠습니까?`, async () => {
            setLoading(true);
            try {
                // Bulk Delete API Call
                const res = await fetch('/api/customers', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds })
                });

                if (res.ok) {
                    const result = await res.json();
                    showAlert(`삭제되었습니다. (${result.count || selectedIds.length}건)`);
                    setSelectedIds([]);
                    fetchCustomers();
                } else {
                    const err = await res.json();
                    showAlert(`삭제 실패: ${err.error || '알 수 없는 오류'}`);
                }
            } catch (error) {
                console.error('Delete failed', error);
                showAlert('삭제 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        });
    };

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchGroup}>
                    {/* Favorites Filter Chip */}
                    <div
                        className={`${styles.filterChip} ${showFavoritesOnly ? styles.activeFavorite : ''}`}
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    >
                        <Star size={16} fill={showFavoritesOnly ? "#fff" : "none"} color={showFavoritesOnly ? "#fff" : "#495057"} />
                        <span>관심고객</span>
                    </div>

                    {/* Category Filter Dropdown */}
                    <div className={styles.dropdownContainer} ref={categoryDropdownRef}>
                        <div
                            className={styles.statusFilterBtn}
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        >
                            <span>분류</span>
                            <span style={{ fontSize: '11px', color: '#868e96', background: '#f1f3f5', padding: '2px 6px', borderRadius: 10 }}>
                                {categories.length > 0 && selectedCategories.length === categories.length ? '전체' : selectedCategories.length}
                            </span>
                            <ChevronDown size={14} color="#868e96" />
                        </div>

                        {isCategoryDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 4,
                                background: 'white',
                                border: '1px solid #dee2e6',
                                borderRadius: 6,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                padding: 8,
                                zIndex: 1000,
                                minWidth: 160,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}>
                                <div
                                    onClick={() => handleSelectAllCategories(selectedCategories.length !== categories.length)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 4, background: '#f8f9fa' }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={categories.length > 0 && selectedCategories.length === categories.length}
                                        readOnly
                                        style={{ cursor: 'pointer', margin: 0 }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>전체 선택</span>
                                </div>
                                <div style={{ height: 1, background: '#e9ecef', margin: '4px 0' }} />
                                {categories.map(cat => (
                                    <div
                                        key={cat}
                                        onClick={() => toggleCategoryFilter(cat)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 8px',
                                            cursor: 'pointer',
                                            borderRadius: 4,
                                            background: selectedCategories.includes(cat) ? '#e7f5ff' : 'transparent',
                                            color: selectedCategories.includes(cat) ? '#1c7ed6' : '#495057'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat)}
                                            readOnly
                                            style={{ cursor: 'pointer', margin: 0 }}
                                        />
                                        <span style={{ fontSize: '13px' }}>{cat}</span>
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <div style={{ padding: 8, color: '#868e96', fontSize: '13px', textAlign: 'center' }}>분류가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.dividerVertical}></div>

                    {/* Status Filters Chips */}
                    {STATUS_OPTIONS.map(opt => {
                        const isSelected = selectedStatuses.includes(opt.value);
                        return (
                            <div
                                key={opt.value}
                                className={`${styles.filterChip} ${isSelected ? styles.active : ''} ${styles[opt.value]}`} // Use specific class for color
                                onClick={() => toggleStatusFilter(opt.value)}
                            >
                                <span>{opt.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Search - Right aligned on desktop, stacked/scroll on mobile */}
                <div className={styles.searchInputWrap}>
                    <span>검색 : </span>
                    <input
                        className={styles.searchInput}
                        placeholder="검색어 입력..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <ViewModeSwitcher currentMode={viewMode} onModeChange={setViewMode} />
                </div>
            </div>

            {/* Table */}
            <div className={styles.tableContainer}>
                <table className={styles.table} style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: colWidths.checkbox }} />
                        <col style={{ width: colWidths.no }} />
                        <col style={{ width: colWidths.star }} />
                        <col style={{ width: colWidths.name }} />
                        <col style={{ width: colWidths.grade }} />
                        <col style={{ width: colWidths.gender }} />
                        <col style={{ width: colWidths.class }} />
                        <col style={{ width: colWidths.status }} />
                        <col style={{ width: colWidths.feature }} />
                        <col style={{ width: colWidths.address }} />
                        <col style={{ width: colWidths.mobile }} />
                        <col style={{ width: colWidths.companyPhone }} />
                        <col style={{ width: colWidths.deposit }} />
                        <col style={{ width: colWidths.rent }} />
                        <col style={{ width: colWidths.wantedItem }} />
                        <col style={{ width: colWidths.wantedIndustry }} />
                        <col style={{ width: colWidths.wantedArea }} />
                        <col style={{ width: colWidths.createdAt }} />
                        <col style={{ width: colWidths.manager }} />
                        <col style={{ width: colWidths.latestWork }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                    checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                                />
                                <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'checkbox')} />
                            </th>
                            <th onClick={() => handleSort('no')} style={{ cursor: 'pointer' }}>
                                No
                                <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'no')} />
                            </th>
                            <th><div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'star')} /></th>
                            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>고객명 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'name')} /></th>
                            <th onClick={() => handleSort('grade')} style={{ cursor: 'pointer' }}>등급 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'grade')} /></th>
                            <th onClick={() => handleSort('gender')} style={{ cursor: 'pointer' }}>성별 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'gender')} /></th>
                            <th onClick={() => handleSort('class')} style={{ cursor: 'pointer' }}>분류 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'class')} /></th>
                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>진행상태 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'status')} /></th>
                            <th onClick={() => handleSort('feature')} style={{ cursor: 'pointer' }}>특징 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'feature')} /></th>
                            <th onClick={() => handleSort('address')} style={{ cursor: 'pointer' }}>주소 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'address')} /></th>
                            <th onClick={() => handleSort('mobile')} style={{ cursor: 'pointer' }}>핸드폰 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'mobile')} /></th>
                            <th onClick={() => handleSort('companyPhone')} style={{ cursor: 'pointer' }}>회사전화 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'companyPhone')} /></th>
                            <th onClick={() => handleSort('wantedDepositMin')} style={{ cursor: 'pointer' }}>보증금 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'deposit')} /></th>
                            <th onClick={() => handleSort('wantedRentMin')} style={{ cursor: 'pointer' }}>월세 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'rent')} /></th>
                            <th onClick={() => handleSort('wantedItem')} style={{ cursor: 'pointer' }}>찾는물건 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'wantedItem')} /></th>
                            <th onClick={() => handleSort('wantedIndustry')} style={{ cursor: 'pointer' }}>찾는업종 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'wantedIndustry')} /></th>
                            <th onClick={() => handleSort('wantedArea')} style={{ cursor: 'pointer' }}>찾는지역 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'wantedArea')} /></th>
                            <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>등록일 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'createdAt')} /></th>
                            <th onClick={() => handleSort('manager')} style={{ cursor: 'pointer' }}>담당자 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'manager')} /></th>
                            <th onClick={() => handleSort('latestWork')} style={{ cursor: 'pointer' }}>작업일 <div className={styles.resizer} onMouseDown={(e) => handleResizeMouseDown(e, 'latestWork')} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCustomers.map((customer, index) => (
                            <tr key={customer.id} className={styles.tr} onClick={() => handleRowClick(customer.id)}>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(customer.id)}
                                        onChange={(e) => toggleSelectOne(customer.id, e.target.checked)}
                                    />
                                </td>
                                <td>
                                    {
                                        (sortConfig?.key === 'createdAt' || sortConfig?.key === 'no') && sortConfig.direction === 'asc'
                                            ? index + 1
                                            : filteredCustomers.length - index
                                    }
                                </td>
                                <td onClick={(e) => toggleFavorite(e, customer)} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                                    <Star
                                        size={16}
                                        fill={customer.isFavorite ? "#FAB005" : "none"}
                                        color={customer.isFavorite ? "#FAB005" : "#ced4da"}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
                                <td style={{ fontWeight: 'bold' }}>
                                    {customer.name}
                                </td>
                                <td>
                                    <span className={`${styles.badge} ${getBadgeClass(customer.grade)}`}>
                                        {getGradeLabel(customer.grade)}
                                    </span>
                                </td>
                                <td>{customer.gender === 'F' ? '여' : '남'}</td>
                                {/* 물건등급 - 진행상태 영문값이 잘못 들어간 경우 표시하지 않음 */}
                                <td className={styles.classBadge}>{
                                    (() => {
                                        const cls = customer.class;
                                        // 진행상태 값이 class에 잘못 들어간 경우 빈칸으로 표시
                                        const invalidValues = ['progress', 'manage', 'hold', 'common', 'complete', 'completed'];
                                        if (!cls || invalidValues.includes(cls)) return '';
                                        return cls;
                                    })()
                                }</td>
                                <td>{customer.status}</td>
                                <td style={{ textAlign: 'left' }}>{customer.feature}</td>
                                <td style={{ textAlign: 'left' }}>{customer.address}</td>
                                <td>{customer.mobile}</td>
                                <td>{customer.companyPhone}</td>
                                <td style={{ color: 'blue' }}>
                                    {(customer.wantedDepositMin || customer.wantedDepositMax) ?
                                        `${customer.wantedDepositMin || '0'}~${customer.wantedDepositMax || ''}` : '-'}
                                </td>
                                <td style={{ color: 'blue' }}>
                                    {(customer.wantedRentMin || customer.wantedRentMax) ?
                                        `${customer.wantedRentMin || '0'}~${customer.wantedRentMax || ''}` : '-'}
                                </td>
                                <td>{customer.wantedItem}</td>
                                <td>{customer.wantedIndustry}</td>
                                <td>{customer.wantedArea}</td>
                                <td>{(customer.createdAt || '').substring(0, 10)}</td>
                                <td>{managers[customer.managerId || customer.manager_id || ''] || (customer.managerId || '-')}</td>
                                <td style={{ color: '#228be6' }}>{getLatestWorkDate(customer.history || [])}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div>목록 : {filteredCustomers.length}건</div>
                    {/* Limit Selector (Left) */}
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
                <div className={styles.footerActions}>
                    {selectedIds.length > 0 && (
                        <button
                            className={styles.footerBtn}
                            onClick={handleDeleteSelected}
                            style={{ color: '#e03131', borderColor: '#e03131' }}
                        >
                            <Trash2 size={14} />
                            삭제 ({selectedIds.length})
                        </button>
                    )}
                    <button
                        className={`${styles.footerBtn} ${styles.mobileHidden}`}
                        onClick={() => setIsUploadModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#228be6', color: 'white', borderColor: '#228be6' }}
                    >
                        <FileSpreadsheet size={14} /> 엑셀업로드
                    </button>
                    <button
                        className={`${styles.footerBtn} ${styles.mobileHidden}`}
                        onClick={handleSync}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#1098AD', color: 'white', borderColor: '#1098AD' }}
                    >
                        <RefreshCw size={14} /> DB동기화
                    </button>
                    <button
                        className={`${styles.footerBtn} ${styles.primaryBtn}`}
                        onClick={handleNewClick}
                    >
                        <UserPlus size={14} />
                        신규고객
                    </button>
                </div>
            </div>

            {/* Center Modal Overlay */}
            {
                isCardOpen && viewMode === 'center' && (
                    <div className={styles.modalOverlay} onClick={handleCloseCard}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <CustomerCard
                                id={selectedCustomerId}
                                onClose={handleCloseCard}
                                onSuccess={handleCardSuccess}
                                isModal={false}
                                onNavigate={(action) => {
                                    const currentIndex = filteredCustomers.findIndex(c => c.id === selectedCustomerId);
                                    if (currentIndex === -1) return;

                                    let nextIndex = currentIndex;
                                    if (action === 'prev') nextIndex = Math.max(0, currentIndex - 1);
                                    else if (action === 'next') nextIndex = Math.min(filteredCustomers.length - 1, currentIndex + 1);
                                    else if (action === 'first') nextIndex = 0;
                                    else if (action === 'last') nextIndex = filteredCustomers.length - 1;

                                    if (nextIndex !== currentIndex) {
                                        setSelectedCustomerId(filteredCustomers[nextIndex].id);
                                    }
                                }}
                                canNavigate={{
                                    first: filteredCustomers.findIndex(c => c.id === selectedCustomerId) > 0,
                                    prev: filteredCustomers.findIndex(c => c.id === selectedCustomerId) > 0,
                                    next: filteredCustomers.findIndex(c => c.id === selectedCustomerId) < filteredCustomers.length - 1,
                                    last: filteredCustomers.findIndex(c => c.id === selectedCustomerId) < filteredCustomers.length - 1
                                }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Side Drawer Overlay */}
            {
                isCardOpen && viewMode === 'side' && (
                    <div className={styles.drawerOverlay} onClick={handleCloseCard}>
                        <div
                            className={styles.drawerContent}
                            style={{ width: drawerWidth }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                className={styles.drawerResizer}
                                onMouseDown={handleDrawerMouseDown}
                            />
                            <CustomerCard
                                id={selectedCustomerId}
                                onClose={handleCloseCard}
                                onSuccess={handleCardSuccess}
                                isModal={false}
                                onNavigate={(action) => {
                                    const currentIndex = filteredCustomers.findIndex(c => c.id === selectedCustomerId);
                                    if (currentIndex === -1) return;

                                    let nextIndex = currentIndex;
                                    if (action === 'prev') nextIndex = Math.max(0, currentIndex - 1);
                                    else if (action === 'next') nextIndex = Math.min(filteredCustomers.length - 1, currentIndex + 1);
                                    else if (action === 'first') nextIndex = 0;
                                    else if (action === 'last') nextIndex = filteredCustomers.length - 1;

                                    if (nextIndex !== currentIndex) {
                                        setSelectedCustomerId(filteredCustomers[nextIndex].id);
                                    }
                                }}
                                canNavigate={{
                                    first: filteredCustomers.findIndex(c => c.id === selectedCustomerId) > 0,
                                    prev: filteredCustomers.findIndex(c => c.id === selectedCustomerId) > 0,
                                    next: filteredCustomers.findIndex(c => c.id === selectedCustomerId) < filteredCustomers.length - 1,
                                    last: filteredCustomers.findIndex(c => c.id === selectedCustomerId) < filteredCustomers.length - 1
                                }}
                            />
                        </div>
                    </div>
                )
            }
            {/* Upload Modal */}
            {
                isUploadModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsUploadModalOpen(false)}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ width: 500, padding: 24 }}>
                            <h3>고객 데이터 일괄 업로드</h3>
                            <p style={{ color: '#868e96', fontSize: 13, marginBottom: 16 }}>
                                관리번호가 일치하는 Main, WorkHistory, Promoted 파일을 업로드해주세요.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 500 }}>명함정보 (Main)</label>
                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadFiles(p => ({ ...p, main: e.target.files?.[0] || null }))} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 500 }}>추진물건 (Promoted)</label>
                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadFiles(p => ({ ...p, promoted: e.target.files?.[0] || null }))} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 500 }}>작업내역 (History)</label>
                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadFiles(p => ({ ...p, history: e.target.files?.[0] || null }))} style={{ width: '100%' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                                <button className={styles.footerBtn} onClick={() => setIsUploadModalOpen(false)}>취소</button>
                                <button
                                    className={`${styles.footerBtn} ${styles.primaryBtn}`}
                                    onClick={handleBatchUpload}
                                    disabled={!uploadFiles.main || loading}
                                    style={{ backgroundColor: '#228be6', color: 'white', opacity: (!uploadFiles.main || loading) ? 0.5 : 1 }}
                                >
                                    {loading ? '업로드 중...' : '업로드'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                title={alertConfig.title}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
            />
        </div >
    );
}

export default function CustomerListPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomerListPageContent />
        </Suspense>
    );
}
