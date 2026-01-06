"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star, UserPlus, X, Trash2 } from 'lucide-react';
import styles from './page.module.css';
import CustomerCard from '@/components/customers/CustomerCard';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';

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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // View Mode State
    const [viewMode, setViewMode] = useState<ViewMode>('center');
    const [isCardOpen, setIsCardOpen] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Drawer State
    const [drawerWidth, setDrawerWidth] = useState(1200);
    const drawerResizingRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

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
    }, []);

    const fetchCustomers = async () => {
        try {
            const userStr = localStorage.getItem('user');
            let query = '';
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.companyName) {
                    query = `?company=${encodeURIComponent(user.companyName)}`;
                }
            }

            const res = await fetch(`/api/customers${query}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchManagers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, string> = {};
                data.forEach((u: any) => {
                    map[u.id] = u.name;
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

    const filteredCustomers = customers.filter(c => {
        // 1. Favorite Filter
        if (showFavoritesOnly && !c.isFavorite) return false;

        // 2. Status Filter
        if (!selectedStatuses.includes(c.grade)) return false;

        // 3. Search Term (Name, Phone, CompanyPhone, Address, Feature)
        if (searchTerm) {
            const term = searchTerm.replace(/-/g, '').toLowerCase(); // Remove dashes

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
        if (!confirm(`${selectedIds.length}명의 고객을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            // Sequential delete as API might not support bulk yet
            // Ideally we should have a bulk delete endpoint
            for (const id of selectedIds) {
                await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
            }
            alert('삭제되었습니다.');
            setSelectedIds([]);
            fetchCustomers();
        } catch (error) {
            console.error('Delete failed', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div
                    className={`${styles.title} ${showFavoritesOnly ? styles.activeFavorite : ''}`}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                    <div className={styles.checkboxSquare}>
                        {showFavoritesOnly && <div className={styles.checkboxInner} />}
                    </div>
                    <Star size={18} fill={showFavoritesOnly ? "#FAB005" : "none"} color={showFavoritesOnly ? "#FAB005" : "#868e96"} />
                    <span style={{ color: showFavoritesOnly ? '#343a40' : '#868e96' }}>관심고객</span>
                </div>

                <div className={styles.searchGroup}>
                    {STATUS_OPTIONS.map(opt => {
                        const isSelected = selectedStatuses.includes(opt.value);
                        return (
                            <div
                                key={opt.value}
                                className={`${styles.statusFilterBtn} ${isSelected ? styles.active : ''}`}
                                onClick={() => toggleStatusFilter(opt.value)}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => { }} // Handled by parent click
                                    style={{ margin: 0, cursor: 'pointer', height: 13, width: 13 }}
                                />
                                <span className={`${styles.badge} ${opt.class}`}>{opt.label}</span>
                            </div>
                        );
                    })}
                    <div style={{ width: '1px', height: '20px', background: '#dee2e6', margin: '0 8px' }}></div>
                    <span>검색어 : </span>
                    <input
                        className={styles.searchInput}
                        placeholder="이름, 전화번호, 특징, 주소, 업종, 지역"
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
                        <col style={{ width: 30 }} />
                        <col style={{ width: 40 }} />
                        <col style={{ width: 30 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 60 }} />
                        <col style={{ width: 40 }} />
                        <col style={{ width: 40 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 200 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 60 }} />
                        <col style={{ width: 90 }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                    checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                                />
                            </th>
                            <th>No</th>
                            <th></th>
                            <th>고객명</th>
                            <th>등급</th>
                            <th>성별</th>
                            <th>분류</th>
                            <th>진행상태</th>
                            <th>특징</th>
                            <th>주소</th>
                            <th>핸드폰</th>
                            <th>회사전화</th>
                            <th>보증금</th>
                            <th>월세</th>
                            <th>찾는물건</th>
                            <th>찾는업종</th>
                            <th>찾는지역</th>
                            <th>등록일</th>
                            <th>담당자</th>
                            <th>작업일</th>
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
                                <td>{filteredCustomers.length - index}</td>
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
                                <td className={styles.classBadge}>{customer.class}급</td>
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
                                <td>{customer.createdAt}</td>
                                <td>{managers[customer.managerId] || customer.managerId}</td>
                                <td style={{ color: '#228be6' }}>{getLatestWorkDate(customer.history || [])}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <div>목록 : {filteredCustomers.length}건</div>
                <div style={{ display: 'flex', gap: 8 }}>
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
                        className={`${styles.footerBtn} ${styles.primaryBtn}`}
                        onClick={handleNewClick}
                    >
                        <UserPlus size={14} />
                        신규고객
                    </button>
                </div>
            </div>

            {/* Center Modal Overlay */}
            {isCardOpen && viewMode === 'center' && (
                <div className={styles.modalOverlay} onClick={handleCloseCard}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <CustomerCard
                            id={selectedCustomerId}
                            onClose={handleCloseCard}
                            onSuccess={handleCardSuccess}
                            isModal={false}
                        />
                    </div>
                </div>
            )}

            {/* Side Drawer Overlay */}
            {isCardOpen && viewMode === 'side' && (
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
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CustomerListPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomerListPageContent />
        </Suspense>
    );
}
