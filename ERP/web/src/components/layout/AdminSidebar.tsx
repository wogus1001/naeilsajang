"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings, LogOut, Home } from 'lucide-react';
import styles from './Sidebar.module.css'; // Reusing base sidebar styles for consistency but with admin tweaks if needed

interface AdminSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

const MENU_ITEMS = [
    { title: '대시보드', url: '/admin', icon: LayoutDashboard },
    { title: '회원 관리', url: '/admin/users', icon: Users },
    { title: '시스템 설정', url: '/admin/settings', icon: Settings },
];

const AdminSidebar = ({ isOpen, onToggle }: AdminSidebarProps) => {
    const pathname = usePathname();

    return (
        <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''} global-sidebar`} style={{ backgroundColor: '#212529', borderRight: 'none' }}>
            {/* Header / Logo */}
            <div className={styles.contentContainer} style={{ opacity: 1, pointerEvents: 'auto' }}>
                <Link href="/admin" className={styles.logo} style={{ textDecoration: 'none', color: '#fff' }}>
                    <div className={styles.logoIcon}>
                        {/* Admin specific logo style or just icon */}
                        <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: '#fa5252', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>A</div>
                    </div>
                    {isOpen && <span className={styles.logoText} style={{ color: '#fff' }}>ADMIN</span>}
                </Link>

                <nav className={styles.nav}>
                    <div style={{ padding: '0 16px', marginBottom: '8px', fontSize: '12px', color: '#868e96', fontWeight: 600 }}>
                        {isOpen && 'MANAGEMENT'}
                    </div>

                    {MENU_ITEMS.map((item) => (
                        <div key={item.url} className={styles.navItem}>
                            <Link
                                href={item.url}
                                className={`${styles.navLink} ${pathname === item.url ? styles.active : ''}`}
                                style={{
                                    color: pathname === item.url ? '#fff' : '#adb5bd',
                                    backgroundColor: pathname === item.url ? '#343a40' : 'transparent'
                                }}
                            >
                                <item.icon size={18} />
                                {isOpen && <span>{item.title}</span>}
                            </Link>
                        </div>
                    ))}

                    <div style={{ margin: '24px 0', borderTop: '1px solid #495057' }} />

                    <div className={styles.navItem}>
                        <Link href="/dashboard" className={styles.navLink} style={{ color: '#adb5bd' }}>
                            <Home size={18} />
                            {isOpen && <span>메인 서비스로 이동</span>}
                        </Link>
                    </div>
                </nav>
            </div>
        </aside>
    );
};

export default AdminSidebar;
