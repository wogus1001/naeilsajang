"use client";

import React, { useState, useEffect } from 'react';
import {
    X, Check, ChevronRight, Store, Building, Key, Briefcase,
    Search, User, Loader2, Save, Trash2, Download
} from 'lucide-react';
import PropertySelectorModal from '@/components/properties/PropertySelectorModal';
import PersonSelectorModal from '@/components/properties/PersonSelectorModal';
import { CATEGORY_PRESETS, getPresetByCategory } from '@/lib/templates/presets';
import { ContractProject } from '@/types/contract-core';

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ContractProject;
    onUpdate: (updatedProject: ContractProject) => void;
    onDelete: () => void;
}

// MOCK DATA (Ideally shared or fetched)
const MOCK_STORES = [
    { id: 's1', name: '이디야커피 강남점', address: '서울시 강남구 테헤란로 123', area: '49.5㎡' },
    { id: 's2', name: '스타벅스 홍대입구점', address: '서울시 마포구 양화로 100', area: '120㎡' },
    { id: 's3', name: '파리바게트 잠실점', address: '서울시 송파구 올림픽로 200', area: '33㎡' },
];

const MOCK_CUSTOMERS = [
    { id: 'c1', name: '김매도', phone: '010-1111-2222' },
    { id: 'c2', name: '이매수', phone: '010-3333-4444' },
    { id: 'c3', name: '박중개', phone: '010-5555-6666' },
];

