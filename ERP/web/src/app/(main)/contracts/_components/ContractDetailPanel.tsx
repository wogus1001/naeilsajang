"use client";

import React, { useState } from 'react';
import {
    X, FileText, Calendar, User, Clock, Download, Trash2,
    Ban, Send, ShieldCheck, MoreVertical, CheckCircle2, History, RefreshCcw
} from 'lucide-react';
import { AlertModal } from '@/components/common/AlertModal';

interface ContractDetailPanelProps {
    contract: any;
    onClose: () => void;
    onAction: (action: string, contractId: string) => void;
    loading?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    'completed': { label: '서명 완료', color: '#166534', bg: '#dcfce7' },
    'COMPLETED': { label: '서명 완료', color: '#166534', bg: '#dcfce7' },
    'progress': { label: '서명 진행중', color: '#1c7ed6', bg: '#e7f5ff' },
    'WAITING': { label: '서명 대기', color: '#d97706', bg: '#fef3c7' },
    'draft': { label: '진행예정', color: '#495057', bg: '#f8f9fa' },
    'canceled': { label: '취소됨', color: '#c92a2a', bg: '#ffe3e3' },
    'trash': { label: '휴지통', color: '#fa5252', bg: '#ffe3e3' },
    'deleted': { label: '삭제됨', color: '#868e96', bg: '#f1f3f5' },
};

