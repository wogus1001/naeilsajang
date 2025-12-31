"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loggedInUser, setLoggedInUser] = useState<any>(null);

    React.useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            setLoggedInUser(JSON.parse(userStr));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setLoggedInUser(null);
        window.location.reload();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        const id = (document.getElementById('email') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password }),
            });

            if (res.ok) {
                const data = await res.json();
                // api/login returns { user: ... }, so we unwrap it if present
                const userInfo = data.user || data;
                localStorage.setItem('user', JSON.stringify(userInfo));
                router.push('/dashboard');
            } else {
                const errorData = await res.json();
                if (res.status === 401) {
                    setErrorMsg('비밀번호가 일치하지 않습니다.');
                } else if (res.status === 404) {
                    setErrorMsg('존재하지 않는 아이디입니다.');
                } else {
                    setErrorMsg(errorData.error || '로그인에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            setErrorMsg('로그인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>
                        <div className={styles.gridIcon} />
                    </div>
                    <h1 className={styles.title}>내일사장</h1>
                    <p className={styles.subtitle}>부동산 전문가를 위한 통합 솔루션</p>
                </div>

                {loggedInUser ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ marginBottom: '24px', fontSize: '16px', color: '#333' }}>
                            <strong>{loggedInUser.name}</strong>님, 이미 로그인되어 있습니다.
                        </p>
                        <button
                            onClick={handleLogout}
                            className={styles.loginButton}
                            style={{ backgroundColor: '#ff4444' }}
                        >
                            로그아웃
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className={styles.loginButton}
                            style={{ marginTop: '12px', backgroundColor: '#2196f3' }}
                        >
                            메인으로 이동
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>아이디</label>
                            <input
                                type="text"
                                id="email"
                                placeholder="아이디를 입력하세요"
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>비밀번호</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="비밀번호를 입력하세요"
                                className={styles.input}
                                required
                            />
                        </div>

                        <button type="submit" className={styles.loginButton} disabled={isLoading}>
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>
                )}

                <div className={styles.footer}>
                    <a href="/find-password" className={styles.link}>비밀번호 찾기</a>
                    <span className={styles.divider}>|</span>
                    <a href="/signup" className={styles.link}>회원가입</a>
                </div>
            </div>

            {/* Custom Error Modal */}
            {errorMsg && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        width: '320px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        textAlign: 'center'
                    }}>
                        <div style={{ marginBottom: '16px', color: '#ff4444' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px', color: '#333' }}>로그인 실패</h3>
                        <p style={{ color: '#666', marginBottom: '24px', fontSize: '15px' }}>{errorMsg}</p>
                        <button
                            onClick={() => setErrorMsg(null)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#2196f3',
                                color: 'white',
                                fontSize: '15px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