export default function EditProjectModal({ isOpen, onClose, project, onUpdate, onDelete }: EditProjectModalProps) {
    const [title, setTitle] = useState('');
    // Master Data State (Now using Modals)
    const [storeSearch, setStoreSearch] = useState('');
    const [selectedStore, setSelectedStore] = useState<any>(null); // Used for "Pending Overwrite" state

    // Modal State
    const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personModalTarget, setPersonModalTarget] = useState<'seller' | 'buyer'>('seller');

    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [participants, setParticipants] = useState('');

    // Manual Input State (for when search isn't used)
    const [commonData, setCommonData] = useState<any>({});

    useEffect(() => {
        if (isOpen && project) {
            setTitle(project.title);
            setSelectedCategory(project.category || '사업체 양도양수');
            setParticipants(project.participants || '');

            // Defaut Manager Logic
            const initialData = { ...(project.commonData || {}) };
            if (!initialData.managerName) {
                try {
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        initialData.managerName = user.name || '';
                        initialData.managerPhone = user.phone || user.mobile || '';
                    }
                } catch (e) { console.error(e); }
            }

            setCommonData(initialData);
        }
    }, [isOpen, project]);

    const handleSave = () => {
        const updatedCommonData = { ...commonData };

        // If a new store was selected via modal/search, overwrite relevant fields
        if (selectedStore) {
            updatedCommonData.storeName = selectedStore.name;
            updatedCommonData.storeAddress = selectedStore.address;
            updatedCommonData.storeArea = selectedStore.area;
        }
        // Note: Seller/Buyer are updated directly into commonData when selected from modal, 
        // unlike Store which we kept as a "pending" state in this UI design. 
        // But for consistency let's just use the direct update approach for all.

        const updatedProject: ContractProject = {
            ...project,
            title: title,
            category: selectedCategory,
            participants: participants,
            commonData: updatedCommonData,
            updatedAt: new Date().toISOString()
        };

        onUpdate(updatedProject);
        onClose();
    };

    const handleManualChange = (key: string, value: string) => {
        setCommonData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handlePropertySelect = (property: any) => {
        setSelectedStore(property);
        setIsPropertyModalOpen(false);
    };

    const handlePersonSelect = (person: any) => {
        if (personModalTarget === 'seller') {
            setCommonData((prev: any) => ({
                ...prev,
                sellerName: person.name,
                sellerPhone: person.phone || person.mobile
            }));
        } else {
            setCommonData((prev: any) => ({
                ...prev,
                buyerName: person.name,
                buyerPhone: person.phone || person.mobile
            }));
        }
        setIsPersonModalOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>프로젝트 정보 수정</h2>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.body}>
                    <div style={styles.sectionTitle}>기본 정보</div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>프로젝트 명</label>
                        <input
                            type="text"
                            style={styles.input}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>참석자 (공동대표, 대리인 등)</label>
                        <input
                            type="text"
                            style={styles.input}
                            placeholder="참석자 이름을 입력하세요"
                            value={participants}
                            onChange={(e) => setParticipants(e.target.value)}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>카테고리</label>
                        <div style={styles.grid}>
                            {CATEGORY_PRESETS.map((p) => (
                                <div
                                    key={p.categoryId}
                                    style={{
                                        ...styles.card,
                                        ...(selectedCategory === p.label ? styles.cardActive : {})
                                    }}
                                    onClick={() => setSelectedCategory(p.label)}
                                >
                                    <div style={styles.cardLabel}>{p.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.divider}></div>

                    <div style={styles.sectionTitle}>마스터 데이터 (일괄 적용)</div>
                    <p style={styles.helperText}>
                        여기서 정보를 수정하면 모든 문서의 해당 내용이 자동으로 업데이트됩니다.<br />
                        (단, 각 문서에서 개별적으로 수정한 내용은 유지될 수 있습니다)
                    </p>

                    {/* Store */}
                    <div style={styles.groupContainer}>
                        <div style={styles.subLabel}><Store size={14} /> 매물(점포) 정보</div>
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.miniLabel}>상호명</label>
                                <input style={styles.input} value={commonData.storeName || ''} onChange={(e) => handleManualChange('storeName', e.target.value)} />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={styles.miniLabel}>소재지</label>
                                <input style={styles.input} value={commonData.storeAddress || ''} onChange={(e) => handleManualChange('storeAddress', e.target.value)} />
                            </div>
                        </div>
                        {/* Search Overlay/Toggle could go here, but keeping simple: Manual Edit + Search Overwrite */}
                        {/* Search Overlay/Toggle */}
                        {!selectedStore && (
                            <div style={styles.searchRow}>
                                <button onClick={() => setIsPropertyModalOpen(true)} style={styles.loadBtn}>
                                    <Download size={12} /> DB에서 매물 가져오기
                                </button>
                            </div>
                        )}
                        {selectedStore && (
                            <div style={styles.selectedBadge}>
                                <Check size={12} /> "{selectedStore.name}" 정보로 덮어쓸 예정
                                <X size={12} style={{ cursor: 'pointer', marginLeft: 'auto' }} onClick={() => setSelectedStore(null)} />
                            </div>
                        )}
                    </div>

                    {/* People */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                        <div style={{ flex: 1, ...styles.groupContainer, marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={styles.subLabelNoMargin}><User size={14} /> 양도인 (매도)</div>
                                <button onClick={() => { setPersonModalTarget('seller'); setIsPersonModalOpen(true); }} style={styles.miniLoadBtn}>
                                    <Search size={10} /> 찾기
                                </button>
                            </div>
                            <label style={styles.miniLabel}>성명</label>
                            <input style={styles.input} value={commonData.sellerName || ''} onChange={(e) => handleManualChange('sellerName', e.target.value)} />
                            <label style={styles.miniLabel}>연락처</label>
                            <input style={styles.input} value={commonData.sellerPhone || ''} onChange={(e) => handleManualChange('sellerPhone', e.target.value)} />
                        </div>
                        <div style={{ flex: 1, ...styles.groupContainer, marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={styles.subLabelNoMargin}><User size={14} /> 양수인 (매수)</div>
                                <button onClick={() => { setPersonModalTarget('buyer'); setIsPersonModalOpen(true); }} style={styles.miniLoadBtn}>
                                    <Search size={10} /> 찾기
                                </button>
                            </div>
                            <label style={styles.miniLabel}>성명</label>
                            <input style={styles.input} value={commonData.buyerName || ''} onChange={(e) => handleManualChange('buyerName', e.target.value)} />
                            <label style={styles.miniLabel}>연락처</label>
                            <input style={styles.input} value={commonData.buyerPhone || ''} onChange={(e) => handleManualChange('buyerPhone', e.target.value)} />
                        </div>
                    </div>

                    {/* Manager */}
                    <div style={styles.groupContainer}>
                        <div style={styles.subLabel}><Briefcase size={14} /> 담당자 (중개사)</div>
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.miniLabel}>성명</label>
                                <input style={styles.input} value={commonData.managerName || ''} onChange={(e) => handleManualChange('managerName', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={styles.miniLabel}>연락처</label>
                                <input style={styles.input} value={commonData.managerPhone || ''} onChange={(e) => handleManualChange('managerPhone', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.footer}>
                    <button onClick={() => {
                        if (confirm('정말로 이 프로젝트를 삭제하시겠습니까? 복구할 수 없습니다.')) {
                            onDelete();
                        }
                    }} style={styles.deleteBtn}>
                        <Trash2 size={16} /> 프로젝트 삭제
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onClose} style={styles.backBtn}>취소</button>
                        <button onClick={handleSave} style={styles.saveBtn}>
                            <Save size={16} /> 변경사항 저장
                        </button>
                    </div>
                </div>
            </div>
            {/* SELECTOR MODALS */}
            {isPropertyModalOpen && (
                <PropertySelectorModal
                    isOpen={isPropertyModalOpen}
                    onClose={() => setIsPropertyModalOpen(false)}
                    onSelect={handlePropertySelect}
                />
            )}

            {isPersonModalOpen && (
                <PersonSelectorModal
                    isOpen={isPersonModalOpen}
                    onClose={() => setIsPersonModalOpen(false)}
                    onSelect={handlePersonSelect}
                    companyName=""
                />
            )}
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: 'white', width: '600px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, maxHeight: '90vh' },
    header: { padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: '18px', fontWeight: 'bold', margin: 0 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },
    body: { padding: '24px', overflowY: 'auto' as const, flex: 1 },
    footer: { padding: '16px 24px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: '10px' },

    sectionTitle: { fontSize: '15px', fontWeight: 700, color: '#343a40', marginBottom: '15px' },
    divider: { height: '1px', backgroundColor: '#e9ecef', margin: '20px 0' },
    helperText: { fontSize: '13px', color: '#868e96', marginBottom: '20px', lineHeight: '1.5' },

    inputGroup: { marginBottom: '15px' },
    label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#495057', marginBottom: '6px' },
    input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const, marginBottom: '8px' },

    groupContainer: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' },
    subLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: '#1c7ed6' },
    miniLabel: { fontSize: '12px', color: '#868e96', marginBottom: '4px', display: 'block' },
    row: { display: 'flex', gap: '10px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
    card: { border: '1px solid #dee2e6', borderRadius: '8px', padding: '10px', cursor: 'pointer', textAlign: 'center' as const, fontSize: '13px', backgroundColor: 'white' },
    cardActive: { border: '1px solid #228be6', backgroundColor: '#e7f5ff', color: '#1864ab', fontWeight: 600 },

    searchRow: { position: 'relative' as const, marginTop: '10px' },
    searchInput: { width: '100%', padding: '8px', fontSize: '12px', border: '1px dashed #adb5bd', borderRadius: '4px' },
    searchResults: { position: 'absolute' as const, top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '4px', marginTop: '2px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' as const },
    resultItem: { padding: '8px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f5' },
    selectedBadge: { marginTop: '8px', padding: '8px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' },

    subLabelNoMargin: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', color: '#1c7ed6' },
    loadBtn: { fontSize: '12px', padding: '6px 10px', color: '#228be6', border: '1px solid #228be6', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' },
    miniLoadBtn: { fontSize: '11px', padding: '2px 6px', color: '#495057', border: '1px solid #dee2e6', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },

    saveBtn: { backgroundColor: '#12b886', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' },
    backBtn: { backgroundColor: 'white', border: '1px solid #dee2e6', color: '#495057', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
    deleteBtn: { backgroundColor: '#fff5f5', color: '#fa5252', border: '1px solid #ffc9c9', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
};
