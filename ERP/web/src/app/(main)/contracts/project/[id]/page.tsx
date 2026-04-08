"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    Download, Printer, Save, FileText, CheckCircle,
    ChevronRight, ChevronDown, Plus, Layout, Trash2, RotateCcw,
    Settings, PenTool, ChevronLeft, ArrowLeft, ChevronUp, ArrowUp, ArrowDown, GripVertical
} from 'lucide-react';
import { ContractProject, ContractDocument, ContractTemplate, FormField } from '@/types/contract-core';
import { getTemplateById, getAllTemplates } from '@/lib/templates/registry';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import EditProjectModal from '../../_components/EditProjectModal';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import styles from './page.module.css';

const STATUS_OPTIONS = [
    { value: 'draft', label: '진행예정', color: '#868e96', bg: '#f8f9fa' },
    { value: 'active', label: '진행중', color: '#1c7ed6', bg: '#e7f5ff' },
    { value: 'completed', label: '완료', color: '#166534', bg: '#dcfce7' },
];

const PAGE_DELIMITER = '<!-- GENUINE_PAGE_BREAK -->';

// --- MOCK DATA (Task 1: Project Model Usage) ---
const MOCK_PROJECT: ContractProject = {
    id: 'p-001',
    title: '강남 이디야 양도양수 건',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commonData: {
        sellerName: '김매도',
        sellerPhone: '010-1111-2222',
        buyerName: '이매수',
        buyerPhone: '010-3333-4444',
        storeName: '이디야커피 강남점',
        storeAddress: '서울시 강남구 테헤란로 123',
        storeArea: '49.5㎡',
        totalPrice: 150000000, // 1.5억
    },
    documents: [
        { id: 'd-1', projectId: 'p-001', templateId: 't-transfer-agreement', name: '사업체 양도양수 계약서', formData: {}, createdAt: '', updatedAt: '' },
        { id: 'd-2', projectId: 'p-001', templateId: 't-receipt-agreement', name: '계약금 영수증', formData: { purpose: '계약금' }, createdAt: '', updatedAt: '' },
        { id: 'd-3', projectId: 'p-001', templateId: 't-object-confirm', name: '대상물 확인서', formData: {}, createdAt: '', updatedAt: '' },
    ]
};

