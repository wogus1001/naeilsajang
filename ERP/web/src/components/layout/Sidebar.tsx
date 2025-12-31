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

const MENU_ITEMS = [
    { title: '대시보드', url: '/dashboard', category: '메인' },
    { title: '점포 목록', url: '/properties', category: '컨설팅 업무' },
    { title: '점포 신규등록', url: '/properties/register', category: '컨설팅 업무' },
    { title: '물건지도', url: '/properties/map', category: '컨설팅 업무' },
    { title: '일정관리', url: '/schedule', category: '컨설팅 업무' },
    { title: '고객목록', url: '/customers', category: '고객관리' },
    { title: '신규입력', url: '/customers/register', category: '고객관리' },
    { title: '명함목록', url: '/business-cards', category: '명함관리' },
    { title: '신규입력', url: '/business-cards/register', category: '명함관리' },
    { title: '계약관리', url: '/contracts', category: '계약' },
    { title: '간편 서명 시작(전자)', url: '/contracts/create', category: '계약' },
    { title: '새 계약 양식 만들기', url: '/contracts/builder', category: '계약' },
];

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
    const pathname = usePathname();
    const [isConsultingOpen, setIsConsultingOpen] = useState(true);
    const [isCustomersOpen, setIsCustomersOpen] = useState(true);
    const [isBusinessCardsOpen, setIsBusinessCardsOpen] = useState(true);
    const [isContractsOpen, setIsContractsOpen] = useState(true);
    const [userRole, setUserRole] = useState<string>('');

    const [features, setFeatures] = useState({ electronicContracts: true, mapService: true });

    React.useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setUserRole(user.role || '');
            } catch (e) {
                console.error('Failed to parse user', e);
            }
        }

        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/system/settings');
                if (res.ok) {
                    const data = await res.json();
                    if (data.features) {
                        setFeatures(data.features);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchSettings();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<typeof MENU_ITEMS>([]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.trim() === '') {
            setSearchResults([]);
        } else {
            const results = MENU_ITEMS.filter(item =>
                item.title.toLowerCase().includes(term.toLowerCase()) ||
                item.category.toLowerCase().includes(term.toLowerCase())
            );
            setSearchResults(results);
        }
    };

    const handleLinkClick = () => {
        setSearchTerm('');
        setSearchResults([]);
    };

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
                <Link href="/dashboard" className={styles.logo} style={{ textDecoration: 'none' }}>
                    <div className={styles.logoIcon}>
                        <div className={styles.gridIcon} />
                    </div>
                    <span className={styles.logoText}>내일사장</span>
                </Link>

                {isOpen && (
                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            placeholder="메뉴검색"
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                        {/* Search Results Dropdown */}
                        {searchTerm && (
                            <div className={styles.searchResults}>
                                {searchResults.length > 0 ? (
                                    searchResults.map((item, index) => (
                                        <Link
                                            key={index}
                                            href={item.url}
                                            className={styles.searchResultItem}
                                            onClick={handleLinkClick}
                                        >
                                            <span className={styles.resultTitle}>{item.title}</span>
                                            <span className={styles.resultCategory}>{item.category}</span>
                                        </Link>
                                    ))
                                ) : (
                                    <div style={{ padding: '12px', fontSize: '13px', color: '#888', textAlign: 'center' }}>
                                        검색 결과가 없습니다.
                                    </div>
                                )}
                            </div>
                        )}
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
                                {features.mapService && (
                                    <Link
                                        href="/properties/map"
                                        className={`${styles.navSubLink} ${pathname === '/properties/map' ? styles.active : ''}`}
                                    >
                                        물건지도
                                    </Link>
                                )}
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

                    {features.electronicContracts && (
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
                                        간편 서명 시작(전자)
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
                    )}


                    {/* Manager Menu - Only visible to manager */}
                    {userRole === 'manager' && (
                        <div className={styles.navGroup}>
                            <Link href="/company/staff" className={styles.navLink} title={!isOpen ? "직원 관리" : undefined}>
                                <div className={styles.navGroupLabel}>
                                    <Users size={18} />
                                    {isOpen && <span>직원 관리</span>}
                                </div>
                            </Link>
                        </div>
                    )}


                </nav>
            </div >
        </aside >
    );
};

export default Sidebar;
