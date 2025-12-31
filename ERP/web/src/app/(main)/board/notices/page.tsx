"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenSquare, Search, Megaphone, ChevronRight, Eye, User } from 'lucide-react';
import Link from 'next/link';

export default function NoticeListPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [notices, setNotices] = useState<any[]>([]);
    const [filter, setFilter] = useState<'all' | 'system' | 'team'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const parsed = JSON.parse(userStr);
            setUser(parsed);
            fetchNotices(parsed.companyName);
        } else {
            // Guest or not logged in - fetch system notices only
            fetchNotices('');
        }
    }, []);

    const fetchNotices = async (companyName: string) => {
        try {
            const res = await fetch(`/api/notices?companyName=${encodeURIComponent(companyName || '')}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setNotices(data);
            } else {
                console.error('API returned non-array:', data);
                setNotices([]);
            }
        } catch (error) {
            console.error('Failed to fetch notices:', error);
            setNotices([]);
        } finally {
            setLoading(false);
        }
    };

    const displayedNotices = notices.filter(n => {
        if (filter === 'all') return true;
        return n.type === filter;
    });

    const getRoleBadge = (role: string) => {
        if (role === 'admin') return <span style={{ background: '#212529', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>관리자</span>;
        if (role === 'manager') return <span style={{ background: '#e7f5ff', color: '#1971c2', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>팀장</span>;
        return <span style={{ background: '#f8f9fa', color: '#495057', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>직원</span>;
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', color: '#212529' }}>공지사항</h1>
                    <p style={{ color: '#868e96', fontSize: '16px' }}>중요한 소식과 업데이트를 확인하세요.</p>
                </div>
                <button
                    onClick={() => router.push('/board/notices/write')}
                    style={{
                        padding: '10px 20px',
                        background: '#228be6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(34, 139, 230, 0.2)'
                    }}
                >
                    <PenSquare size={18} />
                    글쓰기
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #f1f3f5', paddingBottom: '16px' }}>
                <button
                    onClick={() => setFilter('all')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        background: filter === 'all' ? '#343a40' : '#f8f9fa',
                        color: filter === 'all' ? 'white' : '#495057',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    전체
                </button>
                <button
                    onClick={() => setFilter('team')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        background: filter === 'team' ? '#1971c2' : '#f8f9fa',
                        color: filter === 'team' ? 'white' : '#495057',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    👥 팀 공지
                </button>
                <button
                    onClick={() => setFilter('system')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        background: filter === 'system' ? '#fa5252' : '#f8f9fa',
                        color: filter === 'system' ? 'white' : '#495057',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    📢 전체 공지
                </button>
            </div>

            {/* List */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f3f5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#adb5bd' }}>로딩 중...</div>
                ) : displayedNotices.length > 0 ? (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 150px 120px 80px', padding: '16px 20px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef', fontSize: '13px', fontWeight: '700', color: '#868e96', textAlign: 'center' }}>
                            <div>번호</div>
                            <div>구분</div>
                            <div style={{ textAlign: 'left', paddingLeft: '10px' }}>제목</div>
                            <div>작성자</div>
                            <div>날짜</div>
                            <div>조회</div>
                        </div>
                        {displayedNotices.map((notice, idx) => (
                            <div
                                key={notice.id}
                                onClick={() => router.push(`/board/notices/${notice.id}`)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '80px 100px 1fr 150px 120px 80px',
                                    padding: '20px',
                                    borderBottom: idx === displayedNotices.length - 1 ? 'none' : '1px solid #f1f3f5',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.1s',
                                    fontSize: '14px',
                                    textAlign: 'center',
                                    color: '#495057'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                <div style={{ color: '#adb5bd', fontSize: '13px' }}>{displayedNotices.length - idx}</div>
                                <div>
                                    {notice.type === 'system' ? (
                                        <span style={{ fontSize: '12px', color: '#fa5252', fontWeight: 'bold' }}>📢 전체 공지</span>
                                    ) : (
                                        <span style={{ fontSize: '12px', color: '#1971c2', fontWeight: 'bold' }}>팀 공지</span>
                                    )}
                                </div>
                                <div style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: '600', color: '#343a40', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {notice.isPinned && <span title="고정됨">📌</span>}
                                    {notice.title}
                                    {/* New badge logic if needed, comparing date */}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {getRoleBadge(notice.authorRole)}
                                    <span>{notice.authorName}</span>
                                </div>
                                <div style={{ color: '#868e96', fontSize: '13px' }}>{notice.createdAt}</div>
                                <div style={{ color: '#868e96', fontSize: '13px' }}>{notice.views}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '80px', textAlign: 'center', color: '#adb5bd' }}>
                        <Megaphone size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                        <p>등록된 공지사항이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
