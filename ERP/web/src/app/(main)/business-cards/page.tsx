"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star, Plus, UserPlus, X, Trash2, Contact, FileSpreadsheet, ChevronDown, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from '@/app/(main)/customers/page.module.css'; // Reusing Customer styles
import BusinessCard from '@/components/business/BusinessCard';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface BusinessCardData {
    id: string;
    name: string;
    gender: 'M' | 'F';
    category: string;
    companyName: string;
    department: string;
    mobile: string;
    companyPhone1: string;
    companyPhone2: string;
    email: string;
    memo: string;
    companyAddress?: string; // Added companyAddress
    userCompanyName?: string;
    managerId?: string;
    manager_id?: string; // UUID
    isFavorite?: boolean;
    createdAt?: string;
    updatedAt?: string;
    history?: any[];
}

function BusinessCardListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [cards, setCards] = useState<BusinessCardData[]>([]);
    const [managers, setManagers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filter States
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // View Mode State
    const [viewMode, setViewMode] = useState<ViewMode>('center');
    const [isCardOpen, setIsCardOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    // Drawer State
    const [drawerWidth, setDrawerWidth] = useState(1200);
    const drawerResizingRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

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

    useEffect(() => {
        const queryId = searchParams.get('id');
        if (queryId) {
            setSelectedCardId(queryId);
            setIsCardOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchCards();
        fetchManagers();
    }, []);

    // Close Dropdown on Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        };
        if (isCategoryDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCategoryDropdownOpen]);

    const fetchManagers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, string> = {};
                data.forEach((u: any) => {
                    map[u.id] = u.name;
                    if (u.uuid) map[u.uuid] = u.name; // Map UUIDs for fallback
                });
                setManagers(map);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchCards = async () => {
        try {
            const userStr = localStorage.getItem('user');
            let query = '';
            if (userStr) {
                const parsed = JSON.parse(userStr);
                const user = parsed.user || parsed; // Handle wrapped 'user' object
                const params = new URLSearchParams();
                if (user.companyName) params.append('company', user.companyName);
                // Use uid (UUID) if available, fallback to id (legacy)
                if (user.uid) params.append('userId', user.uid);
                else if (user.id) params.append('userId', user.id);
                query = `?${params.toString()}`;
            }

            const res = await fetch(`/api/business-cards${query}`);
            if (res.ok) {
                const data = await res.json();

                setCards(data);

                // Extract Categories
                const uniqueCats = Array.from(new Set(data.map((c: any) => c.category).filter(Boolean))).sort() as string[];
                setCategories(uniqueCats);
                setSelectedCategories(uniqueCats); // Default select all
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<{ main: File | null; promoted: File | null; history: File | null }>({
        main: null,
        promoted: null,
        history: null
    });

    const parseExcel = (file: File) => {
        return new Promise<any[]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' }); // or 'array'
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
            showAlert('명함정보(Main) 파일은 필수입니다.', 'error');
            return;
        }

        showConfirm('선택한 파일들로 명함 데이터를 업로드하시겠습니까?\n(기존 관리ID가 있는 경우 업데이트됩니다)', async () => {
            setLoading(true);
            try {
                // Parse all files
                const mainData = await parseExcel(uploadFiles.main!);
                const promotedData = uploadFiles.promoted ? await parseExcel(uploadFiles.promoted) : [];
                const historyData = uploadFiles.history ? await parseExcel(uploadFiles.history) : [];

                // Add metadata (managerId, etc)
                const userStr = localStorage.getItem('user');
                let userCompanyName = 'Unknown';
                let managerIdVal = 'Unknown';
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed;
                    userCompanyName = user.companyName || 'Unknown';
                    managerIdVal = user.uid || user.id || 'Unknown';
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

                const res = await fetch('/api/business-cards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const result = await res.json();
                    showAlert(`업로드 완료\n- 명함: ${result.cards.created}개 생성, ${result.cards.updated}개 수정`, 'success');
                    setIsUploadModalOpen(false);
                    setUploadFiles({ main: null, promoted: null, history: null });
                    fetchCards();
                } else {
                    const err = await res.json();
                    showAlert(`업로드 실패: ${err.error || '알 수 없는 오류'}`, 'error');
                }

            } catch (error) {
                console.error(error);
                showAlert('파일 처리 중 오류가 발생했습니다.', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    // --- Sync Logic ---
    // --- Sync Logic ---
    const handleSync = async () => {
        showConfirm('현재 등록된 명함의 내역과 점포 데이터를 동기화하시겠습니까?\n(오래 걸릴 수 있습니다.)', async () => {
            setLoading(true);
            try {
                const userStr = localStorage.getItem('user');
                const parsed = userStr ? JSON.parse(userStr) : {};
                const user = parsed.user || parsed;

                const res = await fetch('/api/business-cards/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId: user.companyId || user.company_id })
                });
                const result = await res.json();

                if (res.ok) {
                    showAlert(`동기화 완료!\n- 작업내역 연결: ${result.results.history.matched}건 성공\n- 추진물건 연결: ${result.results.promoted.matched}건 성공`, 'success');
                    fetchCards(); // Refresh list
                } else {
                    showAlert('동기화 실패: ' + (result.error || '알 수 없는 오류'), 'error');
                }
            } catch (e) {
                console.error(e);
                showAlert('동기화 중 오류가 발생했습니다.', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    // Remove old single-file handler
    const handleExcelUpload_DEPRECATED = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... kept for reference if needed, but UI replaced
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
            router.push(`/business-cards/register?id=${id}`);
        } else {
            setSelectedCardId(id);
            setIsCardOpen(true);
        }
    };

    const handleNewClick = () => {
        if (viewMode === 'page') {
            router.push(`/business-cards/register`);
        } else {
            setSelectedCardId(null);
            setIsCardOpen(true);
        }
    };

    const handleCloseCard = () => {
        setIsCardOpen(false);
        setSelectedCardId(null);
    };

    const handleCardSuccess = () => {
        handleCloseCard();
        fetchCards();
    };

    // ESC Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleCloseCard();
        };
        if (isCardOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCardOpen]);

    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(filteredCards.map(c => c.id));
        else setSelectedIds([]);
    };

    const toggleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev => checked ? [...prev, id] : prev.filter(pid => pid !== id));
    };

    const toggleCategoryFilter = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleSelectAllCategories = (checked: boolean) => {
        if (checked) setSelectedCategories([...categories]);
        else setSelectedCategories([]);
    };


    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        showConfirm(`${selectedIds.length}개의 명함을 삭제하시겠습니까?`, async () => {
            setLoading(true);
            try {
                for (const id of selectedIds) {
                    await fetch(`/api/business-cards?id=${id}`, { method: 'DELETE' });
                }
                showAlert('삭제되었습니다.', 'success');
                setSelectedIds([]);
                fetchCards();
            } catch (e) {
                console.error(e);
                showAlert('오류 발생', 'error');
            } finally {
                setLoading(false);
            }
        }, true);
    };

    const toggleFavorite = async (id: string, currentStatus: boolean | undefined) => {
        const newStatus = !currentStatus;

        // Optimistic Update
        setCards(prev => prev.map(c => c.id === id ? { ...c, isFavorite: newStatus } : c));

        try {
            await fetch('/api/business-cards', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isFavorite: newStatus })
            });
        } catch (e) {
            console.error(e);
            // Revert on error
            setCards(prev => prev.map(c => c.id === id ? { ...c, isFavorite: currentStatus } : c));
        }
    };

    const getLatestWorkDate = (history: any[]) => {
        if (!history || history.length === 0) return '-';
        // Basic string sort works for YYYY-MM-DD
        const sorted = [...history].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return sorted[0].date || '-';
    };

    const filteredCards = cards.filter(c => {
        if (showFavoritesOnly && !c.isFavorite) return false;

        if (selectedCategories.length > 0 && c.category && !selectedCategories.includes(c.category)) return false;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                (c.name || '').toLowerCase().includes(term) ||
                (c.companyName || '').toLowerCase().includes(term) ||
                (c.mobile || '').includes(term) ||
                (c.companyPhone1 || '').includes(term) ||
                (c.email || '').toLowerCase().includes(term) ||
                (c.category || '').toLowerCase().includes(term)
            );
        }
        return true;
    });

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div
                    className={`${styles.title} ${showFavoritesOnly ? styles.activeFavorite : ''} `}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                    <div className={styles.checkboxSquare}>
                        {showFavoritesOnly && <div className={styles.checkboxInner} />}
                    </div>
                    <Star size={18} fill={showFavoritesOnly ? "#FAB005" : "none"} color={showFavoritesOnly ? "#FAB005" : "#868e96"} />
                    <span style={{ color: showFavoritesOnly ? '#343a40' : '#868e96' }}>관심명함</span>
                </div>

                {/* Category Dropdown Filter */}
                <div className={styles.searchGroup}>
                    <div className={styles.dropdownContainer} ref={categoryDropdownRef} style={{ position: 'relative' }}>
                        <button
                            className={styles.statusFilterBtn}
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, width: 'auto', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '6px' }}
                        >
                            <span style={{ fontWeight: 600, color: '#343a40' }}>분류</span>
                            <span style={{ fontSize: '12px', color: '#868e96', background: '#f1f3f5', padding: '2px 6px', borderRadius: 10 }}>
                                {categories.length > 0 && selectedCategories.length === categories.length ? '전체' : selectedCategories.length}
                            </span>
                            <ChevronDown size={14} color="#868e96" />
                        </button>

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
                                gap: 4
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
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>전체 선택</span>
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
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = selectedCategories.includes(cat) ? '#d0ebff' : '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedCategories.includes(cat) ? '#e7f5ff' : 'transparent'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat)}
                                            readOnly
                                            style={{ cursor: 'pointer', margin: 0 }}
                                        />
                                        <span style={{ fontSize: '14px' }}>{cat}</span>
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <div style={{ padding: 8, color: '#868e96', fontSize: '13px', textAlign: 'center' }}>분류가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Search & Actions - Wrapped for Mobile Layout */}
                <div className={styles.searchInputWrap}>
                    <span>검색어 : </span>
                    <input
                        className={styles.searchInput}
                        placeholder="이름, 회사, 전화번호, 분류"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        className={`${styles.footerBtn} ${styles.mobileHidden}`}
                        onClick={handleSync}
                        style={{ backgroundColor: '#1098AD', color: 'white', borderColor: '#1098AD', display: 'flex', alignItems: 'center', gap: 6, marginLeft: '8px' }}
                    >
                        <RefreshCw size={14} />
                        DB 동기화
                    </button>
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
                        <col style={{ width: 100 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 120 }} />
                        <col />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                    checked={filteredCards.length > 0 && selectedIds.length === filteredCards.length}
                                />
                            </th>
                            <th>No</th>
                            <th></th>
                            <th>분류</th>
                            <th>이름</th>
                            <th>회사명</th>
                            <th>부서/직급</th>
                            <th>핸드폰</th>
                            <th>회사전화</th>
                            <th>이메일</th>
                            <th>담당자</th>
                            <th>등록일</th>
                            <th>작업일</th>
                            <th>메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCards.map((card, index) => (
                            <tr key={card.id} className={styles.tr} onClick={() => handleRowClick(card.id)}>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(card.id)}
                                        onChange={(e) => toggleSelectOne(card.id, e.target.checked)}
                                    />
                                </td>
                                <td>{filteredCards.length - index}</td>
                                <td onClick={(e) => { e.stopPropagation(); toggleFavorite(card.id, card.isFavorite); }} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                                    <Star size={16} color={card.isFavorite ? "#FAB005" : "#ced4da"} fill={card.isFavorite ? "#FAB005" : "none"} />
                                </td>
                                <td><span className={styles.classBadge} style={{ background: '#f1f3f5', color: '#495057' }}>{card.category}</span></td>
                                <td style={{ fontWeight: 'bold' }}>{card.name}</td>
                                <td>{card.companyName}</td>
                                <td>{card.department}</td>
                                <td>{card.mobile}</td>
                                <td>{card.companyPhone1}</td>
                                <td>{card.email}</td>
                                <td style={{ color: '#868e96' }}>
                                    {managers[card.managerId || ''] || managers[card.manager_id || ''] || card.managerId || '-'}
                                </td>
                                <td style={{ fontSize: '0.9em', color: '#868e96' }}>{card.createdAt ? card.createdAt.split('T')[0] : '-'}</td>
                                <td style={{ fontSize: '0.9em', color: '#228be6' }}>{getLatestWorkDate(card.history || [])}</td>
                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#868e96' }}>{card.memo}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <div>목록 : {filteredCards.length}건</div>
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
                        className={`${styles.footerBtn} ${styles.primaryBtn} `}
                        onClick={handleNewClick}
                    >
                        <Contact size={14} />
                        신규명함
                    </button>

                    {/* Multi-file Upload Modal Trigger */}
                    <button
                        className={`${styles.footerBtn} ${styles.mobileHidden}`}
                        onClick={() => setIsUploadModalOpen(true)}
                        style={{ cursor: 'pointer', background: '#228be6', color: 'white', borderColor: '#228be6', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <FileSpreadsheet size={14} />
                        엑셀업로드 (통합)
                    </button>
                </div>
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsUploadModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ width: 500, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>명함 데이터 일괄 업로드</h3>
                        <p style={{ margin: 0, color: '#868e96', fontSize: 13 }}>
                            세 개의 엑셀 파일(명함정보, 추진물건, 작업내역)을 모두 선택해주세요.<br />
                            '관리ID'를 기준으로 데이터가 자동 연결됩니다.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>1. 명함정보 (Main)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setUploadFiles(prev => ({ ...prev, main: e.target.files?.[0] || null }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>2. 추진물건 (Promoted)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setUploadFiles(prev => ({ ...prev, promoted: e.target.files?.[0] || null }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>3. 작업내역 (History)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setUploadFiles(prev => ({ ...prev, history: e.target.files?.[0] || null }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                className={styles.footerBtn}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleBatchUpload}
                                className={`${styles.footerBtn} ${styles.primaryBtn} `}
                                disabled={!uploadFiles.main || loading}
                                style={{ opacity: (!uploadFiles.main || loading) ? 0.5 : 1 }}
                            >
                                {loading ? '업로드 중...' : '업로드 시작'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isCardOpen && viewMode === 'center' && (
                <div className={styles.modalOverlay} onClick={handleCloseCard}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <BusinessCard
                            id={selectedCardId}
                            onClose={handleCloseCard}
                            onSuccess={handleCardSuccess}
                            isModal={false}
                            onNavigate={(action) => {
                                const currentIndex = filteredCards.findIndex(c => c.id === selectedCardId);
                                if (currentIndex === -1) return;

                                let nextIndex = currentIndex;
                                if (action === 'prev') nextIndex = Math.max(0, currentIndex - 1);
                                else if (action === 'next') nextIndex = Math.min(filteredCards.length - 1, currentIndex + 1);
                                else if (action === 'first') nextIndex = 0;
                                else if (action === 'last') nextIndex = filteredCards.length - 1;

                                if (nextIndex !== currentIndex) {
                                    setSelectedCardId(filteredCards[nextIndex].id);
                                }
                            }}
                            canNavigate={{
                                first: filteredCards.findIndex(c => c.id === selectedCardId) > 0,
                                prev: filteredCards.findIndex(c => c.id === selectedCardId) > 0,
                                next: filteredCards.findIndex(c => c.id === selectedCardId) < filteredCards.length - 1,
                                last: filteredCards.findIndex(c => c.id === selectedCardId) < filteredCards.length - 1
                            }}
                        />
                    </div>
                </div>
            )}

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
                        <BusinessCard
                            id={selectedCardId}
                            onClose={handleCloseCard}
                            onSuccess={handleCardSuccess}
                            onNavigate={(action) => {
                                const currentIndex = filteredCards.findIndex(c => c.id === selectedCardId);
                                if (currentIndex === -1) return;

                                let nextIndex = currentIndex;
                                if (action === 'prev') nextIndex = Math.max(0, currentIndex - 1);
                                else if (action === 'next') nextIndex = Math.min(filteredCards.length - 1, currentIndex + 1);
                                else if (action === 'first') nextIndex = 0;
                                else if (action === 'last') nextIndex = filteredCards.length - 1;

                                if (nextIndex !== currentIndex) {
                                    setSelectedCardId(filteredCards[nextIndex].id);
                                }
                            }}
                            canNavigate={{
                                first: filteredCards.findIndex(c => c.id === selectedCardId) > 0,
                                prev: filteredCards.findIndex(c => c.id === selectedCardId) > 0,
                                next: filteredCards.findIndex(c => c.id === selectedCardId) < filteredCards.length - 1,
                                last: filteredCards.findIndex(c => c.id === selectedCardId) < filteredCards.length - 1
                            }}
                        />
                    </div>
                </div>
            )}
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
        </div>
    );
}

export default function BusinessCardListPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BusinessCardListContent />
        </Suspense>
    );
}
