"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    X, Check, ChevronRight, Store, Building, Key, Briefcase,
    Search, User, MapPin, FileText, Loader2, Download
} from 'lucide-react';
import { CATEGORY_PRESETS, getPresetByCategory } from '@/lib/templates/presets';
import { ContractTemplate, ContractProject, ContractDocument } from '@/types/contract-core';
import PropertySelectorModal from '@/components/properties/PropertySelectorModal';
import PersonSelectorModal from '@/components/properties/PersonSelectorModal';
import { getAllTemplates } from '@/lib/templates/registry';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate?: () => void; // Callback for successful creation
}

// MOCK DATA FOR SEARCH
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

export default function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('사업체 양도양수');
    const [participants, setParticipants] = useState('');

    // Master Data State
    const [storeSearch, setStoreSearch] = useState('');
    const [selectedStore, setSelectedStore] = useState<any>(null);
    const [buyerSearch, setBuyerSearch] = useState('');
    const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
    const [sellerSearch, setSellerSearch] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<any>(null);

    // Derived State
    const preset = getPresetByCategory(selectedCategory);
    const [previewTemplates, setPreviewTemplates] = useState<ContractTemplate[]>([]);

    // DB Data State (Deprecated manual fetch, now using Modals)
    const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personModalTarget, setPersonModalTarget] = useState<'seller' | 'buyer'>('seller');

    // Model Selection Handlers
    const handlePropertySelect = (property: any) => {
        setSelectedStore(property);
        setStoreSearch(''); // Clear search input as we have selected
        setIsPropertyModalOpen(false);
    };

    const handlePersonSelect = (person: any, type: 'customer' | 'businessCard') => {
        if (personModalTarget === 'seller') {
            setSelectedSeller(person);
            setSellerSearch('');
        } else {
            setSelectedBuyer(person);
            setBuyerSearch('');
        }
        setIsPersonModalOpen(false);
    };



    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setStep(1);
            setTitle('');
            setSelectedCategory('사업체 양도양수');
            setParticipants('');
            setSelectedStore(null);
            setSelectedBuyer(null);
            setSelectedSeller(null);
        }
    }, [isOpen]);

    useEffect(() => {
        // Fetch templates from API and LocalStorage
        const loadTemplates = async () => {
            try {
                const { fetchCombinedTemplates } = await import('@/lib/templates/registry');
                const all = await fetchCombinedTemplates();

                if (preset) {
                    const found = preset.defaultTemplateIds
                        .map(id => all.find(t => t.id === id))
                        .filter(Boolean) as ContractTemplate[];
                    setPreviewTemplates(found);
                } else {
                    setPreviewTemplates([]);
                }
            } catch (e) {
                console.error("Failed to load templates", e);
            }
        };

        loadTemplates();
    }, [selectedCategory, preset, isOpen]); // Re-run when category changes or modal opens

    const handleCreate = async () => {
        setIsLoading(true);

        try {
            // 1. Prepare Master Data
            const commonData: any = {
                storeName: selectedStore?.name || '',
                storeAddress: selectedStore?.address || '',
                storeArea: selectedStore?.area || '',
                sellerName: selectedSeller?.name || '',
                sellerPhone: selectedSeller?.phone || selectedSeller?.mobile || '',
                buyerName: selectedBuyer?.name || '',
                buyerPhone: selectedBuyer?.phone || selectedBuyer?.mobile || '',
                contractDate: new Date().toISOString().split('T')[0],
            };

            // 2. Create Project Object
            const projectTitle = title || `${selectedCategory} 프로젝트`;

            const newProject: ContractProject = {
                id: projectId,
                title: projectTitle,
                status: 'draft',
                category: selectedCategory,
                participants: participants,
                documents: [],
                commonData: commonData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 3. Generate Documents Logic (Simplified for API usage)
            // Ideally backend handles document creation, but we will pass the preview templates to the API
            // and let the backend or a separate process handle it. 
            // For now, we'll stick to the current flow: Create Project ID -> Create Project in DB -> Navigate.
            // The /api/projects endpoint expects the full project object or initial data.

            const newProjectPayload = {
                title: projectTitle,
                status: 'draft',
                category: selectedCategory,
                participants: participants,
                common_data: commonData, // snake_case for DB if needed, but API usually handles mapping. Let's send camelCase and handle in API or send snake_case if API expects it.
                // The API we wrote uses: title, status, category, participants, data (which contains commonData and documents)
                data: {
                    commonData: commonData,
                    documents: [] as any[] // Documents will be added later or we can try to generate them here if possible.
                }
            };

            // IF we want to generate documents on creation (the mock/API logic above):
            // We should arguably move that logic to the server. 
            // But to keep it simple and consistent with the previous local logic:
            // We can create the project first, then add documents?
            // OR we can generate the document objects here and send them in the 'data' field.

            // Let's reuse the existing logic to generate 'createdContracts' array using the mock/API mix.
            // ... (keep the existing document generation logic but remove localStorage set) ...

            // RE-INSERTING DOCUMENT GENERATION LOGIC WITH MODIFICATIONS
            let createdContracts: any[] = [];

            if (previewTemplates.length > 0) {
                // Try Real API Creation
                try {
                    // We need a user ID for the templates API if we call it. 
                    // But for the PROJECT API, it infers user from session.

                    // Allow simple mock generation for now to ensure project creation works first.
                    // Real document generation requires more complex backend integration which might be out of scope for this 'structure' move.
                    // But we want to keep the "Preview" feature working.

                    for (const template of previewTemplates) {
                        createdContracts.push(createMockDocument(projectId, template));
                    }

                } catch (e) {
                    console.warn("Document generation error", e);
                }
            }

            newProjectPayload.data.documents = createdContracts;

            // API CALL
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProjectPayload)
            });

            if (!res.ok) {
                throw new Error('Project creation failed');
            }

            const { data: createdProject } = await res.json();
            // Use the ID returned from DB
            const finalProjectId = createdProject.id;


            // --- 5. SIDE EFFECTS (DB Integration) ---

            // A. Update Property History (if selected from DB)
            if (selectedStore && selectedStore.id && !selectedStore.id.startsWith('s')) {
                // Assumption: Mock IDs start with 's', Real IDs are timestamps or UUIDs
                // Since we selected from the modal (which fetches from DB), it should be real.

                // Fetch latest to be safe or just append
                const isReal = true; // Simplified check
                if (isReal) {
                    const newHistory = {
                        date: new Date().toISOString().split('T')[0],
                        content: `프로젝트 생성: ${projectTitle}`,
                        type: 'project' // Custom type
                    };
                    const updatedHistory = [...(selectedStore.history || []), newHistory];

                    try {
                        await fetch(`/api/properties?id=${selectedStore.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ history: updatedHistory })
                        });
                    } catch (err) {
                        console.error('Failed to update property history:', err);
                    }
                }
            }

            // B. Create Schedule Event
            let userId = 'unknown';
            let userCompanyName = '';
            let userCompanyId = ''; // New
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    userId = parsed.id;
                    userCompanyName = parsed.companyName || '';
                    userCompanyId = parsed.companyId || parsed.company_id || ''; // Try both cases
                }
            } catch (e) {
                console.error("User parse error", e);
            }

            const scheduleEvent = {
                title: `[계약] ${projectTitle}`,
                date: new Date().toISOString().split('T')[0],
                status: 'progress',
                type: 'work',
                color: '#7950f2', // Purple for Contract Project

                details: `프로젝트 생성됨 (${selectedStore?.name || '매물미지정'})`,
                companyName: selectedStore?.companyName || userCompanyName || '',
                companyId: userCompanyId || null, // Pass direct ID
                userId: userId,
                scope: 'work'
            };

            try {
                await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scheduleEvent)
                });
            } catch (err) {
                console.error('Failed to create schedule event:', err);
            }

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 800));
            if (onCreate) onCreate(); // Refresh parent list
            if (onCreate) onCreate(); // Refresh parent list
            router.push(`/contracts/project/${finalProjectId}`);
            onClose();

        } catch (e) {
            console.error(e);
            alert('프로젝트 생성 중 오류가 발생했습니다.');
            setIsLoading(false);
        }
    };

    // Helper for mock creation
    const createMockDocument = (projectId: string, tpl: any) => ({
        id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        projectId: projectId,
        templateId: tpl.id,
        name: tpl.name,
        formData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    if (!isOpen) return null;

    // --- RENDER HELPERS ---
    const renderStep1 = () => (
        <div style={styles.stepContainer}>
            <div style={styles.inputGroup}>
                <label style={styles.label}>프로젝트 명</label>
                <input
                    type="text"
                    style={styles.input}
                    placeholder="예: 잠실 주공 5단지 매매, 강남 이디야 양도양수"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                />
            </div>

            <div style={styles.inputGroup}>
                <label style={styles.label}>참석자 (공동대표, 대리인 등)</label>
                <input
                    type="text"
                    style={styles.input}
                    placeholder="참석자 이름을 입력하세요 (예: 홍길동, 김철수)"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                />
            </div>

            <div style={styles.inputGroup}>
                <label style={styles.label}>카테고리 선택</label>
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
                            <div style={styles.iconWrapper}>
                                {p.iconName === 'Store' && <Store size={24} />}
                                {p.iconName === 'Building' && <Building size={24} />}
                                {p.iconName === 'Key' && <Key size={24} />}
                                {p.iconName === 'Briefcase' && <Briefcase size={24} />}
                            </div>
                            <div style={styles.cardLabel}>{p.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* PREVIEW SECTION */}
            <div style={styles.previewBox}>
                <div style={styles.previewTitle}>
                    <Check size={16} /> 생성될 문서 목록 (자동)
                </div>
                {previewTemplates.length > 0 ? (
                    <div style={styles.previewList}>
                        {previewTemplates.map(t => (
                            <div key={t.id} style={styles.previewItem}>
                                <FileText size={14} color="#228be6" />
                                {t.name}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: '13px', color: '#868e96', padding: '10px' }}>
                        선택한 카테고리에 연결된 기본 문서가 없습니다.
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div style={styles.stepContainer}>
            <div style={styles.infoBox}>
                <p><strong>마스터 데이터 설정 (선택사항)</strong></p>
                <p style={{ fontSize: '13px', color: '#666' }}>
                    미리 아는 정보가 있다면 검색해서 선택해주세요.<br />
                    모든 계약서에 자동으로 내용이 채워집니다.
                </p>
            </div>

            {/* Store Search */}
            <div style={styles.inputGroup}>
                <label style={styles.label}>
                    매물(점포) 검색
                    <button onClick={() => setIsPropertyModalOpen(true)} style={styles.loadBtn}>
                        <Search size={12} /> 매물 목록에서 선택
                    </button>
                </label>
                {!selectedStore ? (
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            style={styles.searchInput}
                            placeholder="점포명 또는 주소 검색..."
                            value={storeSearch}
                            onChange={(e) => setStoreSearch(e.target.value)}
                        />
                        <Search size={16} style={styles.searchIcon} />
                        {storeSearch && (
                            <div style={styles.searchResults}>
                                {MOCK_STORES.filter(s => s.name.includes(storeSearch)).map(s => (
                                    <div key={s.id} style={styles.resultItem} onClick={() => { setSelectedStore(s); setStoreSearch(''); }}>
                                        <strong>{s.name}</strong>
                                        <div style={{ fontSize: '12px', color: '#868e96' }}>{s.address}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={styles.selectedItem}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Store size={14} /> {selectedStore.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{selectedStore.address}</div>
                        </div>
                        <button onClick={() => setSelectedStore(null)} style={styles.removeBtn}><X size={14} /></button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                {/* Seller Search */}
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>
                        양도인(매도인)
                        <button onClick={() => { setPersonModalTarget('seller'); setIsPersonModalOpen(true); }} style={styles.loadBtn}>
                            <User size={12} /> 고객 목록
                        </button>
                    </label>
                    {!selectedSeller ? (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                style={styles.searchInput}
                                placeholder="이름 검색..."
                                value={sellerSearch}
                                onChange={(e) => setSellerSearch(e.target.value)}
                            />
                            <Search size={16} style={styles.searchIcon} />
                            {sellerSearch && (
                                <div style={styles.searchResults}>
                                    {MOCK_CUSTOMERS.filter(c => c.name.includes(sellerSearch)).map(c => (
                                        <div key={c.id} style={styles.resultItem} onClick={() => { setSelectedSeller(c); setSellerSearch(''); }}>
                                            <strong>{c.name}</strong>
                                            <div style={{ fontSize: '12px', color: '#868e96' }}>{c.phone}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={styles.selectedItem}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={14} /> {selectedSeller.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{selectedSeller.phone || selectedSeller.mobile}</div>
                            </div>
                            <button onClick={() => setSelectedSeller(null)} style={styles.removeBtn}><X size={14} /></button>
                        </div>
                    )}
                </div>

                {/* Buyer Search */}
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>
                        양수인(매수인)
                        <button onClick={() => { setPersonModalTarget('buyer'); setIsPersonModalOpen(true); }} style={styles.loadBtn}>
                            <User size={12} /> 고객 목록
                        </button>
                    </label>
                    {!selectedBuyer ? (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                style={styles.searchInput}
                                placeholder="이름 검색..."
                                value={buyerSearch}
                                onChange={(e) => setBuyerSearch(e.target.value)}
                            />
                            <Search size={16} style={styles.searchIcon} />
                            {buyerSearch && (
                                <div style={styles.searchResults}>
                                    {MOCK_CUSTOMERS.filter(c => c.name.includes(buyerSearch)).map(c => (
                                        <div key={c.id} style={styles.resultItem} onClick={() => { setSelectedBuyer(c); setBuyerSearch(''); }}>
                                            <strong>{c.name}</strong>
                                            <div style={{ fontSize: '12px', color: '#868e96' }}>{c.phone}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={styles.selectedItem}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={14} /> {selectedBuyer.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{selectedBuyer.phone || selectedBuyer.mobile}</div>
                            </div>
                            <button onClick={() => setSelectedBuyer(null)} style={styles.removeBtn}><X size={14} /></button>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>새 프로젝트 생성</h2>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.body}>
                    <div style={styles.stepper}>
                        <div style={step === 1 ? styles.stepActive : styles.stepInactive}>1. 기본 설정</div>
                        <div style={styles.stepDivider}></div>
                        <div style={step === 2 ? styles.stepActive : styles.stepInactive}>2. 데이터 설정</div>
                    </div>

                    {step === 1 ? renderStep1() : renderStep2()}
                </div>

                <div style={styles.footer}>
                    {step === 2 ? (
                        <>
                            <button onClick={() => setStep(1)} style={styles.backBtn}>이전</button>
                            <button onClick={handleCreate} style={styles.createBtn} disabled={isLoading}>
                                {isLoading ? <><Loader2 size={16} className="spin" /> 생성 중...</> : '프로젝트 생성하기'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{ flex: 1 }}></div>
                            <button onClick={() => setStep(2)} style={styles.nextBtn}>
                                다음 (데이터 설정) <ChevronRight size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin { animation: spin 1s linear infinite; }
            `}</style>

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
                    companyName="" // Pass if needed for filtering
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

    // Stepper
    stepper: { display: 'flex', alignItems: 'center', marginBottom: '30px', padding: '0 10px' },
    stepActive: { fontWeight: 'bold', color: '#228be6', fontSize: '14px' },
    stepInactive: { color: '#adb5bd', fontSize: '14px' },
    stepDivider: { flex: 1, height: '1px', backgroundColor: '#e9ecef', margin: '0 15px' },

    // Form
    stepContainer: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
    inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
    label: { fontSize: '14px', fontWeight: 600, color: '#343a40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    loadBtn: { fontSize: '11px', padding: '2px 6px', color: '#228be6', border: '1px solid #228be6', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px', width: '100%' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' },

    // Card Selection
    card: { border: '1px solid #dee2e6', borderRadius: '8px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '10px', transition: 'all 0.2s', backgroundColor: 'white' },
    cardActive: { border: '1px solid #228be6', backgroundColor: '#e7f5ff', color: '#1864ab' },
    iconWrapper: { width: '40px', height: '40px', borderRadius: '20px', backgroundColor: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardLabel: { fontSize: '14px', fontWeight: 600 },

    // Preview
    previewBox: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px dashed #ced4da' },
    previewTitle: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#166534', marginBottom: '10px' },
    previewList: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    previewItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#495057' },

    // Buttons
    nextBtn: { backgroundColor: '#228be6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
    createBtn: { backgroundColor: '#12b886', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' },
    backBtn: { backgroundColor: 'white', border: '1px solid #dee2e6', color: '#495057', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },

    // Step 2 Styles
    infoBox: { padding: '15px', backgroundColor: '#e7f5ff', borderRadius: '6px', color: '#1c7ed6', fontSize: '14px', marginBottom: '10px' },
    searchInput: { padding: '10px 10px 10px 36px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px', width: '100%' },
    searchIcon: { position: 'absolute' as const, left: '12px', top: '12px', color: '#adb5bd' },
    searchResults: { position: 'absolute' as const, top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '6px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' as const },
    resultItem: { padding: '10px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer', fontSize: '14px' },
    selectedItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' },
    removeBtn: { border: 'none', background: 'none', cursor: 'pointer', color: '#adb5bd', padding: '4px' }
};
