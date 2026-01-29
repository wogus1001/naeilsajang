"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Building, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

// Reusing dashboard styles + some admin specific ones
const styles = {
    container: { padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-pretendard)' },
    header: { marginBottom: '32px' },
    title: { fontSize: '24px', fontWeight: '800', color: '#212529', marginBottom: '8px' },
    subtitle: { fontSize: '16px', color: '#868e96' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' },
    card: { backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    cardContent: { display: 'flex', flexDirection: 'column' as const },
    cardLabel: { fontSize: '14px', color: '#868e96', fontWeight: 600, marginBottom: '8px' },
    cardValue: { fontSize: '28px', fontWeight: '800', color: '#212529' },
    cardIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#343a40', marginBottom: '16px' },
    menuList: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    menuItem: {
        backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #f1f3f5',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        textDecoration: 'none', color: 'inherit', transition: 'all 0.2s'
    },
    menuIconBox: { width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e7f5ff', color: '#1971c2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' },
    menuTexts: { display: 'flex', flexDirection: 'column' as const },
    menuTitle: { fontSize: '16px', fontWeight: '700', color: '#343a40', marginBottom: '4px' },
    menuDesc: { fontSize: '13px', color: '#868e96' },
};

export default function AdminDashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeCompanies: 0,
        pendingApprovals: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    // Alert State
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        message: string;
        title?: string;
        onClose?: () => void;
    }>({ isOpen: false, message: '' });

    const showAlert = (message: string, onClose?: () => void) => {
        setAlertConfig({ isOpen: true, message, onClose });
    };

    const closeAlert = () => {
        if (alertConfig.onClose) alertConfig.onClose();
        setAlertConfig(prev => ({ ...prev, isOpen: false, onClose: undefined }));
    };

    useEffect(() => {
        // Auth check
        const userStr = localStorage.getItem('user');
        if (!userStr || JSON.parse(userStr).role !== 'admin') {
            showAlert('관리자 접근 권한이 필요합니다.', () => {
                router.push('/dashboard');
            });
            return;
        }

        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const users = await res.json();

                const totalUsers = users.length;
                // Count unique companies
                const companies = new Set(users.map((u: any) => u.companyName).filter(Boolean));
                const activeCompanies = companies.size;
                // Count pending
                const pendingApprovals = users.filter((u: any) => u.status === 'pending_approval' && u.role !== 'admin').length;

                setStats({ totalUsers, activeCompanies, pendingApprovals });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>시스템 관리</h1>
                <p style={styles.subtitle}>내일사장 시스템 전반을 관리하고 모니터링합니다.</p>
            </div>

            {/* Stats Overview */}
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardContent}>
                        <span style={styles.cardLabel}>총 사용자</span>
                        <span style={styles.cardValue}>{stats.totalUsers}명</span>
                    </div>
                    <div style={{ ...styles.cardIcon, backgroundColor: '#e7f5ff', color: '#1971c2' }}>
                        <Users size={24} />
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardContent}>
                        <span style={styles.cardLabel}>등록 회사</span>
                        <span style={styles.cardValue}>{stats.activeCompanies}개사</span>
                    </div>
                    <div style={{ ...styles.cardIcon, backgroundColor: '#e6fcf5', color: '#0ca678' }}>
                        <Building size={24} />
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardContent}>
                        <span style={styles.cardLabel}>승인 대기</span>
                        <span style={{ ...styles.cardValue, color: stats.pendingApprovals > 0 ? '#fa5252' : '#212529' }}>
                            {stats.pendingApprovals}건
                        </span>
                    </div>
                    <div style={{ ...styles.cardIcon, backgroundColor: '#fff5f5', color: '#fa5252' }}>
                        <ShieldCheck size={24} />
                    </div>
                </div>
            </div>

            {/* Quick Menu */}
            <h2 style={styles.sectionTitle}>관리 메뉴</h2>
            <div style={styles.menuList}>
                <Link href="/admin/users" style={styles.menuItem}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={styles.menuIconBox}>
                            <Users size={20} />
                        </div>
                        <div style={styles.menuTexts}>
                            <span style={styles.menuTitle}>회원 및 권한 관리</span>
                            <span style={styles.menuDesc}>사용자 목록 조회, 승인 대기 처리, 권한 수정</span>
                        </div>
                    </div>
                    <ChevronRight size={20} color="#adb5bd" />
                </Link>

                <Link href="/admin/settings" style={styles.menuItem}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ ...styles.menuIconBox, backgroundColor: '#f3f0ff', color: '#7950f2' }}>
                            <Settings size={20} />
                        </div>
                        <div style={styles.menuTexts}>
                            <span style={styles.menuTitle}>시스템 설정</span>
                            <span style={styles.menuDesc}>전체 공지사항, 기능 On/Off 제어</span>
                        </div>
                    </div>
                    <ChevronRight size={20} color="#adb5bd" />
                </Link>
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
