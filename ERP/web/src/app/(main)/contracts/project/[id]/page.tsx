"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    Download, Printer, Save, FileText, CheckCircle,
    ChevronRight, ChevronDown, Plus, Layout, Trash2, RotateCcw,
    Settings, PenTool, ChevronLeft, ArrowLeft
} from 'lucide-react';
import { ContractProject, ContractDocument, ContractTemplate, FormField } from '@/types/contract-core';
import { CONTRACT_TEMPLATES, getTemplateById, getAllTemplates } from '@/lib/templates/registry';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import EditProjectModal from '../../_components/EditProjectModal';

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
        { id: 'd-1', projectId: 'p-001', templateId: 't-transfer-001', name: '점포 양도양수 계약서', formData: {}, createdAt: '', updatedAt: '' },
        { id: 'd-2', projectId: 'p-001', templateId: 't-receipt-001', name: '계약금 영수증', formData: { purpose: '계약금' }, createdAt: '', updatedAt: '' },
        { id: 'd-3', projectId: 'p-001', templateId: 't-facility-check', name: '시설 확인서', formData: {}, createdAt: '', updatedAt: '' },
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

    // Reset pagination on doc change
    useEffect(() => {
        setCurrentPage(0);
    }, [activeDocId]);

    // LOAD TEMPLATES DYNAMICALLY
    const [allTemplates, setAllTemplates] = useState<ContractTemplate[]>(CONTRACT_TEMPLATES);
    const [categories, setCategories] = useState<string[]>(['사업체 양도양수', '부동산 계약']);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // 1. Load Templates
        const loadedTemplates = getAllTemplates();
        setAllTemplates(loadedTemplates);

        const cats = Array.from(new Set(loadedTemplates.map(t => t.category)));
        if (cats.length === 0) cats.push('사업체 양도양수');
        setCategories(cats);
        if (cats.length > 0) setModalCategory(cats[0]);

        // 2. Load Project Data from LocalStorage
        const storageKey = `project_data_${params.id}`;
        try {
            const savedProjectStr = localStorage.getItem(storageKey);
            if (savedProjectStr) {
                const savedProject = JSON.parse(savedProjectStr);
                setProject(savedProject);
                // Also restore active doc if possible
                if (savedProject.documents.length > 0) {
                    setActiveDocId(savedProject.documents[savedProject.documents.length - 1].id);
                }
            } else {
                setProject(prev => ({ ...prev, id: params.id as string }));
            }
        } catch (e) {
            console.error("Failed to load project", e);
        } finally {
            setIsLoaded(true);
        }
    }, [params.id]);

    // AUTO-ADD NEWLY CREATED TEMPLATE Logic
    useEffect(() => {
        if (newDocTemplateId) {
            // Force refresh templates from storage to get the latest version (including newly edited ones)
            const loadedTemplates = getAllTemplates();
            setAllTemplates(loadedTemplates);

            const template = loadedTemplates.find(t => t.id === newDocTemplateId);
            if (template) {
                handleAddDocument(template);
                // Clear the query param
                router.replace(`/contracts/project/${params.id}`);
            }
        }
    }, [newDocTemplateId, params.id, router]);

    // AUTO-SAVE PROJECT (Persistence)
    useEffect(() => {
        if (isLoaded && project.id) {
            const storageKey = `project_data_${project.id}`;
            console.log('Auto-saving project:', storageKey); // Debug log
            localStorage.setItem(storageKey, JSON.stringify(project));
        }
    }, [project, isLoaded]);

    // DERIVED STATE
    const activeDoc = useMemo(() => project.documents.find(d => d.id === activeDocId), [project, activeDocId]);
    const activeTemplate = useMemo(() => activeDoc ? allTemplates.find(t => t.id === activeDoc.templateId) : null, [activeDoc, allTemplates]);

    const effectiveData = useMemo(() => {
        if (!activeDoc) return {};
        const merged = { ...project.commonData, ...activeDoc.formData };
        const formatted: Record<string, any> = { ...merged };
        Object.keys(merged).forEach(key => {
            if (typeof merged[key] === 'number') {
                formatted[`${key}_fmt`] = new Intl.NumberFormat('ko-KR').format(merged[key] as number);
            }
        });
        return formatted;
    }, [project.commonData, activeDoc]);

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

        const filtered = activeTemplate.formSchema.filter(f => cleanVars.has(f.key) || cleanVars.has(f.label)); // label fallback just in case

        // If filtered is empty (e.g. text only page), maybe show nothing or all?
        // Let's show filtered.

        return { pagesRaw: rawPages, currentSchema: filtered };
    }, [activeTemplate, currentPage]);


    // Handlers
    const handleDeleteDocument = (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('문서를 삭제하시겠습니까?')) return;

        setProject(prev => {
            const newDocs = prev.documents.filter(d => d.id !== docId);
            return { ...prev, documents: newDocs };
        });

        if (activeDocId === docId) {
            setActiveDocId(project.documents.find(d => d.id !== docId)?.id || '');
        }
    };

    const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Guard: Prevent deleting system templates
        if (CONTRACT_TEMPLATES.find(t => t.id === templateId)) {
            alert('기본 제공 템플릿은 삭제할 수 없습니다.');
            return;
        }

        if (!confirm('정말 삭제하시겠습니까?\n삭제된 템플릿은 복구할 수 없으며, 저장된 양식 목록에서도 완전히 사라집니다.')) return;

        // 1. Remove from LocalStorage
        const stored = localStorage.getItem('custom_templates');
        if (stored) {
            const parsed = JSON.parse(stored) as ContractTemplate[];
            const filtered = parsed.filter(t => t.id !== templateId);
            localStorage.setItem('custom_templates', JSON.stringify(filtered));
        }

        // 2. Update State
        setAllTemplates(prev => prev.filter(t => t.id !== templateId));
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
        if (!confirm('작성된 내용을 모두 지우고 초기화하시겠습니까?')) return;

        setProject(prev => ({
            ...prev,
            documents: prev.documents.map(d =>
                d.id === activeDocId
                    ? { ...d, formData: {} }
                    : d
            )
        }));
    };

    const handleSave = () => {
        // Save to LocalStorage
        try {
            const storageKey = `project_data_${project.id}`;
            console.log('Saving project to:', storageKey, project); // DEBUG
            localStorage.setItem(storageKey, JSON.stringify(project));
            alert('프로젝트가 저장되었습니다.');
        } catch (e) {
            console.error('Save failed', e);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handlePdf = async () => {
        const element = document.getElementById('print-area');
        if (!element) return;

        try {
            // High quality capture
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            // A4 dimensions in mm
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Calculate height to fit width
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // If height is greater than A4, we might need multiple pages (simple version: scaled fit or overflow)
            // For now, simple single page fit or multipage

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            // TODO: Add loop for multi-page if needed by content

            pdf.save(`${activeDoc?.name || 'contract'}.pdf`);
        } catch (error) {
            console.error('PDF generation failed', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        }
    };

    const handleUpdateProject = (updatedProject: ContractProject) => {
        setProject(updatedProject);
        // Persistence handled by useEffect([project])
        alert('프로젝트 정보가 수정되었습니다.');
    };

    const handleDeleteProject = () => {
        // Remove from localStorage
        const storageKey = `project_data_${project.id}`;
        localStorage.removeItem(storageKey);

        // Redirect to list
        alert('프로젝트가 삭제되었습니다.');
        router.replace('/contracts');
    };

    // --- RENDERERS ---

    // Status Logic
    const handleStatusChange = (newStatus: string) => {
        setProject(prev => ({ ...prev, status: newStatus as any }));
        // Persistence is already handled by the useEffect watching [project]
    };

    const renderFormInput = (field: FormField) => {
        const val = effectiveData[field.key] || '';

        if (field.type === 'section') {
            return <div key={field.key} style={styles.sectionHeader}>{field.label}</div>;
        }

        return (
            <div key={field.key} style={styles.fieldGroup}>
                <label style={styles.label}>{field.label}</label>
                {field.type === 'textarea' ? (
                    <textarea
                        style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                        value={val}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                    />
                ) : (
                    <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        style={styles.input}
                        value={val}
                        onChange={(e) => {
                            // If it's a 'money' field, we might want to strip non-digits for number storage
                            // For simplicity here, storing as string or direct value
                            handleFieldChange(field.key, e.target.value);
                        }}
                        placeholder={field.placeholder}
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

        // Simple Template Engine (Regex Replace)
        Object.keys(effectiveData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
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
                            className={`contract-page contract-preview ${isVisible ? 'page-visible' : 'page-hidden'}`}
                            style={{
                                ...styles.paper,
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
        <div className="layout-container" style={styles.container}>
            <style jsx global>{`
                @media print {
                    /* Hide UI elements */
                    .layout-sidebar, 
                    .layout-toolbar, 
                    .layout-form-panel {
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
                        margin: 0 !important;
                        padding: 5mm 10mm !important; 
                        letter-spacing: -0.5px !important;
                        word-spacing: -1px !important;
                        box-sizing: border-box !important;
                        background-color: white !important;
                        box-shadow: none !important; /* Printing usually doesn't need shadow */
                        border: none !important;
                        height: 297mm !important;
                        overflow: hidden !important;
                        page-break-after: always;
                    }

                    /* Table Padding Override */
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

                /* Common Document Styling for both Builder and Viewer */
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

                /* Page Breaking */
                #print-area > div:not(:last-child) {
                    page-break-after: always;
                }

                @media print {
                    .contract-pagination-controls { display: none !important; }
                    .contract-page { display: block !important; }
                }
            `}</style>

            {/* 1. SIDEBAR (Task 1: Structure) */}
            <div className="layout-sidebar" style={styles.sidebar}>
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
                            style={{
                                ...(activeCategory === cat ? { ...styles.categoryTab, ...styles.categoryTabActive } : styles.categoryTab),
                                whiteSpace: 'nowrap'
                            }}
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
                                style={activeDocId === doc.id ? { ...styles.docItem, ...styles.docItemActive } : styles.docItem}
                                onClick={() => setActiveDocId(doc.id)}
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
                            <button onClick={() => setShowAddDocModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronDown size={20} /></button>
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
                                        <button
                                            key={t.id}
                                            onClick={() => handleAddDocument(t)}
                                            style={{
                                                padding: '12px', border: '1px solid #dee2e6', borderRadius: '6px',
                                                textAlign: 'left', backgroundColor: 'white', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                position: 'relative' // for delete btn positioning
                                            }}
                                        >
                                            <FileText size={18} color="#228be6" />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{t.name}</div>
                                                <div style={{ fontSize: '12px', color: '#868e96' }}>{t.description}</div>
                                            </div>
                                            {/* Show edit/delete controls for custom templates (not in system registry) */}
                                            {!CONTRACT_TEMPLATES.find(ct => ct.id === t.id) ? (
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
                                            )}
                                        </button>
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
            <div className="layout-main" style={styles.main}>
                {/* Toolbar */}
                <div className="layout-toolbar" style={styles.toolbar}>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>
                        {activeDoc?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={btnStyle} onClick={handleReset} title="내용 초기화"><RotateCcw size={16} /> 초기화</button>
                        {activeTemplate && (
                            <button
                                style={{ ...btnStyle, color: '#228be6', borderColor: '#a5d8ff' }}
                                onClick={() => {
                                    window.location.href = `/contracts/builder?templateId=${activeTemplate.id}&projectId=${project.id}&returnToProject=true`;
                                }}
                                title="원본 양식 자체를 수정합니다"
                            >
                                <PenTool size={16} /> 양식 수정
                            </button>
                        )}
                        <button style={btnStyle} onClick={handleSave}><Save size={16} /> 저장</button>
                        <button style={btnStyle} onClick={handlePrint}><Printer size={16} /> 인쇄</button>
                        <button style={btnStyle} onClick={handlePdf}><Download size={16} /> PDF</button>
                    </div>
                </div>

                <div className="layout-workspace" style={styles.workspace}>
                    {/* LEFT: Dynamic Form Engine (Task 3) */}
                    <div className="layout-form-panel" style={styles.formPanel}>
                        {activeTemplate ? (
                            (currentSchema && currentSchema.length > 0 ? currentSchema : activeTemplate.formSchema)
                                .map(renderFormInput)
                        ) : (
                            <div>템플릿 로딩 실패</div>
                        )}
                    </div>

                    {/* RIGHT: Live Preview (WYSIWYG-like) */}
                    <div className="layout-preview-panel" style={styles.previewPanel}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            {/* Pagination Controls */}
                            <div className="contract-pagination-controls" style={{
                                display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px',
                                backgroundColor: 'white', padding: '10px 20px', borderRadius: '30px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #dee2e6'
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
        </div >
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

// --- STYLES (Inline for simplicity) ---
const styles = {
    container: { display: 'flex', height: 'calc(100vh - 60px)', backgroundColor: '#f8f9fa' },
    sidebar: { width: '280px', backgroundColor: 'white', borderRight: '1px solid #dee2e6', display: 'flex', flexDirection: 'column' as const },
    main: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    toolbar: { height: '50px', borderBottom: '1px solid #dee2e6', backgroundColor: 'white', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' },
    workspace: { flex: 1, display: 'flex', overflow: 'hidden' },
    formPanel: { width: '400px', backgroundColor: '#f8f9fa', borderRight: '1px solid #dee2e6', overflowY: 'auto' as const, padding: '20px' },
    previewPanel: { flex: 1, backgroundColor: '#e9ecef', padding: '40px 20px', overflowY: 'auto' as const, overflowX: 'auto' as const, display: 'flex', justifyContent: 'center' },
    paper: {
        width: '210mm',
        minWidth: '210mm',
        minHeight: '297mm',
        backgroundColor: 'white',
        padding: '5mm 10mm',
        letterSpacing: '-0.5px',
        wordSpacing: '-1px',
        boxSizing: 'border-box' as const,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#212529',
        overflow: 'hidden'
    },

    categoryTab: { padding: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#495057', borderBottom: '1px solid transparent' },
    categoryTabActive: { color: '#228be6', borderBottom: '2px solid #228be6' },
    docItem: { padding: '10px 15px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#495057', marginTop: '2px' as const },
    docItemActive: { backgroundColor: '#e7f5ff', color: '#1c7ed6', fontWeight: 500 },

    fieldGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#343a40' },
    input: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '14px' },
    sectionHeader: { marginTop: '24px', marginBottom: '12px', fontSize: '15px', fontWeight: 700, color: '#1c7ed6', borderBottom: '1px solid #e9ecef', paddingBottom: '4px' }
};

const btnStyle = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', border: '1px solid #ced4da',
    backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
};
