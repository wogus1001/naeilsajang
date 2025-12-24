"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, ChevronDown, ChevronRight, ChevronLeft, Menu, Users, Contact, FileText } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
    const pathname = usePathname();
    const [isConsultingOpen, setIsConsultingOpen] = useState(true);
    const [isCustomersOpen, setIsCustomersOpen] = useState(true);
    const [isBusinessCardsOpen, setIsBusinessCardsOpen] = useState(true);
    const [isContractsOpen, setIsContractsOpen] = useState(true);

    return (
        <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''} global-sidebar`}>
            {/* Floating Toggle Button */}
            <button
                className={styles.toggleBtn}
                onClick={onToggle}
                title={isOpen ? "메뉴 접기" : "메뉴 펼치기"}
            >
                {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Content Container - hidden when closed */}
            <div className={styles.contentContainer} style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}>
                <div className={styles.logo}>
                    <div className={styles.logoIcon}>
                        <div className={styles.gridIcon} />
                    </div>
                    <span className={styles.logoText}>내일사장</span>
                </div>

                {isOpen && (
                    <div className={styles.searchWrapper}>
                        <input type="text" placeholder="메뉴검색" className={styles.searchInput} />
                    </div>
                )}

                <nav className={styles.nav}>
                    <div className={styles.navItem}>
                        <Link href="/dashboard" className={`${styles.navLink} ${pathname === '/dashboard' ? styles.active : ''}`} title={!isOpen ? "대시보드" : undefined}>
                            <LayoutDashboard size={18} />
                            {isOpen && <span>대시보드</span>}
                        </Link>
                    </div>

                    <div className={styles.navGroup}>
                        <button
                            className={styles.navGroupTitle}
                            onClick={() => setIsConsultingOpen(!isConsultingOpen)}
                        >
                            <div className={styles.navGroupLabel}>
                                <Briefcase size={18} />
                                {isOpen && <span>컨설팅 업무</span>}
                            </div>
                            {isOpen && (isConsultingOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                        </button>

                        {isConsultingOpen && (
                            <div className={styles.navSubMenu}>
                                <Link
                                    href="/properties"
                                    className={`${styles.navSubLink} ${pathname === '/properties' ? styles.active : ''}`}
                                >
                                    점포 목록
                                </Link>
                                <Link
                                    href="/properties/register"
                                    className={`${styles.navSubLink} ${pathname === '/properties/register' ? styles.active : ''}`}
                                >
                                    점포 신규등록
                                </Link>
                                <Link
                                    href="/properties/map"
                                    className={`${styles.navSubLink} ${pathname === '/properties/map' ? styles.active : ''}`}
                                >
                                    물건지도
                                </Link>
                                <Link
                                    href="/schedule"
                                    className={`${styles.navSubLink} ${pathname === '/schedule' ? styles.active : ''}`}
                                >
                                    일정관리
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className={styles.navGroup}>
                        <button
                            className={styles.navGroupTitle}
                            onClick={() => setIsCustomersOpen(!isCustomersOpen)}
                        >
                            <div className={styles.navGroupLabel}>
                                <Users size={18} />
                                {isOpen && <span>고객관리</span>}
                            </div>
                            {isOpen && (isCustomersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                        </button>

                        {isCustomersOpen && (
                            <div className={styles.navSubMenu}>
                                <Link
                                    href="/customers"
                                    className={`${styles.navSubLink} ${pathname === '/customers' ? styles.active : ''}`}
                                >
                                    고객목록
                                </Link>
                                <Link
                                    href="/customers/register"
                                    className={`${styles.navSubLink} ${pathname === '/customers/register' ? styles.active : ''}`}
                                >
                                    신규입력
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className={styles.navGroup}>
                        <button
                            className={styles.navGroupTitle}
                            onClick={() => setIsBusinessCardsOpen(!isBusinessCardsOpen)}
                        >
                            <div className={styles.navGroupLabel}>
                                <Contact size={18} />
                                {isOpen && <span>명함관리</span>}
                            </div>
                            {isOpen && (isBusinessCardsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                        </button>

                        {isBusinessCardsOpen && (
                            <div className={styles.navSubMenu}>
                                <Link
                                    href="/business-cards"
                                    className={`${styles.navSubLink} ${pathname === '/business-cards' ? styles.active : ''}`}
                                >
                                    명함목록
                                </Link>
                                <Link
                                    href="/business-cards/register"
                                    className={`${styles.navSubLink} ${pathname === '/business-cards/register' ? styles.active : ''}`}
                                >
                                    신규입력
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className={styles.navGroup}>
                        <button
                            className={styles.navGroupTitle}
                            onClick={() => setIsContractsOpen(!isContractsOpen)}
                        >
                            <div className={styles.navGroupLabel}>
                                <FileText size={18} />
                                {isOpen && <span>계약</span>}
                            </div>
                            {isOpen && (isContractsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                        </button>

                        {isContractsOpen && (
                            <div className={styles.navSubMenu}>
                                <Link
                                    href="/contracts"
                                    className={`${styles.navSubLink} ${pathname === '/contracts' ? styles.active : ''}`}
                                >
                                    계약관리
                                </Link>
                                <Link
                                    href="/contracts/create"
                                    className={`${styles.navSubLink} ${pathname === '/contracts/create' ? styles.active : ''}`}
                                >
                                    전자계약 생성
                                </Link>
                                <Link
                                    href="/contracts/builder"
                                    className={`${styles.navSubLink} ${pathname === '/contracts/builder' ? styles.active : ''}`}
                                >
                                    새 계약 양식 만들기
                                </Link>
                            </div>
                        )}
                    </div>


                    {/* Admin Menu - Only visible to admin */}
                    <div className={styles.navGroup}>
                        <Link href="/admin/users" className={styles.navLink} title={!isOpen ? "회원 관리 (Admin)" : undefined}>
                            <div className={styles.navGroupLabel}>
                                {isOpen ? (
                                    <span style={{ marginLeft: 24, fontWeight: 'bold', color: '#1976d2' }}>회원 관리 (Admin)</span>
                                ) : (
                                    <span style={{ fontWeight: 'bold', color: '#1976d2' }}>A</span>
                                )}
                            </div>
                        </Link>
                    </div>
                </nav>
            </div >
        </aside >
    );
};

export default Sidebar;
