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

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const pathname = usePathname();

    const getPageTitle = (path: string) => {
        if (path === '/properties') return '점포 목록';
        if (path === '/properties/register') return '점포 신규등록';
        if (path === '/schedule') return '일정관리';
        if (path.startsWith('/properties/')) return '점포 상세'; // Fallback for detail page
        return '대시보드';
    };

    return (
        <header className={`${styles.header} global-header`}>
            <div className={styles.breadcrumbs}>
                <span className={styles.crumbRoot}>컨설팅 업무</span>
                <span className={styles.crumbSeparator}>&gt;</span>
                <span className={styles.crumbCurrent}>{getPageTitle(pathname)}</span>
            </div>

            <div className={styles.actions}>
                <button className={styles.notificationBtn}>
                    <Bell size={20} />
                    <span className={styles.badge}>2</span>
                </button>

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
