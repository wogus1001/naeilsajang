"use client";

import React, { useState } from 'react';
import styles from '../login/page.module.css'; // Reuse login styles

export default function FindPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [modalInfo, setModalInfo] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);

    const handleFindPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setModalInfo(null);

        const id = (document.getElementById('id') as HTMLInputElement).value;
        const name = (document.getElementById('name') as HTMLInputElement).value;
        const companyName = (document.getElementById('companyName') as HTMLInputElement).value;

        try {
            const res = await fetch('/api/find-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, companyName }),
            });

            if (res.ok) {
                const data = await res.json();
                setModalInfo({
                    title: '비밀번호 찾기 성공',
                    message: `비밀번호는 [${data.password}] 입니다.`,
                    type: 'success'
                });
            } else {
                const errorData = await res.json();
                setModalInfo({
                    title: '비밀번호 찾기 실패',
                    message: errorData.error || '사용자를 찾을 수 없습니다.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Find password error:', error);
            setModalInfo({
                title: '오류 발생',
                message: '오류가 발생했습니다.',
                type: 'error'
            });
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
                    <h1 className={styles.title}>비밀번호 찾기</h1>
                    <p className={styles.subtitle}>아이디와 이름을 입력해 주세요</p>
                </div>

                <form onSubmit={handleFindPassword} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="id" className={styles.label}>아이디</label>
                        <input
                            type="text"
                            id="id"
                            placeholder="아이디를 입력하세요"
                            className={styles.input}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="name" className={styles.label}>이름</label>
                        <input
                            type="text"
                            id="name"
                            placeholder="이름을 입력하세요"
                            className={styles.input}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="companyName" className={styles.label}>회사명</label>
                        <input
                            type="text"
                            id="companyName"
                            placeholder="회사명을 입력하세요"
                            className={styles.input}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={isLoading}>
                        {isLoading ? '확인 중...' : '비밀번호 찾기'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <a href="/login" className={styles.link}>로그인으로 돌아가기</a>
                </div>
            </div>

            {/* Custom Modal */}
            {modalInfo && (
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
                        <div style={{ marginBottom: '16px', color: modalInfo.type === 'success' ? '#4caf50' : '#ff4444' }}>
                            {modalInfo.type === 'success' ? (
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            ) : (
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            )}
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px', color: '#333' }}>{modalInfo.title}</h3>
                        <p style={{ color: '#666', marginBottom: '24px', fontSize: '15px' }}>{modalInfo.message}</p>
                        <button
                            onClick={() => setModalInfo(null)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: modalInfo.type === 'success' ? '#4caf50' : '#2196f3',
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
