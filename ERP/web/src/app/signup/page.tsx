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

    // ... handleSelectCompany unchanged ...

    // ... inside return ...
                            // Update input onChange to reset hasSearched
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
                        </form >

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
