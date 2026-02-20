"use client";

import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: React.ReactNode;
}

type AuthUser = {
    id?: string;
    uid?: string;
    email?: string;
    name?: string;
    role?: string;
    companyName?: string;
    companyId?: string;
    status?: string;
};

type AnnouncementConfig = {
    active?: boolean;
    message?: string;
    level?: string;
} | null;

type MaintenanceConfig = {
    active?: boolean;
    message?: string;
} | null;

const MainLayout = ({ children }: MainLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [announcement, setAnnouncement] = React.useState<AnnouncementConfig>(null);
    const [maintenance, setMaintenance] = React.useState<MaintenanceConfig>(null);
    const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [userRole, setUserRole] = React.useState<string>('');

    const router = useRouter();

    React.useEffect(() => {
        let cancelled = false;

        const clearAuthAndRedirect = async () => {
            try {
                const supabase = getSupabase();
                await supabase.auth.signOut();
            } catch (error) {
                console.error('Failed to sign out stale session:', error);
            }
            localStorage.removeItem('user');
            if (!cancelled) {
                setIsAuthReady(true);
                router.replace('/login');
            }
        };

        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/system/settings', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();

                    // Maintenance logic
                    if (data.maintenance?.active) {
                        setMaintenance(data.maintenance);
                    }

                    // Announcement logic
                    if (data.announcement?.active) {
                        const savedDismissed = localStorage.getItem('dismissed_banner_msg');
                        if (savedDismissed !== data.announcement.message) {
                            setAnnouncement(data.announcement);
                        }
                    }
                }
            } catch (error) {
                console.error(error);
            }
        };

        const verifyAuth = async (): Promise<AuthUser | null> => {
            const supabase = getSupabase();

            // Retry logic to handle potential race condition where session is not yet persisted
            let sessionData = null;
            let sessionError = null;
            let retryCount = 0;
            const MAX_RETRIES = 3;

            while (retryCount < MAX_RETRIES) {
                const result = await supabase.auth.getSession();
                sessionData = result.data;
                sessionError = result.error;

                if (sessionData?.session?.access_token) {
                    break;
                }

                // Wait 500ms before retrying if session is missing
                if (retryCount < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                retryCount++;
            }

            if (sessionError || !sessionData?.session?.access_token) {
                // Temporary Debug: Show alert on missing session
                if (!window.location.pathname.includes('/login')) { // Only alert if NOT on login page
                    alert(`[세션 확인 불가] 저장된 로그인 정보(Access Token)가 없습니다.\n원인: sessionError=${sessionError?.message || 'null'}\n로그인 페이지로 이동합니다.`);
                }
                return null;
            }

            const meRes = await fetch('/api/auth/me', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                    'x-access-token': sessionData.session.access_token,
                },
                cache: 'no-store'
            });

            if (!meRes.ok) {
                // Temporary Debug: Show alert on ANY failure to identify root cause
                const errorText = await meRes.text().catch(() => '');
                const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined';
                alert(`인증 실패(코드:${meRes.status}): ${meRes.statusText}\n상세: ${errorText}\n현재 Client URL: ${currentUrl}\n관리자에게 캡처해서 보내주세요.`);
                return null;
            }

            const payload = await meRes.json() as { user?: AuthUser };
            if (!payload.user) {
                return null;
            }

            const storedRaw = localStorage.getItem('user');
            let storedUser: Partial<AuthUser> = {};

            if (storedRaw) {
                try {
                    storedUser = JSON.parse(storedRaw) as Partial<AuthUser>;
                } catch {
                    storedUser = {};
                }
            }

            const mergedUser: AuthUser = {
                ...storedUser,
                ...payload.user,
                id: storedUser.id || payload.user.id || payload.user.uid || payload.user.email
            };
            localStorage.setItem('user', JSON.stringify(mergedUser));
            return mergedUser;
        };

        const initializeLayout = async () => {
            const verifiedUser = await verifyAuth();
            if (!verifiedUser) {
                await clearAuthAndRedirect();
                return;
            }

            if (cancelled) return;

            setAuthUser(verifiedUser);
            setUserRole(verifiedUser.role || '');
            await fetchSettings();

            if (!cancelled) {
                setIsAuthReady(true);
            }
        };

        void initializeLayout();

        return () => {
            cancelled = true;
        };
    }, [router]);

    const handleDismissBanner = () => {
        if (announcement?.message) {
            localStorage.setItem('dismissed_banner_msg', announcement.message);
        }
        setAnnouncement(null);
    };

    const handleLogout = async () => {
        try {
            const userId = authUser?.uid || authUser?.id;
            if (userId) {
                await fetch(`/api/ucansign/disconnect?userId=${encodeURIComponent(userId)}`, {
                    method: 'DELETE'
                });
            }
        } catch (error) {
            console.error('Failed to disconnect uCanSign on logout:', error);
        }

        try {
            const supabase = getSupabase();
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Failed to sign out:', error);
        }

        localStorage.removeItem('user');
        router.replace('/login');
    };

    const getBannerColor = (level?: string) => {
        switch (level) {
            case 'error': return '#fa5252'; // Red
            case 'warning': return '#fd7e14'; // Orange
            default: return '#1971c2'; // Blue
        }
    };

    if (!isAuthReady) {
        return null;
    }

    // If maintenance mode is active and user is NOT an admin, block the whole page
    if (maintenance?.active && userRole !== 'admin') {
        return (
            <div style={{
                height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa',
                fontFamily: 'var(--font-pretendard)', textAlign: 'center', padding: '20px'
            }}>
                <div style={{ backgroundColor: '#fff5f5', color: '#fa5252', padding: '16px', borderRadius: '50%', marginBottom: '24px' }}>
                    <Megaphone size={48} />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#212529', marginBottom: '16px' }}>시스템 점검 중</h1>
                <p style={{ fontSize: '18px', color: '#495057', lineHeight: 1.6, maxWidth: '500px' }}>
                    {maintenance.message || "더 나은 서비스를 위해 시스템 정기 점검을 진행하고 있습니다. 잠시 후 다시 접속해주세요."}
                </p>
                <div style={{ marginTop: '32px', fontSize: '14px', color: '#adb5bd' }}>
                    관리자 문의: admin@naeilsajang.com
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.container} global-layout-container`}>
            {announcement && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '40px',
                    backgroundColor: getBannerColor(announcement.level),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '0 16px'
                }}>
                    <Megaphone size={16} style={{ marginRight: '8px' }} />
                    <span style={{ marginRight: '16px' }}>[공지] {announcement.message}</span>
                    <button
                        onClick={handleDismissBanner}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

            <div
                className={`${styles.mainWrapper} ${!isSidebarOpen ? styles.collapsed : ''} global-main-wrapper`}
                style={{ marginTop: announcement ? '40px' : 0, height: announcement ? 'calc(100vh - 40px)' : '100vh' }}
            >
                <Header user={authUser} onLogout={handleLogout} />
                <main className={`${styles.content} global-content`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
