"use client";

import React, { useState, useEffect } from 'react';
import { Search, X, RotateCcw, Save, Store } from 'lucide-react';
import styles from '@/app/(main)/customers/register/page.module.css';

interface Property {
    id: string;
    name: string;
    // Map to actual DB fields
    type?: string;
    industrySector?: string; // 업종 (소분류)
    address: string;
    price: string;
    area: string;
    rent?: string;
    monthlyRent?: number; // 임대료 (Changed to monthlyRent)
    deposit: string;
    floor: string;
    totalPrice?: string; // 권리금+보증금
    premium?: string; // 권리금
    monthlyIncome?: string;
    monthlyProfit?: number; // 월순익 (Changed to monthlyProfit)
    realArea?: string;
    memo?: string;
}

interface PropertySelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (properties: Property[]) => void;
    onOpenCard: (id: string) => void;
}

export default function PropertySelector({ isOpen, onClose, onSelect, onOpenCard }: PropertySelectorProps) {
    const [properties, setProperties] = useState<Property[]>([]);
    const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Resize Logic
    const [nameColWidth, setNameColWidth] = useState(140);
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = React.useRef(0);
    const startWidthRef = React.useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startXRef.current = e.clientX;
        startWidthRef.current = nameColWidth;
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startXRef.current;
            setNameColWidth(Math.max(50, startWidthRef.current + diff));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isResizing]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [region, setRegion] = useState('');
    const [areaMin, setAreaMin] = useState('');
    const [areaMax, setAreaMax] = useState('');
    const [floorMin, setFloorMin] = useState('');
    const [floorMax, setFloorMax] = useState('');
    const [rentMin, setRentMin] = useState('');
    const [rentMax, setRentMax] = useState('');
    const [depositMin, setDepositMin] = useState('');
    const [depositMax, setDepositMax] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchProperties();
            setSelectedIds([]); // Reset selection on open
        }
    }, [isOpen]);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const userStr = localStorage.getItem('user');
            let query = '';
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.companyName) {
                    query = `?company=${encodeURIComponent(user.companyName)}`;
                }
            }

            const res = await fetch(`/api/properties${query}`);
            if (res.ok) {
                const data = await res.json();
                setProperties(data);
                setFilteredProperties(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    useEffect(() => {
        let result = properties;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.address && p.address.toLowerCase().includes(term)) ||
                (p.industrySector && p.industrySector.toLowerCase().includes(term)) ||
                (p.type && p.type.toLowerCase().includes(term))
            );
        }

        if (region) {
            result = result.filter(p => p.address && p.address.includes(region));
        }

        if (areaMin) result = result.filter(p => parseFloat(p.area) >= parseFloat(areaMin));
        if (areaMax) result = result.filter(p => parseFloat(p.area) <= parseFloat(areaMax));

        if (floorMin) result = result.filter(p => parseFloat(p.floor) >= parseFloat(floorMin));
        if (floorMax) result = result.filter(p => parseFloat(p.floor) <= parseFloat(floorMax));

        const cleanPrice = (val: string | number | undefined) => (val ? parseFloat(String(val).replace(/,/g, '')) : 0);

        if (rentMin) result = result.filter(p => cleanPrice(p.monthlyRent || p.rent) >= cleanPrice(rentMin));
        if (rentMax) result = result.filter(p => cleanPrice(p.monthlyRent || p.rent) <= cleanPrice(rentMax));

        if (depositMin) result = result.filter(p => cleanPrice(p.deposit) >= cleanPrice(depositMin));
        if (depositMax) result = result.filter(p => cleanPrice(p.deposit) <= cleanPrice(depositMax));

        setFilteredProperties(result);
    }, [searchTerm, region, areaMin, areaMax, floorMin, floorMax, rentMin, rentMax, depositMin, depositMax, properties]);

    const handleReset = () => {
        setSearchTerm('');
        setRegion('');
        setAreaMin(''); setAreaMax('');
        setFloorMin(''); setFloorMax('');
        setRentMin(''); setRentMax('');
        setDepositMin(''); setDepositMax('');
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        const selected = properties.filter(p => selectedIds.includes(p.id));
        onSelect(selected);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose} style={{ zIndex: 3000 }}>
            <div className={`${styles.modalContent} ${styles.propertySelectorModal}`} style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }} onClick={e => e.stopPropagation()}>

                {/* Modal Header */}
                <div className={styles.header} style={{ flexShrink: 0 }}>
                    <div className={styles.title}>점포물건</div>
                </div>

                {/* Filters */}
                {/* Filters */}
                <div className={styles.filterWrapper} style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

                    {/* Top: Filters Grid */}
                    <div className={styles.filtersGrid} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                        <div className={styles.filterItem} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 'bold', color: '#495057' }}>지역:</span>
                            <input className={styles.input} style={{ width: 100 }} value={region} onChange={e => setRegion(e.target.value)} placeholder="지역명" />
                        </div>

                        <div className={styles.filterItem} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 'bold', color: '#495057' }}>면적:</span>
                            <input className={styles.input} style={{ width: 50 }} value={areaMin} onChange={e => setAreaMin(e.target.value)} />
                            <span>~</span>
                            <input className={styles.input} style={{ width: 50 }} value={areaMax} onChange={e => setAreaMax(e.target.value)} />
                            <span className={styles.unitText}>평</span>
                        </div>

                        <div className={styles.filterItem} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 'bold', color: '#495057' }}>층수:</span>
                            <input className={styles.input} style={{ width: 40 }} value={floorMin} onChange={e => setFloorMin(e.target.value)} />
                            <span>~</span>
                            <input className={styles.input} style={{ width: 40 }} value={floorMax} onChange={e => setFloorMax(e.target.value)} />
                            <span className={styles.unitText}>층</span>
                        </div>

                        <div className={styles.filterItem} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 'bold', color: '#495057' }}>임대료:</span>
                            <input className={styles.input} style={{ width: 60 }} value={rentMin} onChange={e => setRentMin(e.target.value)} />
                            <span>~</span>
                            <input className={styles.input} style={{ width: 60 }} value={rentMax} onChange={e => setRentMax(e.target.value)} />
                            <span className={styles.unitText}>만</span>
                        </div>

                        <div className={styles.filterItem} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 'bold', color: '#495057' }}>보증금:</span>
                            <input className={styles.input} style={{ width: 60 }} value={depositMin} onChange={e => setDepositMin(e.target.value)} />
                            <span>~</span>
                            <input className={styles.input} style={{ width: 60 }} value={depositMax} onChange={e => setDepositMax(e.target.value)} />
                            <span className={styles.unitText}>만</span>
                        </div>
                    </div>

                    {/* Bottom: Search Bar (Full Width on Mobile) */}
                    <div className={styles.searchBarContainer} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px dashed #e9ecef' }}>
                        <div className={styles.inputWrapper} style={{ width: 200, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Search size={14} color="#868e96" />
                            <input
                                className={styles.input}
                                style={{ border: 'none', width: '100%' }}
                                placeholder="통합 검색"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className={styles.footerBtn} onClick={handleReset}>
                            <RotateCcw size={14} /> 초기화
                        </button>
                    </div>
                </div>

                {/* Content - Table */}
                <div style={{ flex: 1, overflow: 'hidden', padding: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
                    <div className={styles.tableContainer} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                        <table className={styles.historyTable} style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: 50 }} />
                                <col style={{ width: 50 }} />
                                <col style={{ width: nameColWidth }} />
                                <col style={{ width: 80 }} />
                                <col />
                                <col style={{ width: 90 }} />
                                <col style={{ width: 90 }} />
                                <col style={{ width: 90 }} />
                                <col style={{ width: 90 }} />
                                <col style={{ width: 90 }} />
                                <col style={{ width: 70 }} />
                                <col style={{ width: 60 }} />
                            </colgroup>
                            <thead style={{ position: 'sticky', top: 0, background: '#f1f3f5', zIndex: 1 }}>
                                <tr>
                                    <th>No</th>
                                    <th>선택</th>
                                    <th style={{ position: 'relative' }}>
                                        물건명
                                        <div
                                            onMouseDown={handleMouseDown}
                                            style={{
                                                position: 'absolute',
                                                right: -5,
                                                top: 0,
                                                bottom: 0,
                                                width: 10,
                                                cursor: 'col-resize',
                                                zIndex: 10,
                                                userSelect: 'none'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </th>
                                    <th>업종</th>
                                    <th>주소</th>
                                    <th>권리금</th>
                                    <th>임대료</th>
                                    <th>보증금</th>
                                    <th>합계</th>
                                    <th>월순익</th>
                                    <th>실면적</th>
                                    <th>정보</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center' }}>로딩중...</td></tr>
                                ) : filteredProperties.length === 0 ? (
                                    <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center' }}>검색된 물건이 없습니다.</td></tr>
                                ) : (
                                    filteredProperties.map((p, i) => (
                                        <tr
                                            key={p.id}
                                            className={styles.tr}
                                            onClick={() => toggleSelect(p.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td style={{ textAlign: 'center' }}>{filteredProperties.length - i}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(p.id)}
                                                    onChange={() => { }}
                                                    style={{ width: 16, height: 16, cursor: 'pointer', pointerEvents: 'none' }}
                                                />
                                            </td>
                                            <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#228BE6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                                            <td style={{ textAlign: 'center' }}>{p.industrySector || p.type}</td>
                                            <td style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</td>
                                            <td style={{ textAlign: 'right' }}>{p.premium ? Number(p.premium).toLocaleString() : 0}</td>
                                            <td style={{ textAlign: 'right' }}>{p.monthlyRent ? Number(p.monthlyRent).toLocaleString() : (p.rent || 0)}</td>
                                            <td style={{ textAlign: 'right' }}>{p.deposit ? Number(p.deposit).toLocaleString() : 0}</td>
                                            <td style={{ textAlign: 'right' }}>{p.totalPrice || ((parseInt(p.premium || '0')) + (parseInt(p.deposit || '0'))).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right' }}>{p.monthlyProfit ? Number(p.monthlyProfit).toLocaleString() : (p.monthlyIncome || 0)}</td>
                                            <td style={{ textAlign: 'center' }}>{p.realArea || p.area}평</td>
                                            <td style={{ textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); onOpenCard(p.id); }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#495057' }}>
                                                    <Store size={16} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#f8f9fa', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: '#1971c2', fontWeight: 'bold', marginRight: 'auto' }}>
                        (총 : {filteredProperties.length} 건)
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.footerBtn} onClick={handleConfirm}>
                            <Save size={14} /> 저장
                        </button>
                        <button className={styles.footerBtn} onClick={onClose}>
                            <X size={14} /> 닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
