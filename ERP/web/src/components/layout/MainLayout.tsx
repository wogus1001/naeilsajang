"use client";

import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [announcement, setAnnouncement] = React.useState<any>(null);
    const [maintenance, setMaintenance] = React.useState<any>(null);
    const [userRole, setUserRole] = React.useState<string>('');
    const [isBannerDismissed, setIsBannerDismissed] = React.useState(false);

    const router = useRouter(); // Import useRouter

    React.useEffect(() => {
        const checkAuth = () => {
            const userStr = localStorage.getItem('user');
            if (!userStr) {
                // No user found, redirect to login
                router.replace('/login');
                return false;
            }
            try {
                const user = JSON.parse(userStr);
                setUserRole(user.role || '');
                return true;
            } catch (e) {
                console.error(e);
                router.replace('/login'); // Invalid JSON
                return false;
            }
        };

        if (!checkAuth()) return; // Stop if not authenticated

        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/system/settings');
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
            } catch (e) {
                console.error(e);
            }
        };

        fetchSettings();
    }, []);

    const handleDismissBanner = () => {
        if (announcement) {
            localStorage.setItem('dismissed_banner_msg', announcement.message);
            setAnnouncement(null);
        }
    };

    const getBannerColor = (level: string) => {
        switch (level) {
            case 'error': return '#fa5252'; // Red
            case 'warning': return '#fd7e14'; // Orange
            default: return '#1971c2'; // Blue
        }
    };

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
                <Header />
                <main className={`${styles.content} global-content`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
