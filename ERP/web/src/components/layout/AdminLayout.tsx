"use client";

import React from 'react';
import AdminSidebar from './AdminSidebar';
import Header from './Header'; // We can reuse Header or make a simplified AdminHeader
import styles from './MainLayout.module.css';

// Reuse Header but maybe we want to pass a prop to indicate Admin Mode?
// For now, let's just reuse MainLayout structure but inject AdminSidebar effectively.

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    return (
        <div className={`${styles.container} global-layout-container`}>
            <AdminSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className={`${styles.mainWrapper} ${!isSidebarOpen ? styles.collapsed : ''} global-main-wrapper`}>
                {/* Simplified Header for Admin (or reuse Header with limited features) */}
                <header style={{
                    height: '64px',
                    borderBottom: '1px solid #e9ecef',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px',
                    justifyContent: 'flex-end',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#343a40' }}>관리자 모드</div>
                </header>
                <main className={`${styles.content} global-content`} style={{ backgroundColor: '#f8f9fa' }}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
