"use client";

import React, { useState, useEffect } from 'react';
import { Search, User, CreditCard, Check } from 'lucide-react';
import styles from './PersonSelectorModal.module.css';

interface PersonSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (person: any, type: 'customer' | 'businessCard') => void;
    companyName: string; // To filter data
    initialTab?: 'customer' | 'businessCard';
}

export default function PersonSelectorModal({ isOpen, onClose, onSelect, companyName, initialTab = 'customer' }: PersonSelectorModalProps) {
    const [activeTab, setActiveTab] = useState<'customer' | 'businessCard'>('customer');
    const [searchQuery, setSearchQuery] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [businessCards, setBusinessCards] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize Tab on Open
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            if (initialTab) {
                setActiveTab(initialTab);
            }
        }
    }, [isOpen, initialTab]);

    // Fetch Data on Open or Tab Change
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab]);

    // ESC Key Handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const url = activeTab === 'customer' ? '/api/customers' : '/api/business-cards';
            const params = new URLSearchParams();
            if (companyName) {
                params.set('company', companyName);
            }

            if (activeTab === 'businessCard') {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed;
                    const userId = user?.uid || user?.id;
                    if (userId) {
                        params.set('userId', userId);
                    }
                }
            }

            const query = params.toString();
            const res = await fetch(`${url}${query ? `?${query}` : ''}`);
            if (res.ok) {
                const data = await res.json();
                if (activeTab === 'customer') {
                    setCustomers(data);
                } else {
                    setBusinessCards(data);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredList = (activeTab === 'customer' ? customers : businessCards).filter(item => {
        const query = searchQuery.toLowerCase();
        if (activeTab === 'customer') {
            return (
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.phone && item.phone.includes(query)) ||
                (item.feature && item.feature.toLowerCase().includes(query)) ||
                (item.memoSituation && item.memoSituation.toLowerCase().includes(query))
            );
        } else {
            return (
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.companyName && item.companyName.toLowerCase().includes(query)) ||
                (item.category && item.category.toLowerCase().includes(query)) ||
                (item.department && item.department.toLowerCase().includes(query)) ||
                (item.memo && item.memo.toLowerCase().includes(query))
            );
        }
    });

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>목록에서 찾기</h3>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'customer' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('customer')}
                    >
                        <User size={16} /> 고객 목록
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'businessCard' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('businessCard')}
                    >
                        <CreditCard size={16} /> 명함 목록
                    </button>
                </div>

                <div className={styles.searchBar}>
                    <div className={styles.searchInputWrapper}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder={`${activeTab === 'customer' ? '고객명, 연락처, 특징, 상황' : '이름, 회사명, 분류, 부서, 메모'} 검색`}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                            autoFocus
                        />
                    </div>
                </div>

                <div className={styles.listContainer}>
                    {isLoading ? (
                        <div className={styles.loading}>로딩 중...</div>
                    ) : filteredList.length === 0 ? (
                        <div className={styles.empty}>검색 결과가 없습니다.</div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    {activeTab === 'customer' ? (
                                        <>
                                            <th style={{ width: 80 }}>고객명</th>
                                            <th style={{ width: 60 }}>등급</th>
                                            <th style={{ width: 50 }}>분류</th>
                                            <th style={{ width: 80 }}>진행상태</th>
                                            <th style={{ width: 150 }}>특징</th>
                                            <th style={{ width: 100 }}>고객상황</th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={{ width: 80 }}>이름</th>
                                            <th style={{ width: 120 }}>회사명</th>
                                            <th style={{ width: 60 }}>분류</th>
                                            <th style={{ width: 150 }}>부서/직급</th>
                                            <th>메모</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((item, index) => (
                                    <tr key={item.id || index} onClick={() => onSelect(item, activeTab)}>
                                        {activeTab === 'customer' ? (
                                            <>
                                                <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                                                <td>
                                                    <span className={`${styles.badge} ${styles[item.grade] || ''}`}>
                                                        {item.grade === 'progress' ? '추진' :
                                                            item.grade === 'manage' ? '관리' :
                                                                item.grade === 'hold' ? '보류' :
                                                                    item.grade === 'complete' ? '완료' : item.grade}
                                                    </span>
                                                </td>
                                                <td>{item.class}</td>
                                                <td>
                                                    <span className={styles.statusText}>{item.status}</span>
                                                </td>
                                                <td className={styles.truncate}>
                                                    {item.feature}
                                                </td>
                                                <td className={styles.truncate}>
                                                    {item.memoSituation}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                                                <td className={styles.truncate}>{item.companyName}</td>
                                                <td>{item.category}</td>
                                                <td className={styles.truncate}>{item.department}</td>
                                                <td className={styles.truncate}>{item.memo}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
