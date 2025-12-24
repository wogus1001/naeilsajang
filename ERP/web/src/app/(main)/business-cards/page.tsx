"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star, Plus, UserPlus, X, Trash2, Contact, FileSpreadsheet, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from '@/app/(main)/customers/page.module.css'; // Reusing Customer styles
import BusinessCard from '@/components/business/BusinessCard';
import ViewModeSwitcher, { ViewMode } from '@/components/properties/ViewModeSwitcher';

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
    isFavorite?: boolean;
    createdAt?: string;
    updatedAt?: string;
    history?: any[];
}

export default function BusinessCardListPage() {
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
                const user = JSON.parse(userStr);
                if (user.companyName) {
                    query = `?company=${encodeURIComponent(user.companyName)}`;
                }
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

    // Excel Handler
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

            const userStr = localStorage.getItem('user');
            let userCompanyName = 'Unknown';
            let managerId = 'Unknown';
            if (userStr) {
                const user = JSON.parse(userStr);
                userCompanyName = user.companyName || 'Unknown';
                managerId = user.id || 'Unknown';
            }

            const formattedData = jsonData.map((row: any) => {
                // Combine Department and Position if both exist, or use logic
                const dept = (row['부서'] || '').toString().trim();
                const pos = (row['직함'] || '').toString().trim();
                let department = dept;
                if (pos) {
                    // Avoid duplication if they are same
                    if (dept !== pos) {
                        department = department ? `${dept} ${pos}` : pos;
                    }
                }

                // Handle Date (Excel Date Serial or String)
                // Priority: Excel Date Serial -> String Parsing (YYYY년 MM월 DD일) -> New Date
                let createdAt = new Date().toISOString();
                const rawDate = row['명함 등록일'];

                if (rawDate) {
                    if (typeof rawDate === 'number') {
                        // Excel date to JS date (UTC adjust)
                        const date = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
                        if (!isNaN(date.getTime())) createdAt = date.toISOString();
                    } else {
                        // String parsing
                        const str = String(rawDate).trim();
                        // Handle "YYYY년 MM월 DD일"
                        const koreanDateMatch = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
                        if (koreanDateMatch) {
                            const year = koreanDateMatch[1];
                            const month = koreanDateMatch[2].padStart(2, '0');
                            const day = koreanDateMatch[3].padStart(2, '0');
                            // Create UTC ISO date 'YYYY-MM-DDT00:00:00.000Z'
                            createdAt = `${year}-${month}-${day}T00:00:00.000Z`;
                        } else {
                            const d = new Date(str);
                            if (!isNaN(d.getTime())) createdAt = d.toISOString();
                        }
                    }
                }

                return {
                    name: row['이름'] || row['성명'] || row['Name'] || '무명',
                    companyName: row['회사'] || '',
                    department: department,
                    email: row['전자 메일 주소'] || '',
                    companyPhone1: row['근무처 전화'] || '',
                    fax: row['근무처 팩스'] || '',
                    companyAddress: row['근무지 주소 번지'] || '', // Map to companyAddress
                    memo: row['메모'] || '', // Explicitly map '메모' to memo
                    createdAt: createdAt,

                    // Default Fields
                    gender: 'M',
                    category: row['그룹'] || '기타', // Map '그룹' to category
                    mobile: row['휴대폰'] || row['핸드폰'] || '',
                    managerId: managerId,
                    userCompanyName: userCompanyName,
                    history: [],
                    promotedProperties: []
                };
            });

            if (formattedData.length === 0) {
                alert('업로드할 데이터가 없습니다.');
                return;
            }

            if (!confirm(`${formattedData.length}건의 명함을 업로드하시겠습니까?`)) {
                if (e.target) e.target.value = '';
                setLoading(false);
                return;
            }

            const res = await fetch('/api/business-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formattedData)
            });

            if (res.ok) {
                const result = await res.json();
                alert(`업로드 완료 (생성: ${result.created}, 수정: ${result.updated}, 건너뜀: ${result.skipped})`);
                fetchCards();
            } else {
                alert('업로드 실패');
            }
        } catch (error) {
            console.error(error);
            alert('파일 처리 중 오류가 발생했습니다.');
        } finally {
            if (e.target) e.target.value = '';
            setLoading(false);
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
        if (!confirm(`${selectedIds.length}개의 명함을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            for (const id of selectedIds) {
                await fetch(`/api/business-cards?id=${id}`, { method: 'DELETE' });
            }
            alert('삭제되었습니다.');
            setSelectedIds([]);
            fetchCards();
        } catch (e) {
            console.error(e);
            alert('오류 발생');
        } finally {
            setLoading(false);
        }
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
                    className={`${styles.title} ${showFavoritesOnly ? styles.activeFavorite : ''}`}
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

                    <div style={{ width: '1px', height: '20px', background: '#dee2e6', margin: '0 8px' }}></div>
                    <span>검색어 : </span>
                    <input
                        className={styles.searchInput}
                        placeholder="이름, 회사, 전화번호, 분류"
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
                        <col style={{ width: 100 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 90 }} />
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
                                <td onClick={(e) => { e.stopPropagation(); toggleFavorite(card.id, card.isFavorite); }} style={{ cursor: 'pointer', textAlign: 'center' }}>
                                    <Star size={16} color={card.isFavorite ? "#FAB005" : "#ced4da"} fill={card.isFavorite ? "#FAB005" : "none"} />
                                </td>
                                <td><span className={styles.classBadge} style={{ background: '#f1f3f5', color: '#495057' }}>{card.category}</span></td>
                                <td style={{ fontWeight: 'bold' }}>{card.name}</td>
                                <td>{card.companyName}</td>
                                <td>{card.department}</td>
                                <td>{card.mobile}</td>
                                <td>{card.companyPhone1}</td>
                                <td>{card.email}</td>
                                <td style={{ color: '#868e96' }}>{managers[card.managerId || ''] || card.managerId}</td>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                        <Contact size={14} />
                        신규명함
                    </button>

                    {/* Excel Upload Button */}
                    <input
                        type="file"
                        id="excel-upload"
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                        onChange={handleExcelUpload}
                    />
                    <label
                        htmlFor="excel-upload"
                        className={styles.footerBtn}
                        style={{ cursor: 'pointer', background: '#228be6', color: 'white', borderColor: '#228be6', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <FileSpreadsheet size={14} />
                        엑셀업로드
                    </label>
                </div>
            </div>

            {/* Modals */}
            {isCardOpen && viewMode === 'center' && (
                <div className={styles.modalOverlay} onClick={handleCloseCard}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <BusinessCard
                            id={selectedCardId}
                            onClose={handleCloseCard}
                            onSuccess={handleCardSuccess}
                            isModal={false}
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
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