function ProjectEditor() {
    const params = useParams(); // params.id (projectId)
    const router = useRouter();
    const searchParams = useSearchParams();
    const newDocTemplateId = searchParams.get('newDoc');

    // STATE
    const [project, setProject] = useState<ContractProject>(MOCK_PROJECT);
    const [activeDocId, setActiveDocId] = useState<string>(MOCK_PROJECT.documents[0]?.id);
    const [activeCategory, setActiveCategory] = useState<string>('사업체 양도양수');
    const [showAddDocModal, setShowAddDocModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalCategory, setModalCategory] = useState<string>('사업체 양도양수');
    const [currentPage, setCurrentPage] = useState(0);
    const [mobileTab, setMobileTab] = useState<'docs' | 'form' | 'preview'>('docs');
    const [isReordering, setIsReordering] = useState(false); // 순서 변경 모드 상태
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle'); // 자동저장 상태 표시
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // 자동저장 타이머 ref

    // Alert & Confirm State
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', title: '' });
    const showAlert = (message: string, title?: string) => {
        setAlertConfig({ isOpen: true, message, title: title || '알림' });
    };
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        isDanger: false
    });
    const showConfirm = (message: string, onConfirm: () => void, isDanger: boolean = false) => {
        setConfirmModal({ isOpen: true, message, onConfirm, isDanger });
    };

    // Reset pagination on doc change
    useEffect(() => {
        setCurrentPage(0);
    }, [activeDocId]);

    // LOAD TEMPLATES DYNAMICALLY
    const [allTemplates, setAllTemplates] = useState<ContractTemplate[]>([]);
    const [categories, setCategories] = useState<string[]>(['사업체 양도양수', '부동산 계약']);
    const [isLoaded, setIsLoaded] = useState(false);

    const loadTemplatesAsync = async () => {
        const { fetchCombinedTemplates } = await import('@/lib/templates/registry');
        const loadedTemplates = await fetchCombinedTemplates();
        setAllTemplates(loadedTemplates);

        const cats = Array.from(new Set(loadedTemplates.map(t => t.category)));
        if (cats.length === 0) cats.push('사업체 양도양수');
        setCategories(cats);
        // Don't auto-reset category if already set, unless invalid?
        // setModalCategory(cats[0]); // Initial set
    };

    useEffect(() => {
        // 1. Load Templates
        loadTemplatesAsync();

        // 2. Load Project Data from API
        const loadProject = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                const uid = storedUser ? JSON.parse(storedUser).id : null;
                const userIdQuery = uid ? `?userId=${uid}` : '';

                const res = await fetch(`/api/projects/${params.id}${userIdQuery}`);
                if (!res.ok) throw new Error('Failed to fetch project');
                const projectData = await res.json();

                // Map API data to Frontend Model if needed
                // API returns { id, title, status, category, participants, data: { commonData, documents } }
                // Frontend Model: { id, title, status, category, commonData, documents, ... }

                // If the API returns the flat structure or nested?
                // The API GET /api/projects/[id] returns the row.
                // Row has `data` column which contains the JSON content.
                // We need to merge them.

                const mappedProject: ContractProject = {
                    id: projectData.id,
                    title: projectData.title,
                    status: projectData.status,
                    category: projectData.category,
                    participants: projectData.participants,
                    createdAt: projectData.created_at,
                    updatedAt: projectData.updated_at,
                    commonData: projectData.data?.commonData || {},
                    documents: projectData.data?.documents || []
                };

                setProject(mappedProject);

                // Also restore active doc if possible
                if (mappedProject.documents.length > 0) {
                    setActiveDocId(mappedProject.documents[mappedProject.documents.length - 1].id);
                }
            } catch (e) {
                console.error("Failed to load project", e);
                // Fallback or Alert?
                // alert('프로젝트를 불러오는데 실패했습니다.');
            } finally {
                setIsLoaded(true);
            }
        };

        if (params.id) {
            loadProject();
        }
    }, [params.id]);

    // AUTO-ADD NEWLY CREATED TEMPLATE Logic
    useEffect(() => {
        if (newDocTemplateId) {
            // Force refresh templates
            const run = async () => {
                const { fetchCombinedTemplates } = await import('@/lib/templates/registry');
                const loadedTemplates = await fetchCombinedTemplates();
                setAllTemplates(loadedTemplates);

                const template = loadedTemplates.find(t => t.id === newDocTemplateId);
                if (template) {
                    handleAddDocument(template);
                    // Clear the query param
                    router.replace(`/contracts/project/${params.id}`);
                }
            };
            run();
        }
    }, [newDocTemplateId, params.id, router]);

    // AUTO-SAVE PROJECT (Persistence) - API Version
    useEffect(() => {
        // Debounce save or just save on change?
        // For API, we should probably debounce or save on explicit actions + auto-save every X seconds?
        // For simplicity and user request, let's keep it simple. But relying on useEffect for API calls on every keystroke is bad.
        // The user didn't explicitly ask for real-time collab, just "sharing".
        // Use a debounce here.

        if (!isLoaded || !project.id) return;

        const timer = setTimeout(async () => {
            // Prepare payload
            // We need to structure it back to what API expects: { title, status, ... data: { commonData, documents } }
            // Actually API PUT allows partial updates? No, it usually updates the whole row or specific fields.
            // Our PUT /api/projects/[id] updates: title, status, category, participants, data.

            const payload = {
                title: project.title,
                status: project.status,
                category: project.category || '기타',
                participants: project.participants,
                data: {
                    commonData: project.commonData,
                    documents: project.documents
                }
            };

            try {
                // We add Authorization header via middleware/browser? No, server component or client?
                // Client fetch usually sends cookies if credentials: include?
                // Supabase helpers usually handle it. 
                // But our API endpoint checks `supabase.auth.getUser()`.
                // Let's assume the session cookie is adequate.

                const storedUser = localStorage.getItem('user');
                const uid = storedUser ? JSON.parse(storedUser).id : null;
                const userIdQuery = uid ? `?userId=${uid}` : '';

                await fetch(`/api/projects/${project.id}${userIdQuery}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                setAutoSaveStatus('saved'); // 저장 완료 표시
                // 2초 후 표시 숨기기
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            } catch (err) {
                console.error('Auto-save failed', err);
                setAutoSaveStatus('idle');
            }
        }, 2000); // 2초 디바운스

        setAutoSaveStatus('saving'); // 저장 중 표시
        return () => clearTimeout(timer);
    }, [project, isLoaded]);

    // DERIVED STATE
    const activeDoc = useMemo(() => project.documents.find(d => d.id === activeDocId), [project, activeDocId]);
    const activeTemplate = useMemo(() => activeDoc ? allTemplates.find(t => t.id === activeDoc.templateId) : null, [activeDoc, allTemplates]);

    // 숫자를 한글 금액으로 변환하는 함수
    // 예: 321000000 → '금 삼억이천일백만원'
    const numberToKorean = useCallback((num: number): string => {
        if (!num || isNaN(num) || num === 0) return '';
        const units = ['', '만', '억', '조', '경'];
        const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
        const tens = ['', '십', '백', '천'];

        let result = '';
        let remaining = Math.abs(Math.floor(num));
        let unitIdx = 0;

        while (remaining > 0) {
            const chunk = remaining % 10000;
            if (chunk > 0) {
                let chunkStr = '';
                const d = [Math.floor(chunk / 1000), Math.floor((chunk % 1000) / 100), Math.floor((chunk % 100) / 10), chunk % 10];
                d.forEach((v, i) => {
                    if (v > 0) {
                        // '일십', '일백', '일천'은 '십', '백', '천'으로 (일억, 일만은 포함)
                        chunkStr += (v === 1 && i > 0 ? '' : digits[v]) + tens[3 - i];
                    }
                });
                result = chunkStr + units[unitIdx] + result;
            }
            remaining = Math.floor(remaining / 10000);
            unitIdx++;
        }

        return `금 ${result}원`;
    }, []);

    const effectiveData = useMemo(() => {
        if (!activeDoc) return {};
        const merged = { ...project.commonData, ...activeDoc.formData };
        const formatted: Record<string, any> = { ...merged };
        Object.keys(merged).forEach(key => {
            if (typeof merged[key] === 'number') {
                formatted[`${key}_fmt`] = new Intl.NumberFormat('ko-KR').format(merged[key] as number);
                formatted[`${key}_한글`] = numberToKorean(merged[key] as number);
            }
        });

        // currency/number 타입 문자열 필드도 한글 변환 지원
        activeTemplate?.formSchema?.forEach(field => {
            if (field.type === 'currency' || field.type === 'number') {
                const rawVal = merged[field.key];
                if (rawVal !== undefined && rawVal !== '') {
                    const num = Number(String(rawVal).replace(/,/g, ''));
                    if (!isNaN(num) && num > 0) {
                        // {{필드명_한글}} 패턴 지원
                        formatted[`${field.key}_한글`] = numberToKorean(num);
                        // label 기반도 지원
                        formatted[`${field.label}_한글`] = numberToKorean(num);
                    }
                }
            }
        });

        return formatted;
    }, [project.commonData, activeDoc, activeTemplate, numberToKorean]);

    // PAGINATION LOGIC (Split HTML & Filter Schema)
    const { pagesRaw, currentSchema } = useMemo(() => {
        if (!activeTemplate || !activeTemplate.htmlTemplate) return { pagesRaw: [], currentSchema: [] };

        const rawPages = activeTemplate.htmlTemplate.split(PAGE_DELIMITER);

        // Find variables in current page
        const currentHtml = rawPages[currentPage] || '';
        const vars = new Set<string>();
        // Extract {{key}}
        const matches = currentHtml.matchAll(/{{(.*?)}}/g);
        for (const match of matches) {
            vars.add(match[1].replace(/\s/g, '_')); // Normalize key if needed, usually key is match[1] directly or trimmed
        }

        // Filter Schema: specific page variables + common variables usually needed? 
        // User asked "Change input fields when page changes". So we strictly filter.
        // But some fields might be repeated across pages. They will appear if valid.

        // Also we should check if the key matches the formSchema key.
        // Regex match[1] might be " 계약금액 " (with spaces). logic in builder trims it.
        // We should handle clean keys.

        const cleanVars = new Set<string>();
        const matches2 = currentHtml.matchAll(/{{(.*?)}}/g);
        for (const m of matches2) {
            cleanVars.add(m[1].trim());
        }

        // _한글 파생 키는 스키마에서 제외 (입력 불필요 - 자동 생성)
        const filtered = activeTemplate.formSchema.filter(f =>
            (cleanVars.has(f.key) || cleanVars.has(f.label)) &&
            !f.key.endsWith('_한글') && !f.label.endsWith('_한글')
        );

        return { pagesRaw: rawPages, currentSchema: filtered };
    }, [activeTemplate, currentPage]);

    // 현재 페이지 완성도 계산 (currentSchema 선언 후에 위치)
    const completionRate = useMemo(() => {
        if (!activeTemplate?.formSchema || currentSchema.length === 0) return null;
        const inputFields = currentSchema.filter(f => f.type !== 'section');
        if (inputFields.length === 0) return null;
        const filled = inputFields.filter(f => {
            const val = effectiveData[f.key] ?? effectiveData[f.label] ?? '';
            return String(val).trim() !== '';
        });
        return { filled: filled.length, total: inputFields.length };
    }, [currentSchema, effectiveData, activeTemplate]);


    // Handlers
    const handleDeleteDocument = (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        showConfirm('문서를 삭제하시겠습니까?', () => {
            setProject(prev => {
                const newDocs = prev.documents.filter(d => d.id !== docId);
                return { ...prev, documents: newDocs };
            });

            if (activeDocId === docId) {
                setActiveDocId(project.documents.find(d => d.id !== docId)?.id || '');
            }
        });
    };

    const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // is_system=true인 경우 삭제 방지 (DB 기준)
        const targetTemplate = allTemplates.find(t => t.id === templateId);
        if (targetTemplate?.is_system) {
            showAlert('기본 제공 템플릿은 삭제할 수 없습니다.');
            return;
        }

        showConfirm('정말 삭제하시겠습니까?\n삭제된 템플릿은 복구할 수 없으며, 저장된 양식 목록에서도 완전히 사라집니다.', async () => {
            try {
                // 1. DB에서 삭제
                const storedUser = localStorage.getItem('user');
                const uid = storedUser ? JSON.parse(storedUser).id : null;
                await fetch(`/api/templates/${templateId}?userId=${uid}`, { method: 'DELETE' });
            } catch (err) {
                console.error('템플릿 DB 삭제 실패:', err);
            }

            // 2. 로컬스토리지에서도 제거
            const stored = localStorage.getItem('custom_templates');
            if (stored) {
                const parsed = JSON.parse(stored) as ContractTemplate[];
                const filtered = parsed.filter(t => t.id !== templateId);
                localStorage.setItem('custom_templates', JSON.stringify(filtered));
            }

            // 3. 상태 업데이트
            setAllTemplates(prev => prev.filter(t => t.id !== templateId));
        }, true);
    };

    // 카테고리 내 템플릿 순서를 위/아래로 이동하고 DB에 저장하는 함수
    const handleMoveTemplate = async (templateId: string, direction: 'up' | 'down') => {
        // 1. 현재 카테고리의 템플릿만 추출
        const filtered = allTemplates.filter(t => t.category === modalCategory);
        const idx = filtered.findIndex(t => t.id === templateId);
        if (idx < 0) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= filtered.length) return;

        // 2. 배열 요소를 직접 교체 (핵심 수정: 순서 값만 바꾸는 게 아니라 위치 자체를 바꿈)
        const newFiltered = [...filtered];
        [newFiltered[idx], newFiltered[swapIdx]] = [newFiltered[swapIdx], newFiltered[idx]];

        // 3. 다른 카테고리 템플릿은 유지하고, 현재 카테고리만 새 순서로 교체
        const others = allTemplates.filter(t => t.category !== modalCategory);
        setAllTemplates([...others, ...newFiltered]);

        // 4. DB에 sort_order 저장 (재접속 후에도 순서 유지)
        try {
            const storedUser = localStorage.getItem('user');
            const uid = storedUser ? JSON.parse(storedUser).id : null;
            await Promise.all(
                newFiltered.map((t, i) =>
                    fetch(`/api/templates/${t.id}?userId=${uid}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sort_order: i + 1 })
                    })
                )
            );
        } catch (err) {
            console.error('순서 DB 저장 실패:', err);
        }
    };

    const handleAddDocument = (template: ContractTemplate) => {
        const newDoc: ContractDocument = {
            id: `new-doc-${Date.now()}`,
            projectId: project.id,
            templateId: template.id,
            name: template.name,
            formData: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setProject(prev => ({
            ...prev,
            documents: [...prev.documents, newDoc]
        }));

        setActiveDocId(newDoc.id);
        // Automatically switch to the category of the added document
        if (template.category !== activeCategory) {
            setActiveCategory(template.category);
        }
        setShowAddDocModal(false);
    };

    const handleFieldChange = (key: string, value: any) => {
        if (!activeDoc) return;

        setProject(prev => ({
            ...prev,
            documents: prev.documents.map(d =>
                d.id === activeDocId
                    ? { ...d, formData: { ...d.formData, [key]: value } }
                    : d
            )
        }));
    };

    const handleReset = () => {
        if (!activeDoc) return;
        showConfirm('작성된 내용을 모두 지우고 초기화하시겠습니까?', () => {
            setProject(prev => ({
                ...prev,
                documents: prev.documents.map(d =>
                    d.id === activeDocId
                        ? { ...d, formData: {} }
                        : d
                )
            }));
        });
    };

    const handleSave = async () => {
        try {
            const payload = {
                title: project.title,
                status: project.status,
                category: project.category || '기타',
                participants: project.participants,
                data: {
                    commonData: project.commonData,
                    documents: project.documents
                }
            };

            const storedUser = localStorage.getItem('user');
            const uid = storedUser ? JSON.parse(storedUser).id : null;
            const userIdQuery = uid ? `?userId=${uid}` : '';

            const res = await fetch(`/api/projects/${project.id}${userIdQuery}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showAlert('프로젝트가 저장되었습니다.');
            } else {
                throw new Error('Server error');
            }
        } catch (e) {
            console.error('Save failed', e);
            showAlert('저장 중 오류가 발생했습니다.');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handlePdf = async () => {
        const original = document.getElementById('print-area');
        if (!original) return;

        // 1. Create a clone to manipulate without affecting the UI
        const clone = original.cloneNode(true) as HTMLElement;

        // 2. Set styles to force desktop A4 rendering (off-screen)
        // Ensure the clone wrapper has the correct width so flow is correct
        clone.style.position = 'fixed';
        clone.style.top = '-10000px';
        clone.style.left = '0';
        clone.style.width = '210mm'; // Force A4 width standard
        clone.style.height = 'auto';
        clone.style.zIndex = '-1';
        clone.style.background = 'white';

        // Append to body to make it part of the DOM for rendering
        document.body.appendChild(clone);

        try {
            // 3. Find all pages in the clone and force them nicely visible
            const pages = clone.querySelectorAll('.contract-page');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
            const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;

                // Force visibility and reset transforms (fixing mobile scaling issue)
                page.style.display = 'block';
                page.style.transform = 'none';
                page.style.width = '100%'; // relative to the 210mm container
                page.style.minWidth = '210mm';
                page.style.margin = '0';
                page.style.boxShadow = 'none';
                page.style.border = 'none';

                // 4. Capture each page individually
                const canvas = await html2canvas(page, {
                    scale: 2, // 2x scale for decent retina-like quality
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 1200 // Simulate desktop window width
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            }

            pdf.save(`${activeDoc?.name || 'contract'}.pdf`);
        } catch (error) {
            console.error('PDF generation failed', error);
            showAlert('PDF 생성 중 오류가 발생했습니다.');
        } finally {
            // 5. Cleanup
            document.body.removeChild(clone);
        }
    };

    const handleUpdateProject = (updatedProject: ContractProject) => {
        setProject(updatedProject);
        // Persistence handled by useEffect([project])
        showAlert('프로젝트 정보가 수정되었습니다.');
    };

    const handleDeleteProject = async () => {
        showConfirm('정말 삭제하시겠습니까?', async () => {
            try {
                const storedUser = localStorage.getItem('user');
                const uid = storedUser ? JSON.parse(storedUser).id : null;
                const userIdQuery = uid ? `?userId=${uid}` : '';

                const res = await fetch(`/api/projects/${project.id}${userIdQuery}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    showAlert('프로젝트가 삭제되었습니다.');
                    router.replace('/contracts');
                } else {
                    showAlert('삭제 실패');
                }
            } catch (e) {
                console.error(e);
                showAlert('삭제 중 오류가 발생했습니다.');
            }
        }, true);
    };

    // --- RENDERERS ---

    // Status Logic
    const handleStatusChange = (newStatus: string) => {
        setProject(prev => ({ ...prev, status: newStatus as any }));
        // Persistence is already handled by the useEffect watching [project]
    };

    // Helper: Render Pagination Controls
    const renderPagination = () => (
        <div className="contract-pagination-controls" style={{
            display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px',
            backgroundColor: 'white', padding: '10px 20px', borderRadius: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #dee2e6',
            justifyContent: 'center'
        }}>
            <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                style={{
                    border: 'none', background: 'none', cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', color: currentPage === 0 ? '#adb5bd' : '#228be6'
                }}
            >
                <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
                {currentPage + 1} / {pagesRaw?.length || 1}
            </span>
            <button
                onClick={() => setCurrentPage(p => Math.min((pagesRaw?.length || 1) - 1, p + 1))}
                disabled={!pagesRaw || currentPage >= pagesRaw.length - 1}
                style={{
                    border: 'none', background: 'none', cursor: (!pagesRaw || currentPage >= pagesRaw.length - 1) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', color: (!pagesRaw || currentPage >= pagesRaw.length - 1) ? '#adb5bd' : '#228be6'
                }}
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );

    const renderFormInput = (field: FormField) => {
        // currency 필드의 표시값: 저장된 raw 값을 쉼표 포맷으로 표시
        const rawVal = effectiveData[field.key] ?? '';
        const displayVal = (field.type === 'currency' || field.type === 'number') && rawVal !== ''
            ? Number(String(rawVal).replace(/,/g, '')).toLocaleString('ko-KR')
            : rawVal;
        const val = (field.type === 'currency' || field.type === 'number') ? displayVal : rawVal;

        if (field.type === 'section') {
            return <div key={field.key} className={styles.sectionHeader}>{field.label}</div>;
        }

        return (
            <div key={field.key} className={styles.fieldGroup}>
                <label className={styles.label}>{field.label}</label>
                {field.type === 'textarea' ? (
                    <textarea
                        className={styles.input}
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        value={rawVal}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                    />
                ) : (
                    <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        className={styles.input}
                        value={val}
                        onChange={(e) => {
                            if (field.type === 'currency' || field.type === 'number') {
                                // 쉼표 제거 후 raw 숫자만 저장
                                const raw = e.target.value.replace(/,/g, '');
                                handleFieldChange(field.key, raw);
                            } else {
                                handleFieldChange(field.key, e.target.value);
                            }
                        }}
                        placeholder={field.placeholder}
                        inputMode={(field.type === 'currency' || field.type === 'number') ? 'numeric' : undefined}
                    />
                )}
                {field.helpText && <div style={{ fontSize: '11px', color: '#868e96', marginTop: '4px' }}>{field.helpText}</div>}
            </div>
        );
    };

    // Live HTML Rendering (Task 4: Preview)
    const renderPreview = () => {
        if (!activeTemplate) return <div>템플릿을 찾을 수 없습니다.</div>;

        let html = activeTemplate.htmlTemplate;

        // 정규식 특수문자 이스케이프 헬퍼
        const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 1. formSchema 기반 치환 (label 기준 + key 기준 모두 시도)
        //    Builder에서 HTML에는 {{label}}(공백 포함)으로 저장되지만
        //    formData 키는 label을 '_'로 변환한 key이므로 둘 다 매칭해야 함
        activeTemplate.formSchema?.forEach(field => {
            const rawVal = effectiveData[field.key] ?? '';

            // currency/number 타입은 쉼표 포맷 적용
            let displayVal: string;
            if ((field.type === 'currency' || field.type === 'number') && rawVal !== '') {
                const num = Number(String(rawVal).replace(/,/g, ''));
                displayVal = isNaN(num) ? String(rawVal) : num.toLocaleString('ko-KR');
            } else {
                displayVal = String(rawVal);
            }

            // {{label}} 패턴 치환 (공백 포함 원문 레이블)
            html = html.replace(new RegExp(`{{${escRe(field.label)}}}`, 'g'), displayVal);
            // {{key}} 패턴도 치환 (언더스코어 키)
            if (field.key !== field.label) {
                html = html.replace(new RegExp(`{{${escRe(field.key)}}}`, 'g'), displayVal);
            }
        });

        // 2. effectiveData 직접 키 치환 (폴백)
        Object.keys(effectiveData).forEach(key => {
            const regex = new RegExp(`{{${escRe(key)}}}`, 'g');
            let val = effectiveData[key];
            if (val === undefined || val === null) val = '';
            html = html.replace(regex, String(val));
        });

        // Cleanup remaining placeholders
        html = html.replace(/{{.*?}}/g, '<span style="background:#fff5f5; color:red;">[미입력]</span>');

        // Split pages
        const pages = html.split(PAGE_DELIMITER);

        return (
            <div id="print-area">
                {pages.map((pageHtml, index) => {
                    const isVisible = index === currentPage;
                    return (
                        <div
                            key={index}
                            className={`contract-page contract-preview ${isVisible ? 'page-visible' : 'page-hidden'} ${styles.paper}`}
                            style={{
                                display: isVisible ? 'block' : 'none', // Screen visibility
                                marginBottom: '0', // No gap in pagination view
                                position: 'relative'
                            }}
                        >
                            <div dangerouslySetInnerHTML={{ __html: pageHtml }} />

                            {/* Page Number Overlay */}
                            <div style={{
                                position: 'absolute',
                                bottom: '5mm',
                                left: 0,
                                right: 0,
                                textAlign: 'center',
                                fontSize: '12px',
                                color: '#868e96',
                                pointerEvents: 'none'
                            }}>
                                - {index + 1} -
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`layout-container ${styles.container}`}>
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @media print {
                    /* Hide UI elements */
                    .layout-sidebar,
                    .layout-toolbar,
                    .layout-form-panel,
                    .${styles.mobileTabBar} {
                        display: none !important;
                    }

                    /* Reset structural containers to simple blocks to allow flow */
                    .layout-container,
                    .layout-main,
                    .layout-workspace,
                    .layout-preview-panel {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                    }

                    /* Document Content */
                    #print-area {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: transparent !important;
                        box-shadow: none !important;
                        border: none !important;
                    }

                    .contract-page {
                        position: relative !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 5mm 10mm !important;
                        letter-spacing: -0.5px !important;
                        word-spacing: -1px !important;
                        box-sizing: border-box !important;
                        background-color: white !important;
                        box-shadow: none !important;
                        border: none !important;
                        height: 297mm !important;
                        overflow: hidden !important;
                        page-break-after: always;
                        transform: none !important;
                    }

                    table td, table th { padding: 4px !important; }

                    .contract-page:last-child {
                        page-break-after: auto;
                    }

                    @page {
                        size: A4;
                        margin: 0;
                    }

                    html, body {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: visible;
                        background: white;
                    }
                }

                /* Common Document Styling */
                #print-area h1, .contract-preview h1 { margin: 0 0 40px 0; padding: 0; line-height: 1.2; font-size: 2.2em; font-weight: 700; text-align: center; }
                #print-area h2, .contract-preview h2 { margin: 30px 0 15px 0; padding: 0; line-height: 1.3; font-size: 1.5em; font-weight: 700; border-bottom: 2px solid #333; padding-bottom: 5px; }
                #print-area h3, .contract-preview h3 { margin: 25px 0 10px 0; padding: 0; line-height: 1.3; font-size: 1.25em; font-weight: 700; }
                #print-area p, .contract-preview p { margin: 5px 0; line-height: 1.6; word-break: keep-all; overflow-wrap: break-word; }

                #print-area .section, .contract-preview .section { margin-bottom: 30px; }

                #print-area table, .contract-preview table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin-bottom: 20px !important;
                    table-layout: fixed !important;
                }
                #print-area table td, .contract-preview table td {
                    border: 1px solid #adb5bd !important;
                    padding: 5px 6px !important;
                    word-break: keep-all !important;
                }
                #print-area table .label, .contract-preview table .label {
                    background-color: #f8f9fa !important;
                    font-weight: 600 !important;
                    width: 120px;
                }
                #print-area table .money, .contract-preview table .money { text-align: right !important; }

                #print-area .footer-sign, .contract-preview .footer-sign { margin-top: 50px; display: flex; flex-direction: column; gap: 15px; }
                #print-area .signer, .contract-preview .signer { font-size: 1.1em; }
                #print-area .date, .contract-preview .date { margin-top: 20px; text-align: center; font-size: 1.1em; }

                #print-area > div:not(:last-child) {
                    page-break-after: always;
                }

                @media print {
                    .contract-pagination-controls { display: none !important; }
                    .contract-page { display: block !important; }
                }
            `}</style>

            {/* MOBILE TAB BAR */}
            <div className={styles.mobileTabBar}>
                <div
                    className={`${styles.mobileTab} ${mobileTab === 'docs' ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab('docs')}
                >
                    <FileText size={16} style={{ marginRight: 6 }} /> 문서 목록
                </div>
                <div
                    className={`${styles.mobileTab} ${mobileTab === 'form' ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab('form')}
                >
                    <PenTool size={16} style={{ marginRight: 6 }} /> 내용 입력
                </div>
                <div
                    className={`${styles.mobileTab} ${mobileTab === 'preview' ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab('preview')}
                >
                    <Layout size={16} style={{ marginRight: 6 }} /> 미리보기
                </div>
            </div>

            {/* 1. SIDEBAR (Task 1: Structure) */}
            <div className={`layout-sidebar ${styles.sidebar} ${mobileTab !== 'docs' ? styles.hiddenOnMobile : ''}`}>
                <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: '16px', margin: 0, marginBottom: '4px' }}>{project.title}</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#1c7ed6', backgroundColor: '#e7f5ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{project.category || '기타'}</span>
                            <span style={{ fontSize: '11px', color: '#adb5bd' }}>ID: {project.id}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#495057', marginBottom: '8px' }}>
                            <span style={{ color: '#868e96' }}>참석자:</span> {project.participants || '-'}
                        </div>
                        {/* Status Selector */}
                        <div style={{ marginTop: '12px', position: 'relative', width: '120px' }}>
                            <select
                                value={project.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    paddingRight: '30px', // Space for arrow
                                    borderRadius: '6px',
                                    border: '1px solid #dee2e6',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    backgroundColor: STATUS_OPTIONS.find(o => o.value === project.status)?.bg || 'white',
                                    color: STATUS_OPTIONS.find(o => o.value === project.status)?.color || '#495057',
                                    outline: 'none',
                                    appearance: 'none', // Remove default arrow
                                }}
                            >
                                {STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} style={{ backgroundColor: 'white', color: 'black' }}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none', // Allow clicking through to select
                                display: 'flex',
                                alignItems: 'center',
                                color: STATUS_OPTIONS.find(o => o.value === project.status)?.color || '#868e96'
                            }}>
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowEditModal(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#868e96', padding: '4px' }}
                        title="프로젝트 정보 수정"
                    >
                        <Settings size={18} />
                    </button>
                </div>

                {/* Category Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', overflowX: 'auto' }}>
                    {categories.map(cat => (
                        <div
                            key={cat}
                            className={activeCategory === cat ? `${styles.categoryTab} ${styles.categoryTabActive}` : styles.categoryTab}
                            style={{ whiteSpace: 'nowrap' }}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat}
                        </div>
                    ))}
                </div>

                {/* Document List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                    {project.documents.map((doc) => {
                        const t = allTemplates.find(t => t.id === doc.templateId);
                        // If no template found, maybe show it under '기타' or if activeCategory matches undefined?
                        // Simple logic match:
                        if (t?.category !== activeCategory) return null;

                        return (
                            <div
                                key={doc.id}
                                className={activeDocId === doc.id ? `${styles.docItem} ${styles.docItemActive}` : styles.docItem}
                                onClick={() => { setActiveDocId(doc.id); setMobileTab('form'); }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                    <FileText size={16} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#adb5bd', display: 'flex' }}
                                    title="문서 삭제 (프로젝트에서만 제거)"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}

                    <div style={{ padding: '10px 20px', marginTop: '10px', borderTop: '1px solid #f1f3f5' }}>
                        <button
                            onClick={() => {
                                setModalCategory(activeCategory);
                                setShowAddDocModal(true);
                            }}
                            style={{
                                width: '100%', padding: '8px', border: '1px dashed #adb5bd',
                                backgroundColor: 'white', color: '#868e96', borderRadius: '4px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                            }}
                        >
                            <Plus size={14} /> 문서 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* ADD DOCUMENT MODAL */}
            {showAddDocModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: 'white', width: '500px', borderRadius: '8px',
                        overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>새 문서 추가</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {/* 순서 변경 모드 토글 버튼 */}
                                <button
                                    onClick={() => setIsReordering(prev => !prev)}
                                    style={{
                                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                                        border: '1px solid', cursor: 'pointer',
                                        backgroundColor: isReordering ? '#e7f5ff' : 'white',
                                        borderColor: isReordering ? '#228be6' : '#dee2e6',
                                        color: isReordering ? '#1c7ed6' : '#868e96',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                    title="순서 변경 모드"
                                >
                                    <GripVertical size={14} />
                                    {isReordering ? '완료' : '순서변경'}
                                </button>
                                <button onClick={() => setShowAddDocModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronDown size={20} /></button>
                            </div>
                        </div>
                        <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                            {/* Category Filter in Modal */}
                            <div style={{ marginBottom: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setModalCategory(cat)}
                                        style={{
                                            padding: '4px 10px', borderRadius: '12px', border: '1px solid',
                                            fontSize: '12px', cursor: 'pointer',
                                            backgroundColor: modalCategory === cat ? '#e7f5ff' : 'white',
                                            borderColor: modalCategory === cat ? '#228be6' : '#dee2e6',
                                            color: modalCategory === cat ? '#1c7ed6' : '#495057'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <p style={{ fontSize: '14px', color: '#868e96', marginBottom: '12px' }}>
                                선택된 카테고리: <strong>{modalCategory}</strong>
                            </p>

                            {/* Template List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {allTemplates.filter(t => t.category === modalCategory).length > 0 ? (
                                    allTemplates.filter(t => t.category === modalCategory).map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => { if (!isReordering) handleAddDocument(t); }}
                                            style={{
                                                padding: '12px', border: '1px solid #dee2e6', borderRadius: '6px',
                                                textAlign: 'left', backgroundColor: isReordering ? '#f8f9fa' : 'white',
                                                cursor: isReordering ? 'default' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                position: 'relative'
                                            }}
                                        >
                                            <FileText size={18} color={isReordering ? '#868e96' : '#228be6'} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{t.name}</div>
                                                <div style={{ fontSize: '12px', color: '#868e96' }}>{t.description}</div>
                                            </div>
                                            {/* 순서 변경 모드 vs 일반 모드 */}
                                            {isReordering ? (
                                                // 순서 변경 모드: 위/아래 버튼 표시
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMoveTemplate(t.id, 'up'); }}
                                                        style={{ border: '1px solid #dee2e6', borderRadius: '4px', background: 'white', cursor: 'pointer', padding: '2px 6px', color: '#495057' }}
                                                        title="위로"
                                                    ><ArrowUp size={14} /></button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMoveTemplate(t.id, 'down'); }}
                                                        style={{ border: '1px solid #dee2e6', borderRadius: '4px', background: 'white', cursor: 'pointer', padding: '2px 6px', color: '#495057' }}
                                                        title="아래로"
                                                    ><ArrowDown size={14} /></button>
                                                </div>
                                            ) : (
                                                // 일반 모드: 편집/삭제 버튼
                                                <>{!t.is_system ? (
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.location.href = `/contracts/builder?templateId=${t.id}&projectId=${project.id}&returnToProject=true`;
                                                            }}
                                                            style={{ padding: '8px', color: '#228be6' }}
                                                            title="양식 수정"
                                                        >
                                                            <PenTool size={16} />
                                                        </div>
                                                        <div
                                                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                                                            style={{ padding: '8px', color: '#fa5252' }}
                                                            title="양식 영구 삭제"
                                                        >
                                                            <Trash2 size={16} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.location.href = `/contracts/builder?templateId=${t.id}&projectId=${project.id}&returnToProject=true`;
                                                        }}
                                                        style={{ padding: '8px', color: '#868e96' }}
                                                        title="이 양식을 기반으로 새로 만들기"
                                                    >
                                                        <PenTool size={16} />
                                                    </div>
                                                )}</>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                                        이 카테고리에는 등록된 양식이 없습니다.<br />
                                        새 양식을 만들어보세요.
                                    </div>
                                )}
                            </div>

                            {/* Link to Builder */}
                            <div style={{ borderTop: '1px solid #f1f3f5', marginTop: '20px', paddingTop: '15px' }}>
                                <button
                                    onClick={() => window.location.href = `/contracts/builder?projectId=${project.id}&returnToProject=true`}
                                    style={{
                                        width: '100%', padding: '12px',
                                        backgroundColor: '#f8f9fa', border: '1px dashed #adb5bd', borderRadius: '6px',
                                        color: '#495057', fontSize: '14px', fontWeight: 500,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Layout size={16} /> 새로운 양식 만들기 (바로 적용)
                                </button>
                            </div>
                        </div>
                        <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', textAlign: 'right', borderTop: '1px solid #dee2e6' }}>
                            <button
                                onClick={() => setShowAddDocModal(false)}
                                style={{ padding: '8px 16px', border: '1px solid #ced4da', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* 2. MAIN WORKSPACE (Task 2 & 3) */}
            <div className={`layout-main ${styles.main} ${(mobileTab !== 'form' && mobileTab !== 'preview') ? styles.hiddenOnMobile : ''}`}>
                {/* Toolbar */}
                <div className={`layout-toolbar ${styles.toolbar}`}>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>
                        {activeDoc?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={styles.btn} onClick={handleReset} title="내용 초기화"><RotateCcw size={16} /> <span className={styles.hiddenOnMobile}>초기화</span></button>
                        {activeTemplate && (
                            <button
                                className={styles.btn}
                                style={{ color: '#228be6', borderColor: '#a5d8ff' }}
                                onClick={() => {
                                    window.location.href = `/contracts/builder?templateId=${activeTemplate.id}&projectId=${project.id}&returnToProject=true`;
                                }}
                                title="원본 양식 자체를 수정합니다"
                            >
                                <PenTool size={16} /> 양식 수정
                            </button>
                        )}
                        <button className={styles.btn} onClick={handleSave}><Save size={16} /> <span className={styles.hiddenOnMobile}>저장</span></button>
                        <button className={`${styles.btn} ${styles.hiddenOnMobile}`} onClick={handlePrint}><Printer size={16} /> <span className={styles.hiddenOnMobile}>인쇄</span></button>
                        <button className={styles.btn} onClick={handlePdf}><Download size={16} /> <span className={styles.hiddenOnMobile}>PDF</span></button>
                    </div>
                </div>

                <div className={`layout-workspace ${styles.workspace}`}>
                    {/* LEFT: Dynamic Form Engine (Task 3) */}
                    <div className={`layout-form-panel ${styles.formPanel} ${mobileTab !== 'form' ? styles.hiddenOnMobile : ''}`}>
                        {/* 필드 완성도 진행바 */}
                        {completionRate && (
                            <div style={{
                                padding: '10px 16px 0',
                                marginBottom: '4px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', color: '#868e96', fontWeight: 500 }}>
                                        작성 완성도
                                    </span>
                                    <span style={{
                                        fontSize: '12px', fontWeight: 700,
                                        color: completionRate.filled === completionRate.total ? '#2f9e44' : '#1c7ed6'
                                    }}>
                                        {completionRate.filled} / {completionRate.total}
                                        {completionRate.filled === completionRate.total && ' ✓'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.round((completionRate.filled / completionRate.total) * 100)}%`,
                                        backgroundColor: completionRate.filled === completionRate.total ? '#2f9e44' : '#228be6',
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            </div>
                        )}
                        {renderPagination()}
                        {activeTemplate ? (
                            (currentSchema || []).map(renderFormInput)
                        ) : (
                            <div>템플릿 로딩 실패</div>
                        )}
                    </div>

                    {/* RIGHT: Live Preview (WYSIWYG-like) */}
                    <div className={`layout-preview-panel ${styles.previewPanel} ${mobileTab !== 'preview' ? styles.hiddenOnMobile : ''}`}>
                        <div className={styles.previewWrapper}>
                            {/* Pagination Controls */}
                            {renderPagination()}

                            {renderPreview()}
                        </div>
                    </div>
                </div>
            </div>

            <EditProjectModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                project={project}
                onUpdate={handleUpdateProject}
                onDelete={handleDeleteProject}
            />
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
                isDanger={confirmModal.isDanger}
            />

            {/* 자동저장 토스트 (우하단 고정) */}
            {autoSaveStatus !== 'idle' && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    backgroundColor: autoSaveStatus === 'saved' ? '#2f9e44' : '#228be6',
                    color: 'white', padding: '8px 16px', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 500, zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {autoSaveStatus === 'saving' ? (
                        <>
                            <div style={{
                                width: '12px', height: '12px',
                                border: '2px solid rgba(255,255,255,0.4)',
                                borderTopColor: 'white', borderRadius: '50%',
                                display: 'inline-block',
                                animation: 'spin 0.7s linear infinite'
                            }} />
                            저장 중...
                        </>
                    ) : (
                        <>✓ 자동저장 완료</>
                    )}
                </div>
            )}
        </div>
    );
}

// MAIN EXPORT WITH SUSPENSE
export default function ContractProjectPage() {
    return (
        <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>}>
            <ProjectEditor />
        </Suspense>
    );
}

// --- STYLES REMOVED (Moved to page.module.css) ---
