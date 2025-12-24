"use client";

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    return (
        <div className={`${styles.container} global-layout-container`}>
            <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className={`${styles.mainWrapper} ${!isSidebarOpen ? styles.collapsed : ''} global-main-wrapper`}>
                <Header />
                <main className={`${styles.content} global-content`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
