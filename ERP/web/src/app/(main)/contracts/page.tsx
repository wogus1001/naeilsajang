"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { Contract } from '@/lib/ucansign/client';
import {
    FileText, Plus, RefreshCw, AlertCircle, Search,
    Folder, ChevronRight, Layout, PenTool, CheckCircle2,
    Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateProjectModal from './_components/CreateProjectModal';
import PointsModal from './_components/PointsModal';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- MOCK DATA FOR NEW TEMPLATE PROJECTS ---
const SAVED_PROJECTS = [
    {
        id: 'p-001',
        title: '강남 이디야 양도양수 건',
        category: '사업체 양도양수',
        status: 'active',
        documents: 3,
        updatedAt: '2024-05-21T14:30:00',
        participants: '김매도, 이매수'
    },
    {
        id: 'p-002',
        title: '마포구 상수동 상가 임대차',
        category: '부동산 계약',
        status: 'completed',
        documents: 1,
        updatedAt: '2024-05-19T09:15:00',
        participants: '박임대, 최임차'
    },
    {
        id: 'p-003',
        title: '홍대 카페 권리금 계약',
        category: '사업체 양도양수',
        status: 'draft',
        documents: 2,
        updatedAt: '2024-05-10T11:20:00',
        participants: '정양도'
    }
];

// ... (Previous imports)
import ContractDetailPanel from './_components/ContractDetailPanel';
import {
    Filter, MoreHorizontal, User as UserIcon, Calendar as CalendarIcon,
    Download as DownloadIcon, Trash2 as TrashIcon, RefreshCcw, CreditCard
} from 'lucide-react';
import styles from './page.module.css';

function ContractsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'signatures' ? 'signatures' : 'drafts';
    const [activeTab, setActiveTab] = useState<'drafts' | 'signatures'>(initialTab);

    // Update tab state when URL params change
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'signatures') setActiveTab('signatures');
        else if (tab === 'drafts') setActiveTab('drafts');
    }, [searchParams]);


    // --- OLD LOGIC STATE (Signatures) ---
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needAuth, setNeedAuth] = useState<boolean>(false);
    const [userId, setUserId] = useState<string | null>(null);

    // --- NEW DASHBOARD STATE ---
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [detailPanelData, setDetailPanelData] = useState<any | null>(null);
    const [isPanelLoading, setIsPanelLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [signatureSearchTerm, setSignatureSearchTerm] = useState('');



    // --- POINTS STATE ---
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [pointsBalance, setPointsBalance] = useState<number | null>(null);

    // --- NEW LOGIC STATE (Drafts) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [savedProjects, setSavedProjects] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

    // --- DATA FETCHING ---
    const fetchSavedProjects = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const res = await fetch(`/api/projects?userId=${uid}`);
            if (res.ok) {
                const { data } = await res.json();
                // Map DB rows to UI model
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    title: p.title,
                    category: p.category,
                    status: p.status,
                    participants: p.participants,
                    documents: p.data?.documents || [],
                    updatedAt: p.updated_at,
                    createdAt: p.created_at,
                    // commonData? not needed for list
                }));
                setSavedProjects(mapped);
            } else {
                console.error('Failed to fetch projects');
            }
        } catch (e) {
            console.error('Failed to fetch projects', e);
        }
    };

    const refreshAll = () => {
        fetchSavedProjects();
        if (activeTab === 'signatures') fetchData();
    };

    useEffect(() => {
        if (activeTab === 'drafts') {
            fetchSavedProjects();
        }
    }, [activeTab]);



    // --- EMBEDDING HANDLERS ---
    const handleEmbedCreate = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const res = await fetch('/api/embedding/sign-creating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: uid,
                    redirectUrl: window.location.origin + '/contracts'
                })
            });
            const data = await res.json();

            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                const errMsg = data.error || 'Unknown';
                if (errMsg.includes('not connected')) {
                    showAlert('유캔싸인을 연동해주세요');
                } else {
                    showAlert('전자계약 생성 실패: ' + errMsg);
                }
            }
        } catch (e) {
            console.error(e);
            showAlert('오류가 발생했습니다.');
        }
    };

    const handleEmbedView = async (documentId: string) => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const res = await fetch(`/api/embedding/view/${documentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: uid,
                    documentId,
                    redirectUrl: window.location.origin + '/contracts'
                })
            });
            const data = await res.json();

            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                showAlert('임베딩 URL 생성 실패: ' + (data.error || 'Unknown'));
            }
        } catch (e) {
            console.error(e);
            showAlert('오류가 발생했습니다.');
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        setNeedAuth(false);

        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const user = JSON.parse(storedUser);
            setUserId(user.id);

            let url = `/api/contracts?userId=${user.id}`;
            // If API supports folderId, use it. Documentation for getContracts v1 didn't specify, but often it's standard.
            // If not, we filter client side.
            // Let's assume client side filter for safety as docs were partial.
            if (statusFilter !== 'all') {
                url += `&status=${statusFilter}`;
            }

            const response = await fetch(url);

            if (response.status === 401) {
                const errorData = await response.json();
                if (errorData.code === 'NEED_AUTH') {
                    setNeedAuth(true);
                    setIsLoading(false);
                    return;
                }
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch contracts');
            }

            const data = await response.json();
            let loadedContracts = data.contracts || [];

            // Client-side filtering

            if (statusFilter !== 'all') {
                loadedContracts = loadedContracts.filter((c: any) => {
                    if (statusFilter === 'completed') return (c.status === 'completed' || c.status === 'COMPLETED');
                    if (statusFilter === 'trash') return (c.status === 'trash' || c.status === 'deleted' || c.status === 'archived');
                    return (c.status !== 'completed' && c.status !== 'COMPLETED' && c.status !== 'trash' && c.status !== 'deleted' && c.status !== 'archived');
                });
            }

            setContracts(loadedContracts);
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.message || '데이터를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPointsBalance = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;
            const res = await fetch(`/api/points/balance?userId=${uid}`);
            const data = await res.json();
            if (data.balance !== undefined) setPointsBalance(data.balance);
        } catch (e) {
            console.error('Failed to fetch points', e);
        }
    };

    // Update useEffect to include fetchPointsBalance
    useEffect(() => {
        if (activeTab === 'signatures') {
            fetchData();
            fetchPointsBalance();
        }
    }, [activeTab, statusFilter]);

    // --- DETAIL PANEL HANDLERS (RESTORED) ---
    const openDetailPanel = async (contractId: string) => {
        setSelectedContractId(contractId);
        setIsPanelLoading(true);
        setDetailPanelData(null);

        if (!userId) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUserId(JSON.parse(storedUser).id);
        }

        try {
            const storedUser = localStorage.getItem('user');
            const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);

            if (!uid) return;

            const res = await fetch(`/api/contracts/${contractId}?userId=${uid}`);
            const data = await res.json();

            if (res.ok) {
                setDetailPanelData(data);
            } else {
                showAlert('유캔싸인 연동이 만료되었거나 정보를 불러올 수 없습니다. 다시 연동해주세요. \n우측상단 아이디 클릭 -> 개인정보수정에서 확인해주세요');
                setSelectedContractId(null);
            }
        } catch (e) {
            console.error(e);
            showAlert('상세 정보를 불러오는데 실패했습니다. 유캔싸인 연동 상태를 확인해주세요. \n우측상단 아이디 클릭 -> 개인정보수정');
            setSelectedContractId(null);
        } finally {
            setIsPanelLoading(false);
        }
    };

    const handlePanelAction = async (action: string, contractId: string) => {
        if (action === 'download') {
            handleDownload(contractId);
            return;
        }

        const processAction = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);
                if (!uid) return;

                const res = await fetch(`/api/contracts/actions?userId=${uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, contractId })
                });

                const data = await res.json();

                if (data.success) {
                    showAlert('요청이 성공적으로 처리되었습니다.');
                    setSelectedContractId(null);
                    fetchData();
                } else {
                    showAlert('요청 실패: ' + (data.error || '알 수 없는 오류'));
                }

            } catch (e) {
                console.error(e);
                showAlert('작업 처리 중 오류가 발생했습니다.');
            }
        };

        if (action === 'delete' || action === 'cancel' || action === 'restore' || action === 'permanent_delete' || action === 'extend_expiry') {
            let msg = '';
            switch (action) {
                case 'delete': msg = '정말 휴지통으로 이동하시겠습니까?'; break;
                case 'cancel': msg = '정말 서명 요청을 취소하시겠습니까?'; break;
                case 'restore': msg = '정말 복구하시겠습니까?'; break;
                case 'permanent_delete': msg = '정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'; break;
                case 'extend_expiry': msg = '유효기간을 30일 연장하시겠습니까?'; break;
            }
            showConfirm(msg, processAction);
        } else {
            processAction();
        }
    };

    const handleDownload = async (contractId: string) => {
        const newWindow = window.open('', '_blank');
        try {
            const storedUser = localStorage.getItem('user');
            const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);

            if (!uid) {
                if (newWindow) newWindow.close();
                showAlert('사용자 인증 정보가 없습니다.');
                return;
            }

            const res = await fetch(`/api/contracts/download?userId=${uid}&contractId=${contractId}`);
            const data = await res.json();

            if (data.url) {
                if (newWindow) newWindow.location.href = data.url;
                else window.location.href = data.url;
            } else {
                if (newWindow) newWindow.close();
                showAlert('다운로드 URL을 찾을 수 없습니다.');
            }
        } catch (e) {
            console.error(e);
            if (newWindow) newWindow.close();
            showAlert('다운로드 처리 중 오류가 발생했습니다.');
        }
    };

    const [showCreateModal, setShowCreateModal] = useState(false);

    // --- SELECTION LOGIC (Drafts) ---
    const toggleSelect = (id: string, e: React.SyntheticEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedIds(filteredDrafts.map(p => p.id));
        else setSelectedIds([]);
    };

    // --- BULK ACTIONS ---
    const handleBulkDownload = async () => {
        if (selectedIds.length === 0) return;

        showConfirm(`${selectedIds.length}개의 파일을 다운로드 하시겠습니까?`, async () => {
            try {
                const zip = new JSZip();
                const storedUser = localStorage.getItem('user');
                const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);
                if (!uid) return;

                showAlert('다운로드를 준비 중입니다. 잠시만 기다려주세요...');

                const promises = selectedIds.map(async (id) => {
                    const contract = savedProjects.find(p => p.id === id) || contracts.find(c => c.id === id);
                    const name = contract ? (contract.title || contract.documentName || id) : id;

                    try {
                        const res = await fetch(`/api/contracts/download?userId=${uid}&contractId=${id}`);
                        const data = await res.json();

                        if (data.url) {
                            const fileRes = await fetch(data.url);
                            const blob = await fileRes.blob();
                            zip.file(`${name}.pdf`, blob);
                        }
                    } catch (e) {
                        console.error(`Failed to download ${id}`, e);
                        zip.file(`${name}_error.txt`, `Failed to download: ${e}`);
                    }
                });

                await Promise.all(promises);
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `contracts_archive_${new Date().toISOString().slice(0, 10)}.zip`);

                closeAlert(); // Close the "preparing" alert
            } catch (e) {
                console.error(e);
                showAlert('일괄 다운로드 중 오류가 발생했습니다.');
            }
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;

        showConfirm(`${selectedIds.length}개의 프로젝트를 삭제하시겠습니까?`, async () => {
            try {
                const storedUser = localStorage.getItem('user');
                if (!storedUser) return;
                const uid = JSON.parse(storedUser).id;

                // Bulk delete via multiple API calls (or could add a bulk endpoint, but this is simple)
                const promises = selectedIds.map(id =>
                    fetch(`/api/projects/${id}?userId=${uid}`, { method: 'DELETE' })
                );

                await Promise.all(promises);

                // Optimistic update
                const newProjects = savedProjects.filter(p => !selectedIds.includes(p.id));
                setSavedProjects(newProjects);
                setSelectedIds([]);
                showAlert('삭제되었습니다.');

                // Re-fetch to be safe
                fetchSavedProjects();
            } catch (e) {
                console.error(e);
                showAlert('삭제 중 오류가 발생했습니다.');
            }
        });
    };

    // Filter helpers
    const filteredDrafts = savedProjects.filter(p =>
        p.title.includes(searchTerm) || p.participants.includes(searchTerm)
    );
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return { bg: '#e7f5ff', color: '#1c7ed6', label: '진행중' };
            case 'completed': return { bg: '#dcfce7', color: '#166534', label: '완료' };
            case 'COMPLETED': return { bg: '#dcfce7', color: '#166534', label: '완료' };
            case 'draft': return { bg: '#f8f9fa', color: '#868e96', label: '진행예정' };
            case 'trash': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'deleted': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'archived': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'canceled': return { bg: '#f1f3f5', color: '#868e96', label: '취소됨' };
            case 'rejected': return { bg: '#fff5f5', color: '#fa5252', label: '거절됨' };
            default: return { bg: '#f1f3f5', color: '#495057', label: status };
        }
    };

    const filteredSignatures = contracts.filter(c =>
        !signatureSearchTerm || (c.documentName && c.documentName.toLowerCase().includes(signatureSearchTerm.toLowerCase()))
    );

    return (
        <div className={styles.container}>
            {/* GLOBAL HEADER */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>계약 관리</h1>
                    <p className={styles.subtitle}>프로젝트 및 전자계약 통합 관리</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    {activeTab === 'signatures' && (
                        <>
                            <button
                                className={styles.createBtn}
                                style={{ backgroundColor: 'white', color: '#1c7ed6', border: '1px solid #d0ebff' }}
                                onClick={() => setShowPointsModal(true)}
                            >
                                <CreditCard size={16} />
                                {pointsBalance !== null ? `${pointsBalance.toLocaleString()} P` : '포인트'}
                            </button>
                            {/* EMBED CREATE BUTTON */}
                            <button
                                className={styles.createBtn}
                                style={{ backgroundColor: '#fcc419', color: '#fff', border: 'none' }}
                                onClick={handleEmbedCreate}
                                title="임베딩 모드로 생성 테스트"
                            >
                                <Layout size={16} /> 전자계약 생성
                            </button>
                        </>
                    )}

                    {activeTab === 'drafts' && (
                        <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                            <Plus size={16} /> 새 프로젝트 생성
                        </button>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className={styles.tabs}>
                <div
                    className={activeTab === 'drafts' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('drafts')}
                >
                    <PenTool size={16} />
                    <span>프로젝트</span>
                </div>
                <div
                    className={activeTab === 'signatures' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('signatures')}
                >
                    <CheckCircle2 size={16} />
                    <span>전자 서명/완료 목록</span>
                </div>
            </div>

            {/* TAB CONTENT: SAVED DRAFTS */}
            {activeTab === 'drafts' && (
                <div>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={16} color="#adb5bd" />
                            <input
                                type="text"
                                placeholder="프로젝트명, 참여자 검색..."
                                className={styles.input}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {selectedIds.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleBulkDownload}
                                    className={styles.createBtn}
                                    style={{
                                        backgroundColor: 'white',
                                        color: '#228be6',
                                        border: '1px solid #228be6',
                                        padding: '8px 12px'
                                    }}
                                >
                                    <DownloadIcon size={16} /> 선택 다운로드
                                </button>
                                <button
                                    onClick={handleDeleteSelected}
                                    className={styles.createBtn}
                                    style={{
                                        backgroundColor: '#fff5f5',
                                        color: '#fa5252',
                                        border: '1px solid #ffc9c9',
                                        padding: '8px 12px'
                                    }}
                                >
                                    <TrashIcon size={16} /> 선택 삭제 ({selectedIds.length})
                                </button>
                            </div>
                        )}
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr className={styles.theadRow}>
                                    <th className={styles.th} style={{ width: '40px' }}>
                                        <input type="checkbox" onChange={toggleSelectAll} checked={filteredDrafts.length > 0 && selectedIds.length === filteredDrafts.length} />
                                    </th>
                                    <th className={styles.th}>계약명</th>
                                    <th className={styles.th}>카테고리</th>
                                    <th className={styles.th}>문서 수</th>
                                    <th className={styles.th}>참여자</th>
                                    <th className={styles.th}>상태</th>
                                    <th className={styles.th}>최근 수정일</th>
                                    <th className={styles.th} style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDrafts.length > 0 ? (
                                    filteredDrafts.map(project => {
                                        const badge = getStatusBadge(project.status);
                                        return (
                                            <tr key={project.id} className={styles.tr} onClick={() => router.push(`/contracts/project/${project.id}`)}>
                                                <td className={styles.td}>
                                                    <input type="checkbox" checked={selectedIds.includes(project.id)} onChange={(e) => toggleSelect(project.id, e)} onClick={(e) => e.stopPropagation()} />
                                                </td>
                                                <td className={styles.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div className={styles.iconBox}><Folder size={16} color="#495057" /></div>
                                                        <span style={{ fontWeight: 600, color: '#343a40' }}>{project.title}</span>
                                                    </div>
                                                </td>
                                                <td className={styles.td}>{project.category}</td>
                                                <td className={styles.td}><span className={styles.docCount}><FileText size={12} /> {Array.isArray(project.documents) ? project.documents.length : 0}건</span></td>
                                                <td className={styles.td}>{project.participants}</td>
                                                <td className={styles.td}><span className={styles.badge} style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span></td>
                                                <td className={styles.td} style={{ color: '#868e96' }}>{new Date(project.updatedAt).toLocaleDateString()}</td>
                                                <td className={styles.td}>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button className={styles.actionBtn}><ChevronRight size={16} color="#adb5bd" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: '#868e96' }}>검색 결과가 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SIGNATURES (NEW DASHBOARD) */}
            {activeTab === 'signatures' && (
                <div className={styles.dashboardLayout}>
                    {/* LEFT FILTER SIDEBAR */}
                    <div className={styles.filterSidebar}>
                        <div className={styles.filterGroup}>
                            <h3 className={styles.filterTitle}><Filter size={14} /> 상태 필터</h3>
                            <button
                                onClick={() => { setStatusFilter('all'); }}
                                className={statusFilter === 'all' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                전체 보기
                            </button>
                            <button
                                onClick={() => { setStatusFilter('progress'); }}
                                className={statusFilter === 'progress' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                진행 중
                            </button>
                            <button
                                onClick={() => { setStatusFilter('completed'); }}
                                className={statusFilter === 'completed' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                완료됨
                            </button>
                            <button
                                onClick={() => { setStatusFilter('trash'); }}
                                className={statusFilter === 'trash' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                휴지통
                            </button>
                        </div>
                    </div>

                    {/* RIGHT MAIN LIST */}
                    <div className={styles.mainListArea}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div className={styles.searchBox}>
                                <Search size={16} color="#adb5bd" />
                                <input
                                    type="text"
                                    placeholder="문서명 검색..."
                                    className={styles.input}
                                    value={signatureSearchTerm}
                                    onChange={(e) => setSignatureSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={fetchData}
                                style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                <RefreshCcw size={14} /> 새로고침
                            </button>
                        </div>

                        {needAuth ? (
                            <div style={{ padding: '40px', background: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <AlertCircle size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>서비스 연동 필요</h2>
                                <button onClick={() => window.location.href = `/api/ucansign/auth?userId=${userId}`} style={{ padding: '10px 20px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    유캔싸인 연동하기
                                </button>
                            </div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr className={styles.theadRow}>
                                            <th className={styles.th}>문서명</th>
                                            <th className={styles.th}>상태</th>
                                            <th className={styles.th}>작성일</th>
                                            <th className={styles.th} style={{ textAlign: 'right' }}>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSignatures.length === 0 ? (
                                            <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: '#868e96' }}>데이터가 없습니다.</td></tr>
                                        ) : (
                                            filteredSignatures.map((contract) => (
                                                <tr key={contract.id} className={styles.tr} onClick={() => openDetailPanel(contract.id!)}>
                                                    <td className={styles.td}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div className={styles.iconBox} style={{ backgroundColor: '#e7f5ff', color: '#1864ab' }}>
                                                                <FileText size={16} />
                                                            </div>
                                                            <span style={{ fontWeight: 600, color: '#343a40' }}>{contract.documentName || '이름 없음'}</span>
                                                        </div>
                                                    </td>
                                                    <td className={styles.td}>
                                                        <span style={{
                                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                                            background: (contract.status === 'completed' || contract.status === 'COMPLETED') ? '#dcfce7' : '#e0f2fe',
                                                            color: (contract.status === 'completed' || contract.status === 'COMPLETED') ? '#166534' : '#075985'
                                                        }}>
                                                            {contract.status === 'completed' || contract.status === 'COMPLETED' ? '완료됨' : '진행중'}
                                                        </span>
                                                    </td>
                                                    <td className={styles.td} style={{ color: '#868e96' }}>
                                                        {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className={styles.td} style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                className={styles.iconBtn}
                                                                style={{
                                                                    color: '#fcc419',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    width: 'auto',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: '4px 8px',
                                                                    border: '1px solid #fcc419',
                                                                    borderRadius: '4px',
                                                                    backgroundColor: '#fff9db'
                                                                }}
                                                                onClick={(e) => { e.stopPropagation(); handleEmbedView(contract.id!); }}
                                                                title="임베딩 뷰어로 보기"
                                                            >
                                                                <Layout size={14} /> 문서확인
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SLIDE-OVER DETAIL PANEL */}
            {selectedContractId && (
                <ContractDetailPanel
                    contract={detailPanelData}
                    loading={isPanelLoading}
                    onClose={() => setSelectedContractId(null)}
                    onAction={handlePanelAction}
                />
            )}

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

            {/* Other Modals */}
            {showPointsModal && (
                <PointsModal
                    isOpen={showPointsModal}
                    onClose={() => setShowPointsModal(false)}
                />
            )}

            {showCreateModal && (
                <CreateProjectModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={refreshAll}
                />
            )}
        </div>
    );
}

export default function ContractsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ContractsPageContent />
        </Suspense>
    );
}
