import React, { useState, useEffect } from 'react';
import { X, CreditCard, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface PointsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PointsModal({ isOpen, onClose }: PointsModalProps) {
    const [balance, setBalance] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'charge' | 'usage'>('usage');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchBalance();
            fetchHistory(activeTab);
        }
    }, [isOpen, activeTab]);

    const fetchBalance = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;
            const res = await fetch(`/api/points/balance?userId=${uid}`);
            const data = await res.json();
            if (data.balance !== undefined) setBalance(data.balance);
        } catch (e) {
            console.error('Failed to fetch balance', e);
        }
    };

    const fetchHistory = async (tab: 'charge' | 'usage') => {
        setLoading(true);
        setHistory([]);
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;
            const uid = JSON.parse(storedUser).id;

            const endpoint = tab === 'charge' ? '/api/points/history/charge' : '/api/points/history/usage';
            const res = await fetch(`${endpoint}?userId=${uid}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setHistory(data);
            }
        } catch (e) {
            console.error('Failed to fetch history', e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>포인트 관리</h2>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                {/* BALANCE CARD */}
                <div style={styles.balanceCard}>
                    <div style={styles.balanceLabel}>보유 포인트</div>
                    <div style={styles.balanceValue}>
                        {balance !== null ? balance.toLocaleString() : '-'} P
                    </div>
                </div>

                {/* TABS */}
                <div style={styles.tabs}>
                    <button
                        style={activeTab === 'usage' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('usage')}
                    >
                        소모 내역
                    </button>
                    <button
                        style={activeTab === 'charge' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('charge')}
                    >
                        충전 내역
                    </button>
                </div>

                {/* LIST */}
                <div style={styles.content}>
                    {loading ? (
                        <div style={styles.emptyState}>로딩 중...</div>
                    ) : history.length === 0 ? (
                        <div style={styles.emptyState}>내역이 없습니다.</div>
                    ) : (
                        <div style={styles.list}>
                            {activeTab === 'usage' ? (
                                history.map((item, idx) => (
                                    <div key={idx} style={styles.listItem}>
                                        <div style={styles.iconBox}><FileText size={16} color="#e67700" /></div>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.itemTitle}>{item.documentName || '문서명 없음'}</div>
                                            <div style={styles.itemSub}>{new Date(item.createdAt).toLocaleString()}</div>
                                        </div>
                                        <div style={styles.pointMinus}>-{item.point} P</div>
                                    </div>
                                ))
                            ) : (
                                history.map((item, idx) => (
                                    <div key={idx} style={styles.listItem}>
                                        <div style={{ ...styles.iconBox, backgroundColor: '#dcfce7', color: '#166534' }}>
                                            <CreditCard size={16} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.itemTitle}>{item.payTypeMsg || '결제'}</div>
                                            <div style={styles.itemSub}>{new Date(item.paidAt).toLocaleString()}</div>
                                        </div>
                                        <div style={styles.pointPlus}>+{item.point} P</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { width: '480px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' },
    header: { padding: '20px 24px', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#343a40' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#adb5bd' },

    balanceCard: { margin: '24px', padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '12px', textAlign: 'center', border: '1px solid #e9ecef' },
    balanceLabel: { fontSize: '14px', color: '#868e96', marginBottom: '8px' },
    balanceValue: { fontSize: '32px', fontWeight: 800, color: '#1c7ed6' },

    tabs: { display: 'flex', borderBottom: '1px solid #e9ecef', padding: '0 24px' },
    tab: { padding: '12px 16px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', color: '#868e96', fontSize: '14px', fontWeight: 500 },
    tabActive: { padding: '12px 16px', background: 'none', border: 'none', borderBottom: '2px solid #228be6', cursor: 'pointer', color: '#228be6', fontSize: '14px', fontWeight: 600 },

    content: { padding: '0 24px 24px 24px', overflowY: 'auto', flex: 1 },
    list: { marginTop: '16px' },
    listItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f3f5' },
    iconBox: { width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fff4e6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    itemTitle: { fontSize: '14px', fontWeight: 600, color: '#343a40', marginBottom: '2px' },
    itemSub: { fontSize: '12px', color: '#adb5bd' },
    pointMinus: { fontSize: '14px', fontWeight: 700, color: '#fa5252' },
    pointPlus: { fontSize: '14px', fontWeight: 700, color: '#166534' },
    emptyState: { textAlign: 'center', padding: '40px', color: '#adb5bd', fontSize: '14px' }
};
