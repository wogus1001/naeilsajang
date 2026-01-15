"use client";

import React from 'react';
import { Calendar, FileText, Users, Briefcase, ChevronRight, Plus, Clock, CheckCircle2, BarChart3, Megaphone, StickyNote, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const [memo, setMemo] = React.useState(''); // Simple state for memo
    const [isMemoLoaded, setIsMemoLoaded] = React.useState(false); // Track if initial memo is loaded

    const [stats, setStats] = React.useState<any[]>([]);
    const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
    const [recentContracts, setRecentContracts] = React.useState<any[]>([]);
    const [notices, setNotices] = React.useState<any[]>([]); // Notices from API

    const [userName, setUserName] = React.useState('사장님'); // Default to '사장님' if no name
    const [userId, setUserId] = React.useState('');

    // --- NEW: Contract display cycling state ---
    const [contractDisplayMode, setContractDisplayMode] = React.useState<'total' | 'project' | 'electronic'>('total');
    const [projectContractCount, setProjectContractCount] = React.useState(0);
    const [apiContractCount, setApiContractCount] = React.useState(0);

    // --- Notice Creator State ---
    const [isNoticeModalOpen, setIsNoticeModalOpen] = React.useState(false);
    const [newNotice, setNewNotice] = React.useState({ title: '', content: '', type: 'team', isPinned: false });
    const [isSavingNotice, setIsSavingNotice] = React.useState(false);
    const [userData, setUserData] = React.useState<any>(null);

    React.useEffect(() => {
        // Mock user ID - in real app, get from auth context or session
        let currentUserId = localStorage.getItem('userId') || 'admin';
        let companyName = '';

        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setUserData(user);
                setUserName(user.name || '사장님');
                currentUserId = user.id;
                companyName = user.companyName;
            } catch (e) {
                console.error(e);
            }
        }
        setUserId(currentUserId);

        // Fetch Dashboard Data
        const fetchDashboardData = async () => {
            try {
                const res = await fetch(`/api/dashboard?userId=${currentUserId}`);
                const data = await res.json();

                if (data.stats) {
                    setProjectContractCount(data.stats.projectContractCount || 0);
                    setApiContractCount(data.stats.apiContractCount || 0);

                    setStats([
                        { id: 'schedule', label: '예정된 일정', value: data.stats.scheduleCount, unit: '건', icon: Calendar, color: '#4c6ef5', bg: '#edf2ff', link: '/schedule' },
                        { id: 'contract', label: '진행 중인 계약', value: data.stats.ongoingContractCount, unit: '건', icon: FileText, color: '#fcc419', bg: '#fff9db', link: '/contracts' },
                        { id: 'property', label: '이번 달 신규 점포', value: data.stats.newPropertyCount, unit: '건', icon: Briefcase, color: '#20c997', bg: '#e6fcf5', link: '/properties' },
                        { id: 'customer', label: '총 보유 고객', value: data.stats.totalCustomerCount, unit: '명', icon: Users, color: '#fa5252', bg: '#fff5f5', link: '/customers' },
                    ]);
                }
                if (data.todaySchedules) setTodaySchedules(data.todaySchedules);
                if (data.recentContracts) setRecentContracts(data.recentContracts);
            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
            }
        };

        // Fetch Notices
        const fetchNotices = async () => {
            try {
                const res = await fetch(`/api/notices?companyName=${encodeURIComponent(companyName || '')}&limit=5`);
                const data = await res.json();
                setNotices(data);
            } catch (error) {
                console.error('Failed to fetch notices', error);
            }
        };

        // Fetch Memo
        const fetchMemo = async () => {
            try {
                const res = await fetch(`/api/dashboard/memo?userId=${currentUserId}`);
                const data = await res.json();
                setMemo(data.content || '');
                setIsMemoLoaded(true);
            } catch (error) {
                console.error('Failed to fetch memo', error);
            }
        };

        fetchDashboardData();
        fetchNotices();
        fetchMemo();
    }, []);

    const fetchDashboardNotices = async () => {
        try {
            const companyName = userData?.companyName || '';
            const res = await fetch(`/api/notices?companyName=${encodeURIComponent(companyName)}&limit=5`);
            const data = await res.json();
            setNotices(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateNotice = async () => {
        if (!newNotice.title || !newNotice.content) return alert('제목과 내용을 입력해주세요.');

        setIsSavingNotice(true);
        try {
            const res = await fetch('/api/notices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newNotice,
                    authorName: userData?.name || '관리자',
                    authorRole: userData?.role || 'staff',
                    authorId: userId,
                    companyName: userData?.companyName
                })
            });

            if (res.ok) {
                alert('공지사항이 등록되었습니다.');
                setIsNoticeModalOpen(false);
                setNewNotice({ title: '', content: '', type: 'team', isPinned: false });
                fetchDashboardNotices(); // Refresh list
            }
        } catch (error) {
            console.error(error);
            alert('등록 실패');
        } finally {
            setIsSavingNotice(false);
        }
    };

    // Auto-save logic with debounce
    React.useEffect(() => {
        if (!isMemoLoaded || !userId) return;

        const timer = setTimeout(async () => {
            try {
                await fetch('/api/dashboard/memo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, content: memo })
                });
                // Optional: Console log or toast for debug
                console.log('Memo auto-saved');
            } catch (error) {
                console.error('Auto-save failed', error);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timer);
    }, [memo, userId, isMemoLoaded]);

    const handleContractClick = async (contract: any) => {
        if (contract.type === '전자계약') {
            try {
                const res = await fetch(`/api/user/status?userId=${userId}`);
                const data = await res.json();
                if (!data.connected) {
                    // Alert for disconnected state
                    alert('전자계약 서비스 연동이 해제되어 있습니다.\n[설정] > [외부 서비스 연동]에서 연동을 진행해주세요.');
                    return;
                }
                // If connected, go to contracts (signatures tab)
                router.push('/contracts?tab=signatures');
            } catch (error) {
                console.error('Failed to check connection status', error);
                alert('연동 상태 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        } else {
            // Project based contract
            router.push(`/contracts?id=${contract.id}`);
        }
    };







    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        switch (s) {
            case 'completed':
            case 'done':
                return { label: '완료', color: '#2b8a3e', bg: '#ebfbee' };
            case 'progress':
            case 'active':
            case 'on_going':
                return { label: '진행중', color: '#1971c2', bg: '#e7f5ff' };
            case 'waiting':
                return { label: '대기중', color: '#e67700', bg: '#fff4e6' };
            case 'need_signing':
                return { label: '서명 필요', color: '#f08c00', bg: '#fff9db' };
            case 'sent':
                return { label: '발송됨', color: '#1971c2', bg: '#e7f5ff' };
            case 'canceled':
            case 'rejected':
            case 'refused':
                return { label: '취소/반려', color: '#fa5252', bg: '#fff5f5' };
            case 'expired':
                return { label: '만료됨', color: '#fa5252', bg: '#fff5f5' };
            case 'trash':
                return { label: '휴지통', color: '#868e96', bg: '#f1f3f5' };
            default: return { label: status || '알 수 없음', color: '#868e96', bg: '#f8f9fa' };
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1200px] mx-auto" style={{ fontFamily: 'var(--font-pretendard)' }}>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 md:gap-0">
                <div>
                    <h1 style={styles.pageTitle}>안녕하세요, {userName}님! 👋</h1>
                    <p style={styles.pageSubtitle}>오늘도 성공적인 비즈니스를 응원합니다.</p>
                </div>
                <div style={styles.dateDisplay}>
                    {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {stats.map((stat, index) => {
                    // Special rendering for Contract Card with premium integrated design
                    if (stat.id === 'contract') {
                        let displayValue = stat.value;
                        let subLabel = '';

                        if (contractDisplayMode === 'project') {
                            displayValue = projectContractCount;
                            subLabel = '(프로젝트)';
                        } else if (contractDisplayMode === 'electronic') {
                            displayValue = apiContractCount;
                            subLabel = '(전자계약)';
                        } else {
                            subLabel = '(합계)';
                        }

                        const cycleMode = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (contractDisplayMode === 'total') setContractDisplayMode('project');
                            else if (contractDisplayMode === 'project') setContractDisplayMode('electronic');
                            else setContractDisplayMode('total');
                        };

                        return (
                            <div key={index} style={styles.statCardPremium} onClick={() => router.push(stat.link)}>
                                <div style={styles.statContent}>
                                    <span style={styles.statLabel}>{stat.label}</span>
                                    <div style={styles.statValueWrapper}>
                                        <span style={styles.statValue}>{displayValue}</span>
                                        <span style={styles.statUnit}>{stat.unit}</span>
                                        <span style={{ fontSize: '12px', color: '#868e96', marginLeft: '6px', fontWeight: 600 }}>{subLabel}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Integrated Icon Box with sophisticated Toggle */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ ...styles.statIconGradient, background: 'linear-gradient(135deg, #fff3bf 0%, #ffec99 100%)', color: '#f59f00' }}>
                                            <stat.icon size={26} />
                                        </div>
                                        <button
                                            onClick={cycleMode}
                                            style={styles.integratedToggleBtn}
                                            title="표시 정보 전환"
                                        >
                                            <RefreshCw size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={index} style={styles.statCard} onClick={() => router.push(stat.link)}>
                            <div style={styles.statContent}>
                                <span style={styles.statLabel}>{stat.label}</span>
                                <div style={styles.statValueWrapper}>
                                    <span style={styles.statValue}>{stat.value}</span>
                                    <span style={styles.statUnit}>{stat.unit}</span>
                                </div>
                            </div>
                            <div style={{ ...styles.statIcon, backgroundColor: stat.bg, color: stat.color }}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Column */}
                <div style={styles.column}>



                    {/* Upcoming Schedule */}
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>📅 예정된 일정</h3>
                        <Link href="/schedule" style={styles.moreLink}>더보기 <ChevronRight size={14} /></Link>
                    </div>
                    <div style={styles.card}>
                        {todaySchedules.length > 0 ? (
                            todaySchedules.map((schedule, idx) => (
                                <div key={`schedule-${schedule.id}-${idx}`} style={{ ...styles.scheduleItem, borderBottom: idx === todaySchedules.length - 1 ? 'none' : '1px solid #f1f3f5' }}>
                                    <div style={styles.timeBadge}>{schedule.time}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.scheduleTitle}>{schedule.title}</div>
                                        <div style={styles.scheduleLocation}>{schedule.location}</div>
                                    </div>
                                    <div style={styles.scheduleType}>
                                        {schedule.type === 'contract' ? '✍️' : schedule.type === 'meeting' ? '☕' : null}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={styles.emptyState}>예정된 일정이 없습니다.</div>
                        )}
                    </div>

                    {/* Quick Memo (Moved from Right) */}
                    <div style={{ marginTop: '32px' }}>
                        <div style={styles.sectionHeader}>
                            <h3 style={styles.sectionTitle}>📌 간편 메모</h3>
                            {/* Auto-save enabled, button removed */}
                        </div>
                        <div style={{ ...styles.card, padding: '16px', marginBottom: '32px', backgroundColor: '#fff9db' }}>
                            <textarea
                                style={styles.memoInput}
                                placeholder="급한 메모를 남겨보세요..."
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div style={styles.column}>

                    {/* Notices (Moved from Left) */}
                    <div style={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={styles.sectionTitle}>📢 공지사항</h3>
                            <button
                                onClick={() => setIsNoticeModalOpen(true)}
                                style={{ ...styles.iconBtn, color: '#339af0', backgroundColor: '#e7f5ff', borderRadius: '50%', width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="공지사항 작성"
                            >
                                <Plus size={14} strokeWidth={3} />
                            </button>
                        </div>
                        <span
                            style={{ ...styles.moreLink, cursor: 'pointer' }}
                            onClick={() => router.push('/board/notices')}
                        >
                            전체보기 <ChevronRight size={14} />
                        </span>
                    </div>
                    <div style={styles.card}>
                        {notices.length > 0 ? (
                            notices.slice(0, 5).map((notice, idx) => (
                                <div
                                    key={`notice-${notice.id}-${idx}`}
                                    style={{ ...styles.noticeItem, borderBottom: idx === notices.length - 1 ? 'none' : '1px solid #f1f3f5' }}
                                    onClick={() => router.push(`/board/notices/${notice.id}`)}
                                >
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                        {/* Show badge for System notice or New */}
                                        {notice.type === 'system' && <span style={{ fontSize: '10px', color: '#fa5252', background: '#fff5f5', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold', flexShrink: 0 }}>전체</span>}
                                        {notice.type === 'team' && <span style={{ fontSize: '10px', color: '#1971c2', background: '#e7f5ff', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold', flexShrink: 0 }}>팀</span>}
                                        <span style={{
                                            ...styles.noticeTitle,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {notice.isPinned && <span style={{ marginRight: '4px' }}>📌</span>}
                                            {notice.title}
                                        </span>
                                    </div>
                                    <span style={{ ...styles.noticeDate, flexShrink: 0 }}>{notice.createdAt}</span>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#adb5bd', fontSize: '13px' }}>등록된 공지사항이 없습니다.</div>
                        )}
                    </div>

                    <div style={{ marginTop: '32px' }}>
                        {/* Quick Actions (Moved from Left) */}
                        <div style={styles.sectionHeader}>
                            <h3 style={styles.sectionTitle}>⚡ 빠른 실행</h3>
                        </div>
                        <div style={styles.quickActionsGrid}>
                            <button style={styles.quickActionBtn} onClick={() => router.push('/properties/register')}>
                                <div style={{ ...styles.quickActionIcon, background: '#e6fcf5', color: '#0ca678' }}><Briefcase size={20} /></div>
                                <span>점포 등록</span>
                            </button>
                            <button style={styles.quickActionBtn} onClick={() => router.push('/customers/register')}>
                                <div style={{ ...styles.quickActionIcon, background: '#fff5f5', color: '#fa5252' }}><Users size={20} /></div>
                                <span>신규 고객</span>
                            </button>
                            <button style={styles.quickActionBtn} onClick={() => router.push('/contracts/create')}>
                                <div style={{ ...styles.quickActionIcon, background: '#fff9db', color: '#f59f00' }}><FileText size={20} /></div>
                                <span>간편 서명</span>
                            </button>
                        </div>
                    </div>



                </div>
            </div>

            {/* --- Notice Creation Modal --- */}
            {isNoticeModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white', width: '90%', maxWidth: '500px', borderRadius: '16px', padding: '32px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', color: '#212529' }}>📢 신규 공지사항 작성</h2>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>공지 유형</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setNewNotice({ ...newNotice, type: 'team' })}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px', border: '1px solid #dee2e6', fontSize: '13px',
                                        backgroundColor: newNotice.type === 'team' ? '#e7f5ff' : 'white',
                                        borderColor: newNotice.type === 'team' ? '#339af0' : '#dee2e6',
                                        color: newNotice.type === 'team' ? '#1971c2' : '#495057',
                                        fontWeight: 600, cursor: 'pointer'
                                    }}
                                >팀 공지</button>
                                {userData?.role === 'admin' && (
                                    <button
                                        onClick={() => setNewNotice({ ...newNotice, type: 'system' })}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', border: '1px solid #dee2e6', fontSize: '13px',
                                            backgroundColor: newNotice.type === 'system' ? '#fff5f5' : 'white',
                                            borderColor: newNotice.type === 'system' ? '#fa5252' : '#dee2e6',
                                            color: newNotice.type === 'system' ? '#e03131' : '#495057',
                                            fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >전체 시스템 공지</button>
                                )}
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>제목</label>
                            <input
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6', fontSize: '14px' }}
                                placeholder="제목을 입력하세요"
                                value={newNotice.title}
                                onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>내용</label>
                            <textarea
                                style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6', fontSize: '14px', resize: 'none' }}
                                placeholder="공지할 내용을 입력하세요"
                                value={newNotice.content}
                                onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                            <input
                                type="checkbox"
                                id="isPinnedCheck"
                                checked={newNotice.isPinned}
                                onChange={(e) => setNewNotice({ ...newNotice, isPinned: e.target.checked })}
                            />
                            <label htmlFor="isPinnedCheck" style={{ fontSize: '14px', color: '#495057', cursor: 'pointer' }}>상단 고정 (📌)</label>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setIsNoticeModalOpen(false)}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#f1f3f5', color: '#495057', fontWeight: 600, cursor: 'pointer' }}
                            >취소</button>
                            <button
                                onClick={handleCreateNotice}
                                disabled={isSavingNotice}
                                style={{
                                    padding: '10px 24px', borderRadius: '8px', border: 'none',
                                    backgroundColor: '#1971c2', color: 'white', fontWeight: 600, cursor: 'pointer',
                                    opacity: isSavingNotice ? 0.7 : 1
                                }}
                            >
                                {isSavingNotice ? '저장 중...' : '공지하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    // container: { padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-pretendard)' },
    // header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' },
    pageTitle: { fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0', color: '#212529' },
    pageSubtitle: { fontSize: '16px', color: '#868e96', margin: 0 },
    dateDisplay: { fontSize: '14px', color: '#868e96', fontWeight: 500, backgroundColor: '#f8f9fa', padding: '8px 16px', borderRadius: '20px' },

    // statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' },
    statCard: { backgroundColor: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s ease', border: 'none' },
    statCardPremium: { backgroundColor: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s ease', border: 'none', position: 'relative', overflow: 'hidden' },
    statContent: { display: 'flex', flexDirection: 'column', zIndex: 1 },
    statLabel: { fontSize: '15px', color: '#495057', marginBottom: '10px', fontWeight: 700, letterSpacing: '-0.02em' },
    statValueWrapper: { display: 'flex', alignItems: 'baseline', gap: '2px' },
    statValue: { fontSize: '32px', fontWeight: '900', color: '#212529', letterSpacing: '-1px' },
    statUnit: { fontSize: '15px', color: '#adb5bd', fontWeight: 600, marginLeft: '2px' },
    statIcon: { width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s ease' },
    statIconGradient: { width: '56px', height: '56px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(252, 196, 25, 0.2)', transition: 'transform 0.3s ease' },
    integratedToggleBtn: {
        position: 'absolute',
        bottom: '-6px',
        right: '-6px',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        backgroundColor: 'white',
        border: '2px solid #fff3bf',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#f59f00',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        zIndex: 2,
        transition: 'all 0.2s ease'
    },

    // mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' },
    column: { display: 'flex', flexDirection: 'column' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#343a40', margin: 0 },
    moreLink: { fontSize: '13px', color: '#868e96', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' },
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#868e96', padding: '4px' },

    card: { backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f3f5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' },

    scheduleItem: { display: 'flex', alignItems: 'center', padding: '20px', gap: '16px' },
    timeBadge: { fontSize: '14px', fontWeight: '700', color: '#495057', width: '50px' },
    scheduleTitle: { fontSize: '15px', fontWeight: '600', color: '#343a40', marginBottom: '4px' },
    scheduleLocation: { fontSize: '13px', color: '#868e96' },
    scheduleType: { fontSize: '18px' },

    contractItem: { display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '12px', cursor: 'pointer', transition: 'background-color 0.2s ease' },
    contractIcon: { color: '#adb5bd' },
    contractTitle: { fontSize: '14px', fontWeight: '600', color: '#343a40', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    contractMeta: { fontSize: '12px', color: '#868e96' },
    statusBadge: { fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap' },

    emptyState: { padding: '40px', textAlign: 'center', color: '#adb5bd', fontSize: '14px' },

    quickActionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
    quickActionBtn: { border: 'none', backgroundColor: 'white', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.2s' },
    quickActionIcon: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    // New Styles
    chartContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '160px', padding: '0 10px' },
    chartBarWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 },
    chartBarBg: { width: '12px', height: '120px', backgroundColor: '#f1f3f5', borderRadius: '10px', display: 'flex', alignItems: 'flex-end' },
    chartBarFill: { width: '100%', borderRadius: '10px', transition: 'height 1s ease-out' },
    chartLabel: { fontSize: '12px', color: '#868e96' },

    memoInput: { width: '100%', height: '120px', border: 'none', backgroundColor: 'transparent', resize: 'none', outline: 'none', fontSize: '14px', lineHeight: '1.6', color: '#495057' },

    noticeItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' },
    noticeTitle: { fontSize: '14px', color: '#343a40' },
    noticeDate: { fontSize: '12px', color: '#adb5bd' },
    newBadge: { fontSize: '10px', fontWeight: 'bold', color: '#fa5252', backgroundColor: '#fff5f5', padding: '2px 6px', borderRadius: '4px' },
};
