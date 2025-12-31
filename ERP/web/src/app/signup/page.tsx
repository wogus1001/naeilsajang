"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../login/page.module.css'; // Reuse login styles

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const id = (document.getElementById('id') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;
        const name = (document.getElementById('name') as HTMLInputElement).value;
        const companyName = (document.getElementById('companyName') as HTMLInputElement).value;

        // Get selected role
        const roleInputs = document.getElementsByName('role') as NodeListOf<HTMLInputElement>;
        let role = 'staff';
        for (const input of Array.from(roleInputs)) {
            if (input.checked) {
                role = input.value;
                break;
            }
        }

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password, name, companyName, role }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.message) {
                    alert(data.message); // Show message from server (e.g. "팀장으로 가입됨")
                } else {
                    alert('회원가입이 완료되었습니다. 로그인해주세요.');
                }
                router.push('/login');
            } else {
                if (res.status === 409) {
                    alert(data.error || '이미 존재하는 아이디입니다.');
                } else {
                    alert(data.error || '회원가입에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('회원가입 중 오류가 발생했습니다.');
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
                    <h1 className={styles.title}>회원가입</h1>
                    <p className={styles.subtitle}>내일사장 서비스 이용을 위한 가입</p>
                </div>

                <form onSubmit={handleSignup} className={styles.form}>
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
                        <label htmlFor="password" className={styles.label}>비밀번호</label>
                        <input
                            type="password"
                            id="password"
                            placeholder="비밀번호를 입력하세요"
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

                    <div className={styles.inputGroup} style={{ marginBottom: '20px' }}>
                        <label className={styles.label}>가입 유형</label>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="manager"
                                    defaultChecked
                                    style={{ accentColor: '#339af0' }}
                                />
                                팀장
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="staff"
                                    style={{ accentColor: '#339af0' }}
                                />
                                직원
                            </label>
                        </div>
                        <p style={{ fontSize: '12px', color: '#868e96', marginTop: '4px' }}>
                            * 처음 등록하는 회사의 경우 자동으로 팀장 권한이 부여됩니다.
                        </p>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={isLoading}>
                        {isLoading ? '가입 중...' : '가입하기'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <span style={{ color: '#868e96' }}>이미 계정이 있으신가요?</span>
                    <a href="/login" className={styles.link}>로그인</a>
                </div>
            </div>
        </div>
    );
}
