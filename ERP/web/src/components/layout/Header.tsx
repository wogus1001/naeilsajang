"use client";

import React from 'react';
import { Bell, ChevronDown, LogOut, LogIn, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

const Header = () => {
    const [user, setUser] = React.useState<any>(null);
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoaded(true);
    }, []);

    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        try {
            if (user?.id) {
                // Auto-disconnect uCanSign on logout
                await fetch(`/api/ucansign/disconnect?userId=${user.id}`, { method: 'DELETE' });
            }
        } catch (e) {
            console.error('Failed to disconnect uCanSign on logout:', e);
        }
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const pathname = usePathname();

    const getBreadcrumbInfo = (path: string) => {
        // Dashboard
        if (path === '/dashboard') return { category: '메인', title: '대시보드' };

        // Consulting
        if (path === '/properties') return { category: '컨설팅 업무', title: '점포 목록' };
        if (path === '/properties/register') return { category: '컨설팅 업무', title: '점포 신규등록' };
        if (path === '/properties/map') return { category: '컨설팅 업무', title: '물건지도' };
        if (path === '/schedule') return { category: '컨설팅 업무', title: '일정관리' };
        if (path.startsWith('/properties/')) return { category: '컨설팅 업무', title: '점포 상세' };

        // Customers
        if (path === '/customers') return { category: '고객관리', title: '고객목록' };
        if (path === '/customers/register') return { category: '고객관리', title: '신규입력' };
        if (path.startsWith('/customers/')) return { category: '고객관리', title: '고객 상세' };

        // Business Cards
        if (path === '/business-cards') return { category: '명함관리', title: '명함목록' };
        if (path === '/business-cards/register') return { category: '명함관리', title: '신규입력' };

        // Contracts
        if (path === '/contracts') return { category: '계약', title: '계약관리' };
        if (path === '/contracts/create') return { category: '계약', title: '간편 서명 시작(전자)' };
        if (path === '/contracts/builder') return { category: '계약', title: '새 계약 양식 만들기' };
        if (path.startsWith('/contracts/')) return { category: '계약', title: '계약 상세' };

        // Admin
        if (path.startsWith('/admin')) return { category: '관리자', title: '회원 관리' };

        // Staff Management
        if (path === '/company/staff') return { category: '메인', title: '직원 관리' };

        // Board
        if (path === '/board/notices') return { category: '게시판', title: '공지사항' };
        if (path === '/board/notices/write') return { category: '게시판', title: '공지사항 작성' };
        if (path.startsWith('/board/notices/') && path.endsWith('/edit')) return { category: '게시판', title: '공지사항 수정' };
        if (path.startsWith('/board/notices/')) return { category: '게시판', title: '공지사항 상세' };

        return { category: '메인', title: '대시보드' };
    };

    const breadcrumb = getBreadcrumbInfo(pathname);

    return (
        <header className={`${styles.header} global-header`}>
            <div className={styles.breadcrumbs}>
                <span className={styles.crumbRoot}>{breadcrumb.category}</span>
                <span className={styles.crumbSeparator}>&gt;</span>
                <span className={styles.crumbCurrent}>{breadcrumb.title}</span>
            </div>

            <div className={styles.actions}>

                <div
                    className={styles.profile}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    ref={dropdownRef}
                    style={{ position: 'relative' }}
                >
                    <div className={styles.profileInfo}>
                        {!isLoaded ? (
                            <>
                                <span className={styles.name} style={{ width: '50px', height: '18px', background: '#f1f3f5', borderRadius: '4px', display: 'inline-block' }}></span>
                                <span className={styles.role} style={{ width: '40px', height: '14px', background: '#f1f3f5', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}></span>
                            </>
                        ) : (
                            <>
                                <span className={styles.name}>{user?.name || '게스트'}</span>
                                <span className={styles.role}>{user?.companyName || '내일사장'}</span>
                            </>
                        )}
                    </div>
                    <ChevronDown size={16} className={styles.profileIcon} />

                    {isDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            backgroundColor: 'white',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            width: '160px',
                            zIndex: 3500,
                            overflow: 'hidden'
                        }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = '/profile';
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#333',
                                    textAlign: 'left'
                                }}
                            >
                                <User size={16} />
                                <span>개인정보수정</span>
                            </button>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = '/admin';
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: '#333',
                                        textAlign: 'left',
                                        borderTop: '1px solid #f5f5f5'
                                    }}
                                >
                                    <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: '#fa5252', color: 'white', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
                                    <span>관리자 페이지</span>
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleLogout();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#ff4444',
                                    textAlign: 'left'
                                }}
                            >
                                <LogOut size={16} />
                                <span>로그아웃</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = '/login';
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#333',
                                    textAlign: 'left',
                                    borderTop: '1px solid #f5f5f5'
                                }}
                            >
                                <LogIn size={16} />
                                <span>로그인 페이지</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
