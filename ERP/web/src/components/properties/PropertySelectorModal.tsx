import React, { useState, useEffect } from 'react';
import { X, Search, Check, RefreshCw } from 'lucide-react';
import styles from './PropertySelectorModal.module.css';
import PropertyCard from './PropertyCard';
import { AlertModal } from '@/components/common/AlertModal';

interface PropertySelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (property: any) => void;
}

export default function PropertySelectorModal({ isOpen, onClose, onSelect }: PropertySelectorModalProps) {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPropertyId, setViewPropertyId] = useState<string | null>(null); // For double-click popup

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info'; onClose?: () => void }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
        setAlertConfig({ isOpen: true, message, type, onClose });
    };

    const closeAlert = () => {
        if (alertConfig.onClose) alertConfig.onClose();
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    useEffect(() => {
        if (isOpen) {
            fetchProperties();
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
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = () => {
        if (selectedId) {
            const selected = properties.find(p => p.id === selectedId);
            if (selected) {
                onSelect(selected);
                onClose();
            }
        } else {
            showAlert('물건을 선택해주세요.', 'error');
        }
    };

    if (!isOpen) return null;

    // Filter properties
    const filteredProperties = properties.filter(p =>
        p.name?.includes(searchTerm) || p.address?.includes(searchTerm) || p.type?.includes(searchTerm)
    );

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.title}>점포물건 선택</span>
                    <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
                </div>

                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <div className={styles.searchGroup}>
                        <span className={styles.label}>검색</span>
                        <input
                            className={styles.searchInput}
                            placeholder="지역/물건명..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button className={styles.btnSearch}><Search size={14} /> 검색</button>
                        <button className={styles.btnReset} onClick={() => { setSearchTerm(''); fetchProperties(); }}>
                            <RefreshCw size={14} /> 검색초기화
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>No</th>
                                <th style={{ width: 60 }}>물건등급</th>
                                <th>물건명</th>
                                <th style={{ width: 80 }}>업종</th>
                                <th>주소</th>
                                <th style={{ width: 80 }}>권리금</th>
                                <th style={{ width: 80 }}>임대료</th>
                                <th style={{ width: 80 }}>보증금</th>
                                <th style={{ width: 80 }}>합계</th>
                                <th style={{ width: 80 }}>월순익</th>
                                <th style={{ width: 60 }}>실면적</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 20 }}>로딩중...</td></tr>
                            ) : filteredProperties.length === 0 ? (
                                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 20 }}>검색된 물건이 없습니다.</td></tr>
                            ) : (
                                filteredProperties.map((p, i) => (
                                    <tr
                                        key={p.id}
                                        className={selectedId === p.id ? styles.selectedRow : ''}
                                        onClick={() => setSelectedId(p.id)}
                                        onDoubleClick={() => setViewPropertyId(p.id)}
                                    >
                                        <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={styles.statusBadge} data-status={p.status}>
                                                {p.status === 'progress' ? '추진' :
                                                    p.status === 'manage' ? '관리' :
                                                        p.status === 'hold' ? '보류' :
                                                            p.status === 'joint' ? '공동' : '완료'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                                        <td style={{ textAlign: 'center', color: '#4c6ef5' }}>{p.industrySector || p.type || '-'}</td>
                                        <td className={styles.addressCell} title={p.address}>{p.address}</td>
                                        <td style={{ textAlign: 'right' }}>{p.premium ? Number(p.premium).toLocaleString() : '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{p.monthlyRent ? Number(p.monthlyRent).toLocaleString() : '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{p.deposit ? Number(p.deposit).toLocaleString() : '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{(Number(p.premium || 0) + Number(p.deposit || 0)).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>-</td>
                                        <td style={{ textAlign: 'center' }}>{p.area}평</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.footerLeft}>
                        <span style={{ fontSize: 12, color: '#228BE6' }}>(총 : {filteredProperties.length} 건)</span>
                        <span style={{ fontSize: 12, color: '#e03131', marginLeft: 12 }}>* 최대 500건만 표시됩니다. 검색어를 활용하세요.</span>
                    </div>
                    <div className={styles.footerRight}>
                        <button className={styles.btnSelect} onClick={handleSelect}>
                            <Check size={14} /> 선택
                        </button>
                        <button className={styles.btnClose} onClick={onClose}>
                            <X size={14} /> 창 닫기
                        </button>
                    </div>
                </div>
            </div>

            {/* Property Card Popup */}
            {viewPropertyId && (
                <div className={styles.cardOverlay}>
                    <div className={styles.cardModal}>
                        <PropertyCard
                            property={properties.find(p => p.id === viewPropertyId)}
                            onClose={() => setViewPropertyId(null)}
                            onRefresh={fetchProperties}
                        />
                    </div>
                </div>
            )}
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                type={alertConfig.type}
            />
        </div>
    );
};