export default function ContractDetailPanel({ contract, onClose, onAction, loading }: ContractDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'history' | 'attachments'>('info');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [attachmentsData, setAttachmentsData] = useState<any[]>([]);
    const [loadingTab, setLoadingTab] = useState(false);

    // Modal State
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', title: '' });

    const showAlert = (message: string, title?: string) => {
        setAlertConfig({ isOpen: true, message, title: title || '알림' });
    };

    const closeAlert = () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    const statusInfo = contract ? (STATUS_MAP[contract.status] || { label: contract.status, color: '#495057', bg: '#f1f3f5' }) : { label: '', color: '', bg: '' };
    const isTrash = contract ? (contract.status === 'trash' || contract.status === 'deleted') : false;

    // Fetch tab data when active tab changes
    const fetchTabData = async (tab: string) => {
        if (!contract?.id && !contract?.documentId) return;
        const cid = contract.id || contract.documentId;
        const storedUser = localStorage.getItem('user');
        const userId = storedUser ? JSON.parse(storedUser).id : null;

        if (!userId) return;

        setLoadingTab(true);
        try {
            if (tab === 'history') {
                const res = await fetch(`/api/contracts/${cid}/history?userId=${userId}`);
                const data = await res.json();
                if (Array.isArray(data)) setHistoryData(data);
            } else if (tab === 'attachments') {
                const res = await fetch(`/api/contracts/${cid}/attachments?userId=${userId}`);
                const data = await res.json();
                if (Array.isArray(data)) setAttachmentsData(data);
            }
        } catch (e) {
            console.error(`Failed to fetch ${tab}`, e);
        } finally {
            setLoadingTab(false);
        }
    };

    // Trigger fetch on tab switch
    React.useEffect(() => {
        if (activeTab === 'history' || activeTab === 'attachments') {
            fetchTabData(activeTab);
        }
    }, [activeTab, contract]);

    const handleDownload = async (type: 'document' | 'audit-trail' | 'full-file' | 'attachment', attachmentId?: string) => {
        const storedUser = localStorage.getItem('user');
        const userId = storedUser ? JSON.parse(storedUser).id : null;
        const cid = contract?.id || contract?.documentId; // Safe access

        if (!userId || !cid) return;

        // Open new window immediately
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('Loading download...');
        }

        try {
            let url = `/api/contracts/download?userId=${userId}&contractId=${cid}&type=${type}`;
            if (attachmentId) url += `&attachmentId=${attachmentId}`;

            console.log(`[Frontend] Fetching download URL: ${url}`);
            const res = await fetch(url);

            if (!res.ok) {
                console.error(`[Frontend] Download API failed with status: ${res.status}`);
                const text = await res.text();
                console.error(`[Frontend] Error body: ${text}`);
                if (newWindow) newWindow.document.write(`Download failed: Server returned ${res.status}`);
                showAlert('다운로드 링크를 가져오지 못했습니다. (서버 오류)');
                return;
            }

            const text = await res.text();
            if (!text) {
                console.error('[Frontend] Empty response from server');
                if (newWindow) newWindow.document.write('Download failed: Empty response');
                showAlert('서버로부터 응답이 없습니다.');
                return;
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonError) {
                console.error('[Frontend] JSON Parse Error:', jsonError, 'Response:', text);
                if (newWindow) newWindow.document.write(`Download failed: Invalid API response`);
                showAlert('서버 응답 형식이 올바르지 않습니다.');
                return;
            }

            if (data.url && newWindow) {
                newWindow.location.href = data.url;
            } else {
                console.warn('[Frontend] No URL in data:', data);
                if (newWindow) newWindow.document.write(data.error || 'Download failed: File not found.');
                showAlert(data.error || '다운로드 링크를 찾을 수 없습니다.');
            }
        } catch (e) {
            console.error('[Frontend] HandleDownload Exception:', e);
            if (newWindow) newWindow.close();
            showAlert('다운로드 중 스크립트 오류가 발생했습니다.');
        }
    };

    if (!contract) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={{ flex: 1 }}>
                        <div style={styles.statusBadgeWrapper}>
                            <span style={{ ...styles.statusBadge, color: statusInfo.color, backgroundColor: statusInfo.bg }}>
                                {statusInfo.label}
                            </span>
                            {contract.id && <span style={styles.idBadge}>ID: {contract.id}</span>}
                        </div>
                        <h2 style={styles.title}>{contract.documentName || contract.name}</h2>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                {/* Toolbar */}
                <div style={styles.toolbar}>
                    {isTrash ? (
                        <>
                            <button style={styles.actionBtn} onClick={() => onAction('restore', contract.id)}>
                                <RefreshCcw size={16} /> 복구
                            </button>
                            <button style={{ ...styles.actionBtn, color: '#fa5252' }} onClick={() => onAction('permanent_delete', contract.id)}>
                                <Ban size={16} /> 영구 삭제
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Standard Download */}
                            <button style={styles.actionBtn} onClick={() => handleDownload('document')}>
                                <Download size={16} /> 문서
                            </button>
                            <button style={styles.actionBtn} onClick={() => handleDownload('audit-trail')}>
                                <ShieldCheck size={16} /> 감사추적
                            </button>
                            <button style={styles.actionBtn} onClick={() => handleDownload('full-file')}>
                                <FileText size={16} /> 통합본
                            </button>

                            {contract.status !== 'completed' && contract.status !== 'canceled' && contract.status !== 'COMPLETED' && (
                                <>
                                    <button style={styles.actionBtn} onClick={() => onAction('cancel', contract.id)}>
                                        <Ban size={16} /> 요청 취소
                                    </button>
                                    <button style={styles.actionBtn} onClick={() => onAction('remind', contract.id)}>
                                        <Send size={16} /> 재알림
                                    </button>
                                    <button style={styles.actionBtn} onClick={() => onAction('extend_expiry', contract.id)}>
                                        <Calendar size={16} /> 기한 연장
                                    </button>
                                </>
                            )}
                            <button style={{ ...styles.actionBtn, color: '#fa5252' }} onClick={() => onAction('delete', contract.id)}>
                                <Trash2 size={16} /> 삭제
                            </button>
                        </>
                    )}
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {['info', 'participants', 'history', 'attachments'].map(tab => (
                        <button
                            key={tab}
                            style={activeTab === tab ? styles.tabActive : styles.tab}
                            onClick={() => setActiveTab(tab as any)}
                        >
                            {tab === 'info' && '기본 정보'}
                            {tab === 'participants' && `참여자 (${contract.participants?.length || 0})`}
                            {tab === 'history' && '이력'}
                            {tab === 'attachments' && `첨부 파일`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {loading ? (
                        <div style={styles.loading}>정보를 불러오는 중...</div>
                    ) : (
                        <>
                            {activeTab === 'info' && (
                                <div style={styles.section}>
                                    <h3 style={styles.sectionTitle}>문서 정보</h3>
                                    <div style={styles.infoRow}>
                                        <span style={styles.label}>생성일</span>
                                        <span style={styles.value}>{new Date(contract.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div style={styles.infoRow}>
                                        <span style={styles.label}>최근 수정</span>
                                        <span style={styles.value}>{new Date(contract.updatedAt).toLocaleString()}</span>
                                    </div>
                                    <div style={styles.infoRow}>
                                        <span style={styles.label}>만료일</span>
                                        <span style={styles.value}>{contract.signingExpiry?.date ? new Date(contract.signingExpiry.date).toLocaleDateString() : '-'}</span>
                                    </div>

                                    <div style={styles.divider} />

                                    <h3 style={styles.sectionTitle}>요청자 정보</h3>
                                    {contract.requester && (
                                        <div style={styles.userCard}>
                                            <div style={styles.avatar}>{contract.requester.name?.[0]}</div>
                                            <div>
                                                <div style={styles.userName}>{contract.requester.name}</div>
                                                <div style={styles.userEmail}>{contract.requester.email}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'participants' && (
                                <div style={styles.section}>
                                    {contract.participants?.map((p: any, idx: number) => (
                                        <div key={idx} style={styles.participantItem}>
                                            <div style={styles.participantRole}>
                                                {p.roleName || (p.participantRole === 'requester' ? '요청자' : '참여자')}
                                            </div>
                                            <div style={styles.userCard}>
                                                <div style={styles.avatar}>{p.name?.[0]}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={styles.userName}>
                                                        {p.name}
                                                        <span style={styles.signMethod}>{p.signingMethodType}</span>
                                                    </div>
                                                    <div style={styles.userEmail}>{p.signingContactInfo}</div>
                                                </div>
                                                <div style={styles.participantStatus}>
                                                    {p.status === 'completed' ? <CheckCircle2 size={16} color="#166534" /> : <Clock size={16} color="#d97706" />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div style={styles.section}>
                                    {loadingTab ? <div style={styles.loading}>이력을 불러오는 중...</div> : (
                                        historyData.length > 0 ? historyData.map((h: any, idx: number) => {
                                            // Map history content
                                            return (
                                                <div key={idx} style={styles.historyItem}>
                                                    <div style={styles.historyIcon}><User size={12} /></div>
                                                    <div style={styles.historyContent}>
                                                        <div style={styles.historyTitle}>{h.content || h.action?.actionType}</div>
                                                        <div style={styles.historyTime}>{new Date(h.createdAt).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            );
                                        }) : <div style={styles.emptyState}>이력이 없습니다.</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'attachments' && (
                                <div style={styles.section}>
                                    {loadingTab ? <div style={styles.loading}>첨부 파일을 불러오는 중...</div> : (
                                        attachmentsData.length > 0 ? (
                                            attachmentsData.map((att: any, idx: number) => (
                                                <div key={idx} style={styles.attachmentItem}>
                                                    <div style={styles.attachmentIcon}><FileText size={16} /></div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={styles.attachmentName}>{att.file?.name || `첨부파일 ${idx + 1}`}</div>
                                                        <div style={styles.attachmentSize}>{att.file?.size ? `${(att.file.size / 1024).toFixed(1)} KB` : ''}</div>
                                                    </div>
                                                    <button style={styles.headerActionBtn} onClick={() => handleDownload('attachment', att.attachmentId)}>
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={styles.emptyState}>첨부된 파일이 없습니다.</div>
                                        )
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                title={alertConfig.title}
            />
        </div>

    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: '50vw', minWidth: '450px', backgroundColor: 'white', height: '100%', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' },
    header: { padding: '24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'flex-start' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#adb5bd' },
    statusBadgeWrapper: { display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' },
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
    idBadge: { fontSize: '11px', color: '#adb5bd', backgroundColor: '#f8f9fa', padding: '4px 6px', borderRadius: '4px' },
    title: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#343a40', lineHeight: '1.4' },

    toolbar: { padding: '12px 24px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px', overflowX: 'auto' },
    actionBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dee2e6', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', color: '#495057', whiteSpace: 'nowrap' },

    tabs: { display: 'flex', padding: '0 24px', borderBottom: '1px solid #eee' },
    tab: { padding: '14px 4px', marginRight: '20px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '14px', color: '#868e96' },
    tabActive: { padding: '14px 4px', marginRight: '20px', background: 'none', border: 'none', borderBottom: '2px solid #228be6', cursor: 'pointer', fontSize: '14px', color: '#228be6', fontWeight: 600 },

    content: { flex: 1, overflowY: 'auto', padding: '24px' },
    section: { marginBottom: '32px' },
    sectionTitle: { fontSize: '14px', fontWeight: 700, color: '#343a40', marginBottom: '16px' },
    infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' },
    label: { color: '#868e96' },
    value: { color: '#495057', fontWeight: 500 },
    divider: { height: '1px', backgroundColor: '#f1f3f5', margin: '24px 0' },

    userCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#495057' },
    userName: { fontSize: '14px', fontWeight: 600, color: '#343a40' },
    userEmail: { fontSize: '12px', color: '#868e96' },

    participantItem: { marginBottom: '12px' },
    participantRole: { fontSize: '11px', color: '#1c7ed6', marginBottom: '4px', fontWeight: 600 },
    signMethod: { fontSize: '10px', backgroundColor: '#e9ecef', padding: '2px 4px', borderRadius: '3px', marginLeft: '6px', color: '#495057' },
    participantStatus: { marginLeft: 'auto' },

    historyItem: { display: 'flex', gap: '12px', marginBottom: '20px', position: 'relative' },
    historyIcon: { width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e7f5ff', color: '#1c7ed6', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    historyContent: { flex: 1, paddingTop: '2px' },
    historyTitle: { fontSize: '13px', fontWeight: 500, color: '#495057', marginBottom: '2px' },
    historyTime: { fontSize: '11px', color: '#adb5bd' },

    attachmentItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '8px' },
    attachmentIcon: { color: '#868e96' },
    attachmentName: { fontSize: '13px', fontWeight: 500, color: '#343a40' },
    attachmentSize: { fontSize: '11px', color: '#adb5bd' },
    headerActionBtn: { background: 'none', border: '1px solid #dee2e6', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#495057' },
    emptyState: { textAlign: 'center', padding: '40px 0', color: '#adb5bd', fontSize: '13px' },

    loading: { textAlign: 'center', padding: '40px', color: '#adb5bd', fontSize: '14px' }
};
