"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../login/page.module.css'; // Reuse login styles

interface Company {
    id: string;
    name: string;
    manager_name: string;
    created_at: string;
}

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Search Modal State
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Company[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        // ... (unchanged)
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

        if (password.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            setIsLoading(false);
            return;
        }

        // Email Validation Policy
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(id)) {
            alert('아이디는 이메일 형식(예: user@example.com)으로 입력해주세요.');
            setIsLoading(false);
            return;
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

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) {
            alert('검색어를 입력해주세요.');
            return;
        }

        setIsSearching(true);
        setHasSearched(false); // Reset before search
        try {
            const res = await fetch(`/api/companies/search?query=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (res.ok) {
                setSearchResults(data.data || []);
            } else {
                console.error('Search failed:', data.error);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
            setHasSearched(true); // Set true after search completes
        }
    };

    const handleSelectCompany = (company: Company) => {
        const companyNameInput = document.getElementById('companyName') as HTMLInputElement;
        if (companyNameInput) {
            companyNameInput.value = company.name;
        }
        setSelectedCompany(company);
        setShowSearchModal(false);
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
                            placeholder="아이디(이메일)를 입력하세요"
                            className={styles.input}
                            required
                        />
                        <p style={{ fontSize: '12px', color: '#868e96', marginTop: '4px' }}>
                            이메일 형식을 권장합니다. (예: user@example.com)
                        </p>
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>비밀번호</label>
                        <input
                            type="password"
                            id="password"
                            placeholder="비밀번호 (6자 이상)"
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                id="companyName"
                                placeholder="회사 찾기 버튼을 이용해주세요"
                                className={styles.input}
                                required
                                readOnly
                                onClick={() => setShowSearchModal(true)}
                                style={{ flex: 1, backgroundColor: '#f8f9fa', cursor: 'pointer' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowSearchModal(true)}
                                style={{
                                    padding: '0 12px',
                                    height: '42px',
                                    borderRadius: '8px',
                                    border: '1px solid #ced4da',
                                    backgroundColor: '#f8f9fa',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                회사 찾기
                            </button>
                        </div>
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

            {/* Search Modal */}
            {showSearchModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
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
                        width: '90%',
                        maxWidth: '400px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        maxHeight: '80vh'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>회사 찾기</h3>
                            <button
                                onClick={() => setShowSearchModal(false)}
                                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="회사명을 검색하세요"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setHasSearched(false); // Reset when user types
                                }}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #ced4da',
                                    fontSize: '14px'
                                }}
                                autoFocus
                            />
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    backgroundColor: '#339af0',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                검색
                            </button>
                        </form>
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            minHeight: '200px',
                            border: '1px solid #f1f3f5',
                            borderRadius: '6px',
                            padding: '8px'
                        }}>
                            {isSearching ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#868e96' }}>검색 중...</div>
                            ) : searchResults.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {searchResults.map((company) => (
                                        <li
                                            key={company.id}
                                            onClick={() => handleSelectCompany(company)}
                                            style={{
                                                padding: '12px',
                                                borderBottom: '1px solid #f1f3f5',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                        >
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{company.name}</div>
                                            <div style={{ fontSize: '12px', color: '#868e96' }}>
                                                대표: {company.manager_name || '(미정)'}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#868e96', fontSize: '14px' }}>
                                    {hasSearched ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <span>검색 결과가 없습니다.</span>
                                            <button
                                                onClick={() => {
                                                    const companyNameInput = document.getElementById('companyName') as HTMLInputElement;
                                                    if (companyNameInput) {
                                                        companyNameInput.value = searchQuery;
                                                    }
                                                    setSelectedCompany(null);
                                                    setShowSearchModal(false);
                                                }}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#339af0',
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                '{searchQuery}'(으)로 신규 등록하기
                                            </button>
                                        </div>
                                    ) : (
                                        '회사명을 검색해보세요.'
                                    )}
                                </div>
                            )}
                        </div>
                    </div >
                </div >
            )
            }
        </div >
    );
}
