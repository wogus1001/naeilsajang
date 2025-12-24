"use client";

import React, { useEffect, useState } from 'react';
import { Contract } from '@/lib/ucansign/client';
import {
    FileText, Plus, RefreshCw, AlertCircle, Search,
    Folder, ChevronRight, Layout, PenTool, CheckCircle2,
    Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CreateProjectModal from './_components/CreateProjectModal';
import PointsModal from './_components/PointsModal';
import MoveToFolderModal from './_components/MoveToFolderModal';
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

export default function ContractsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'drafts' | 'signatures'>('drafts');

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

    // --- FOLDER STATE ---
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // --- POINTS STATE ---
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [pointsBalance, setPointsBalance] = useState<number | null>(null);

    // --- NEW LOGIC STATE (Drafts) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [savedProjects, setSavedProjects] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // --- DATA FETCHING ---
    const fetchSavedProjects = () => {
        const loaded: any[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('project_data_')) {
                try {
                    const data = localStorage.getItem(key);
                    if (data) loaded.push(JSON.parse(data));
                } catch (e) {
                    console.error('Failed to parse project', key, e);
                }
            }
        }
        setSavedProjects(loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

    const fetchFolders = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;
            const res = await fetch(`/api/folders?userId=${uid}`);
            const data = await res.json();
            if (Array.isArray(data)) setFolders(data);
        } catch (e) {
            console.error('Failed to fetch folders', e);
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt('새 폴더 이름을 입력하세요:');
        if (!name) return;

        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, name })
            });

            if (res.ok) {
                fetchFolders();
            } else {
                alert('폴더 생성 실패');
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    const handleRenameFolder = async (folderId: string, currentName: string) => {
        const name = prompt('변경할 폴더 이름을 입력하세요:', currentName);
        if (!name || name === currentName) return;

        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const res = await fetch(`/api/folders/${folderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, name })
            });

            if (res.ok) fetchFolders();
            else alert('이름 변경 실패');
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('정말 이 폴더를 삭제하시겠습니까?')) return;

        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            console.log(`[Frontend] Deleting folder: ${folderId}`);
            const res = await fetch(`/api/folders/${folderId}?userId=${uid}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('폴더가 삭제되었습니다.');
                if (selectedFolderId === folderId) setSelectedFolderId(null);
                fetchFolders();
            } else {
                const err = await res.json();
                console.error('[Frontend] Delete failed:', err);
                alert('폴더 삭제 실패: ' + (err.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveTargetIds, setMoveTargetIds] = useState<string[]>([]);

    // Updated handleMoveToFolder (triggers modal)
    const handleMoveToFolder = (targetIds?: string[]) => {
        const idsToMove = targetIds || selectedIds;
        if (idsToMove.length === 0) {
            alert('이동할 문서를 선택해주세요.');
            return;
        }

        // Check if any selected ID is a draft (local mock)
        const hasDrafts = idsToMove.some(id => savedProjects.some(p => p.id === id));
        if (hasDrafts && activeTab === 'drafts') {
            alert('작성 중인(Draft) 문서는 서버 폴더로 이동할 수 없습니다.');
            return;
        }

        setMoveTargetIds(idsToMove);
        setIsMoveModalOpen(true);
    };

    // Actual API call executed by Modal
    const executeMoveToFolder = async (folderId: string) => {
        console.log('[Frontend] executeMoveToFolder:', { folderId, moveTargetIds });
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const payload = { userId: uid, documentIds: moveTargetIds };
            console.log('[Frontend] Sending payload:', payload);

            const res = await fetch(`/api/folders/${folderId}/documents`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Ensure userId is passed and body matches API
            });

            console.log('[Frontend] Response status:', res.status);

            if (res.ok) {
                alert('이동되었습니다.');
                setIsMoveModalOpen(false);
                setMoveTargetIds([]);
                setSelectedIds([]); // Clear selection
                fetchData(); // Refresh
            } else {
                const errData = await res.json();
                console.error('[Frontend] Move failed:', errData);
                alert('이동 실패: ' + (errData.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

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
                alert('임베딩 URL 생성 실패: ' + (data.error || 'Unknown'));
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
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
                alert('임베딩 URL 생성 실패: ' + (data.error || 'Unknown'));
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
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
            if (selectedFolderId) {
                loadedContracts = loadedContracts.filter((c: any) => String(c.folderId) === String(selectedFolderId));
            } else if (statusFilter !== 'all') {
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
            fetchFolders();
            fetchPointsBalance();
        }
    }, [activeTab, statusFilter, selectedFolderId]);

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
                alert('상세 정보를 불러오는데 실패했습니다.');
                setSelectedContractId(null);
            }
        } catch (e) {
            console.error(e);
            alert('상세 정보를 불러오는데 실패했습니다.');
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

        if (action === 'delete' || action === 'cancel' || action === 'restore' || action === 'permanent_delete' || action === 'extend_expiry') {
            let msg = '';
            switch (action) {
                case 'delete': msg = '정말 휴지통으로 이동하시겠습니까?'; break;
                case 'cancel': msg = '정말 서명 요청을 취소하시겠습니까?'; break;
                case 'restore': msg = '정말 복구하시겠습니까?'; break;
                case 'permanent_delete': msg = '정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'; break;
                case 'extend_expiry': msg = '유효기간을 30일 연장하시겠습니까?'; break;
            }
            if (!confirm(msg)) return;
        }

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
                alert('요청이 성공적으로 처리되었습니다.');
                setSelectedContractId(null);
                fetchData();
            } else {
                alert('요청 실패: ' + (data.error || '알 수 없는 오류'));
            }

        } catch (e) {
            console.error(e);
            alert('작업 처리 중 오류가 발생했습니다.');
        }
    };

    const handleDownload = async (contractId: string) => {
        const newWindow = window.open('', '_blank');
        try {
            const storedUser = localStorage.getItem('user');
            const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);

            if (!uid) {
                if (newWindow) newWindow.close();
                alert('사용자 인증 정보가 없습니다.');
                return;
            }

            const res = await fetch(`/api/contracts/download?userId=${uid}&contractId=${contractId}`);
            const data = await res.json();

            if (data.url) {
                if (newWindow) newWindow.location.href = data.url;
                else window.location.href = data.url;
            } else {
                if (newWindow) newWindow.close();
                alert('다운로드 URL을 찾을 수 없습니다.');
            }
        } catch (e) {
            console.error(e);
            if (newWindow) newWindow.close();
            alert('다운로드 처리 중 오류가 발생했습니다.');
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
        if (!confirm(`${selectedIds.length}개의 파일을 다운로드 하시겠습니까?`)) return;

        try {
            const zip = new JSZip();
            const storedUser = localStorage.getItem('user');
            const uid = userId || (storedUser ? JSON.parse(storedUser).id : null);
            if (!uid) return;

            alert('다운로드를 준비 중입니다. 잠시만 기다려주세요...');

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

        } catch (e) {
            console.error(e);
            alert('일괄 다운로드 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteSelected = () => {
        if (!confirm(`${selectedIds.length}개의 프로젝트를 삭제하시겠습니까?`)) return;
        const projectsToDelete = savedProjects.filter(p => selectedIds.includes(p.id));
        projectsToDelete.forEach(p => {
            if (p._storageKey) localStorage.removeItem(p._storageKey);
            else localStorage.removeItem(`project_data_${p.id}`);
        });
        const newProjects = savedProjects.filter(p => !selectedIds.includes(p.id));
        setSavedProjects(newProjects);
        setSelectedIds([]);
        alert('삭제되었습니다.');
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
            case 'draft': return { bg: '#f8f9fa', color: '#868e96', label: '작성중' };
            case 'trash': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'deleted': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'archived': return { bg: '#ffe3e3', color: '#fa5252', label: '휴지통' };
            case 'canceled': return { bg: '#f1f3f5', color: '#868e96', label: '취소됨' };
            case 'rejected': return { bg: '#fff5f5', color: '#fa5252', label: '거절됨' };
            default: return { bg: '#f1f3f5', color: '#495057', label: status };
        }
    };

    return (
        <div style={styles.container}>
            {/* GLOBAL HEADER */}
            <div style={styles.header}>
                {/* Batch Actions */}
                {selectedIds.length > 0 && (
                    <div style={styles.batchActions}>
                        <span style={styles.selectedCount}>{selectedIds.length}개 선택됨</span>
                        <div style={styles.batchBtnGroup}>
                            <button style={styles.batchBtn} onClick={() => handleMoveToFolder()}>
                                <Folder size={14} /> 폴더 이동
                            </button>
                            <button style={styles.batchBtn} onClick={handleBulkDownload}>
                                <DownloadIcon size={14} /> 선택 다운로드
                            </button>
                            <button style={{ ...styles.batchBtn, color: '#fa5252', borderColor: '#fa5252' }} onClick={handleDeleteSelected}>
                                <TrashIcon size={14} /> 선택 삭제
                            </button>
                        </div>
                    </div>
                )}
                <div>

                    <h1 style={styles.title}>계약 관리</h1>
                    <p style={styles.subtitle}>프로젝트 및 전자계약 통합 관리</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        style={{ ...styles.createBtn, backgroundColor: 'white', color: '#1c7ed6', border: '1px solid #d0ebff' }}
                        onClick={() => setShowPointsModal(true)}
                    >
                        <CreditCard size={16} />
                        {pointsBalance !== null ? `${pointsBalance.toLocaleString()} P` : '포인트'}
                    </button>
                    {/* EMBED CREATE BUTTON */}
                    <button
                        style={{ ...styles.createBtn, backgroundColor: '#fcc419', color: '#fff', border: 'none' }}
                        onClick={handleEmbedCreate}
                        title="임베딩 모드로 생성 테스트"
                    >
                        <Layout size={16} /> 임베딩 생성
                    </button>
                    <button style={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} /> 새 프로젝트 생성
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div style={styles.tabs}>
                <div
                    style={activeTab === 'drafts' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('drafts')}
                >
                    <PenTool size={16} />
                    <span>프로젝트</span>
                </div>
                <div
                    style={activeTab === 'signatures' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('signatures')}
                >
                    <CheckCircle2 size={16} />
                    <span>전자 서명/완료 목록</span>
                </div>
            </div>

            {/* TAB CONTENT: SAVED DRAFTS (UNCHANGED UI, just keeping it here) */}
            {activeTab === 'drafts' && (
                <div>
                    <div style={styles.toolbar}>
                        <div style={styles.searchBox}>
                            <Search size={16} color="#adb5bd" />
                            <input
                                type="text"
                                placeholder="프로젝트명, 참여자 검색..."
                                style={styles.input}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleDeleteSelected}
                                style={{ ...styles.createBtn, backgroundColor: '#fff5f5', color: '#fa5252', border: '1px solid #ffc9c9' }}
                            >
                                <TrashIcon size={16} /> 선택 삭제 ({selectedIds.length})
                            </button>
                        )}
                    </div>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.theadRow}>
                                    <th style={{ ...styles.th, width: '40px' }}>
                                        <input type="checkbox" onChange={toggleSelectAll} checked={filteredDrafts.length > 0 && selectedIds.length === filteredDrafts.length} />
                                    </th>
                                    <th style={styles.th}>계약명</th>
                                    <th style={styles.th}>카테고리</th>
                                    <th style={styles.th}>문서 수</th>
                                    <th style={styles.th}>참여자</th>
                                    <th style={styles.th}>상태</th>
                                    <th style={styles.th}>최근 수정일</th>
                                    <th style={{ ...styles.th, width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDrafts.length > 0 ? (
                                    filteredDrafts.map(project => {
                                        const badge = getStatusBadge(project.status);
                                        return (
                                            <tr key={project.id} style={styles.tr} onClick={() => router.push(`/contracts/project/${project.id}`)}>
                                                <td style={styles.td}>
                                                    <input type="checkbox" checked={selectedIds.includes(project.id)} onChange={(e) => toggleSelect(project.id, e)} onClick={(e) => e.stopPropagation()} />
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={styles.iconBox}><Folder size={16} color="#495057" /></div>
                                                        <span style={{ fontWeight: 600, color: '#343a40' }}>{project.title}</span>
                                                    </div>
                                                </td>
                                                <td style={styles.td}>{project.category}</td>
                                                <td style={styles.td}><span style={styles.docCount}><FileText size={12} /> {Array.isArray(project.documents) ? project.documents.length : 0}건</span></td>
                                                <td style={styles.td}>{project.participants}</td>
                                                <td style={styles.td}><span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span></td>
                                                <td style={{ ...styles.td, color: '#868e96' }}>{new Date(project.updatedAt).toLocaleDateString()}</td>
                                                <td style={styles.td}>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            style={{ ...styles.actionBtn, padding: '4px' }}
                                                            onClick={(e) => { e.stopPropagation(); handleMoveToFolder([project.id]); }}
                                                            title="폴더 이동"
                                                        >
                                                            <Folder size={14} color="#868e96" />
                                                        </button>
                                                        <button style={styles.actionBtn}><ChevronRight size={16} color="#adb5bd" /></button>
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
                <div style={styles.dashboardLayout}>
                    {/* LEFT FILTER SIDEBAR */}
                    <div style={styles.filterSidebar}>
                        <div style={styles.filterGroup}>
                            <h3 style={styles.filterTitle}><Filter size={14} /> 상태 필터</h3>
                            <button
                                onClick={() => { setStatusFilter('all'); setSelectedFolderId(null); }}
                                style={(statusFilter === 'all' && !selectedFolderId) ? styles.filterBtnActive : styles.filterBtn}
                            >
                                전체 보기
                            </button>
                            <button
                                onClick={() => { setStatusFilter('progress'); setSelectedFolderId(null); }}
                                style={statusFilter === 'progress' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                진행 중
                            </button>
                            <button
                                onClick={() => { setStatusFilter('completed'); setSelectedFolderId(null); }}
                                style={statusFilter === 'completed' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                완료됨
                            </button>
                            <button
                                onClick={() => { setStatusFilter('trash'); setSelectedFolderId(null); }}
                                style={statusFilter === 'trash' ? styles.filterBtnActive : styles.filterBtn}
                            >
                                휴지통
                            </button>
                        </div>

                        {/* FOLDER SECTION */}
                        <div style={styles.filterGroup}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ ...styles.filterTitle, margin: 0 }}><Folder size={14} /> 폴더</h3>
                                <button
                                    onClick={handleCreateFolder}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#228be6',
                                        padding: '4px', display: 'flex', alignItems: 'center'
                                    }}
                                    title="새 폴더 만들기"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            {folders.length === 0 ? (
                                <div style={{ fontSize: '13px', color: '#adb5bd', padding: '8px 0' }}>폴더가 없습니다.</div>
                            ) : (
                                folders.map(folder => (
                                    <div
                                        key={folder.folderId}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}
                                    >
                                        <button
                                            onClick={() => { setSelectedFolderId(folder.folderId); setStatusFilter('all'); }}
                                            style={selectedFolderId === folder.folderId ? styles.filterBtnActive : styles.filterBtn}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Folder size={14} fill={selectedFolderId === folder.folderId ? "#a5d8ff" : "none"} />
                                                {folder.name}
                                            </span>
                                        </button>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.folderId, folder.name); }}
                                                style={{ ...styles.iconBtn, opacity: 0.6 }}
                                                title="이름 변경"
                                            >
                                                <PenTool size={10} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.folderId); }}
                                                style={{ ...styles.iconBtn, color: '#fa5252', opacity: 0.6 }}
                                                title="삭제"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT MAIN LIST */}
                    <div style={styles.mainListArea}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={styles.searchBox}>
                                <Search size={16} color="#adb5bd" />
                                <input type="text" placeholder="문서명 검색..." style={styles.input} />
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
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.theadRow}>
                                            <th style={styles.th}>문서명</th>
                                            <th style={styles.th}>상태</th>
                                            <th style={styles.th}>작성일</th>
                                            <th style={{ ...styles.th, textAlign: 'right' }}>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contracts.length === 0 ? (
                                            <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: '#868e96' }}>데이터가 없습니다.</td></tr>
                                        ) : (
                                            contracts.map((contract) => (
                                                <tr key={contract.id} style={styles.tr} onClick={() => openDetailPanel(contract.id!)}>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ ...styles.iconBox, backgroundColor: '#e7f5ff', color: '#1864ab' }}>
                                                                <FileText size={16} />
                                                            </div>
                                                            <span style={{ fontWeight: 600, color: '#343a40' }}>{contract.documentName || '이름 없음'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <span style={{
                                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                                            background: (contract.status === 'completed' || contract.status === 'COMPLETED') ? '#dcfce7' : '#e0f2fe',
                                                            color: (contract.status === 'completed' || contract.status === 'COMPLETED') ? '#166534' : '#075985'
                                                        }}>
                                                            {contract.status === 'completed' || contract.status === 'COMPLETED' ? '완료됨' : '진행중'}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...styles.td, color: '#868e96' }}>
                                                        {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td style={{ ...styles.td, textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                style={{ ...styles.iconBtn, color: '#495057' }}
                                                                onClick={(e) => { e.stopPropagation(); handleMoveToFolder([contract.id!]); }}
                                                                title="폴더 이동"
                                                            >
                                                                <Folder size={16} />
                                                            </button>
                                                            <button
                                                                style={{ ...styles.iconBtn, color: '#fcc419' }}
                                                                onClick={(e) => { e.stopPropagation(); handleEmbedView(contract.id!); }}
                                                                title="임베딩 뷰어로 보기"
                                                            >
                                                                <Layout size={16} />
                                                            </button>
                                                            <button style={styles.iconBtn} onClick={(e) => { e.stopPropagation(); /* Menu */ }}>
                                                                <MoreHorizontal size={16} />
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

            {/* Render Modal */}
            <MoveToFolderModal
                isOpen={isMoveModalOpen}
                onClose={() => setIsMoveModalOpen(false)}
                onMove={executeMoveToFolder}
                folders={folders}
                selectedCount={moveTargetIds.length}
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

const styles = {
    container: { padding: '30px', maxWidth: '1400px', margin: '0 auto' }, // Wider for dashboard
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { fontSize: '24px', fontWeight: '700', color: '#212529', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: '#868e96' },
    createBtn: { backgroundColor: '#228be6', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
    tabs: { display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid #dee2e6' },
    tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', cursor: 'pointer', color: '#868e96', fontSize: '15px', fontWeight: 500, borderBottom: '2px solid transparent' },
    tabActive: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', cursor: 'pointer', color: '#228be6', fontSize: '15px', fontWeight: 600, borderBottom: '2px solid #228be6' },
    toolbar: { display: 'flex', marginBottom: '16px', gap: '12px' },
    searchBox: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '6px', padding: '8px 12px', width: '300px' },
    input: { border: 'none', outline: 'none', fontSize: '14px', width: '100%' },
    tableWrapper: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e9ecef', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
    theadRow: { backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' },
    th: { padding: '12px 16px', textAlign: 'left' as const, fontWeight: 600, color: '#495057' },
    tr: { borderBottom: '1px solid #f1f3f5', cursor: 'pointer', transition: 'background 0.1s' },
    td: { padding: '16px', color: '#495057' },
    iconBox: { width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    docCount: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#868e96' },
    badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
    actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },
    iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#adb5bd', padding: '4px' },

    // Dashboard Specific Logic
    dashboardLayout: { display: 'flex', gap: '24px', minHeight: '600px' },
    filterSidebar: { width: '240px', display: 'flex', flexDirection: 'column' as const, gap: '24px' },
    filterGroup: { backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #f1f3f5' },
    filterTitle: { margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#868e96', display: 'flex', alignItems: 'center', gap: '6px' },
    filterBtn: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '8px 12px', background: 'none', border: 'none', borderRadius: '6px', fontSize: '14px', color: '#495057', cursor: 'pointer', marginBottom: '4px' },
    filterBtnActive: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '8px 12px', background: '#e7f5ff', border: 'none', borderRadius: '6px', fontSize: '14px', color: '#1971c2', fontWeight: 600, marginBottom: '4px' },
    mainListArea: { flex: 1, backgroundColor: 'white', borderRadius: '8px', border: '1px solid #eee', display: 'flex', flexDirection: 'column' as const },

    batchActions: { display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#e7f5ff', padding: '8px 16px', borderRadius: '6px', marginLeft: 'auto' },
    selectedCount: { fontSize: '13px', fontWeight: 600, color: '#1971c2' },
    batchBtnGroup: { display: 'flex', gap: '8px' },
    batchBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px', border: '1px solid #a5d8ff', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#1971c2' },
};
