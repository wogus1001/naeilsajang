"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';

export default function NoticeEditPage() {
    const router = useRouter();
    const params = useParams();
    const [user, setUser] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'system' | 'team'>('team');
    const [isPinned, setIsPinned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            setUser(JSON.parse(userStr));
        } else {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }

        const fetchNotice = async () => {
            if (!params?.id) return;
            try {
                const res = await fetch(`/api/notices/${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setTitle(data.title);
                    setContent(data.content);
                    setType(data.type);
                    setIsPinned(data.isPinned || false);
                } else {
                    alert('공지사항을 찾을 수 없습니다.');
                    router.push('/board/notices');
                }
            } catch (error) {
                console.error(error);
                alert('데이터 불러오기 오류');
            } finally {
                setInitialLoading(false);
            }
        };

        fetchNotice();
    }, [router, params?.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/notices/${params?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    type,
                    isPinned
                })
            });

            if (res.ok) {
                alert('공지사항이 수정되었습니다.');
                router.push(`/board/notices/${params?.id}`);
            } else {
                alert('수정 실패');
            }
        } catch (error) {
            console.error(error);
            alert('오류 발생');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading || !user) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

    const isAdmin = user.role === 'admin';

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <button
                type="button"
                onClick={() => router.push(`/board/notices/${params?.id}`)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    background: 'none',
                    color: '#868e96',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '24px'
                }}
            >
                <ArrowLeft size={16} /> 취소하고 돌아가기
            </button>

            <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: '40px', border: '1px solid #f1f3f5' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '32px', color: '#212529' }}>공지사항 수정</h1>

                <form onSubmit={handleSubmit}>

                    {/* Notice Type Selection */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '10px' }}>공지 구분</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {isAdmin && (
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '12px 20px', borderRadius: '8px', border: type === 'system' ? '1px solid #fa5252' : '1px solid #e9ecef',
                                    background: type === 'system' ? '#fff5f5' : 'white', cursor: 'pointer'
                                }}>
                                    <input
                                        type="radio"
                                        name="type"
                                        value="system"
                                        checked={type === 'system'}
                                        onChange={() => setType('system')}
                                    />
                                    <span style={{ fontWeight: type === 'system' ? 'bold' : 'normal', color: type === 'system' ? '#fa5252' : '#495057' }}>📢 전체 공지 (시스템)</span>
                                </label>
                            )}

                            <label style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 20px', borderRadius: '8px', border: type === 'team' ? '1px solid #1971c2' : '1px solid #e9ecef',
                                background: type === 'team' ? '#e7f5ff' : 'white', cursor: 'pointer'
                            }}>
                                <input
                                    type="radio"
                                    name="type"
                                    value="team"
                                    checked={type === 'team'}
                                    onChange={() => setType('team')}
                                />
                                <span style={{ fontWeight: type === 'team' ? 'bold' : 'normal', color: type === 'team' ? '#1971c2' : '#495057' }}>👥 팀 공지 ({user.companyName})</span>
                            </label>
                        </div>
                        {!isAdmin && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#868e96', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={14} /> 팀 공지만 작성할 수 있습니다.
                            </div>
                        )}
                    </div>

                    {/* Dashboard Pin Option (Manager/Admin Only) */}
                    {(user.role === 'manager' || user.role === 'admin') && (
                        <div style={{ marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isPinned}
                                    onChange={(e) => setIsPinned(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#228be6' }}
                                />
                                <span style={{ fontWeight: '600', color: '#495057', fontSize: '14px' }}>대시보드 상단 고정 (전사 직원에게 노출됩니다)</span>
                            </label>
                        </div>
                    )}

                    {/* Title */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목을 입력하세요"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#339af0'}
                            onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                        />
                    </div>

                    {/* Content */}
                    <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용을 입력하세요..."
                            style={{
                                width: '100%',
                                height: '300px',
                                padding: '16px',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef',
                                fontSize: '15px',
                                outline: 'none',
                                resize: 'vertical',
                                lineHeight: '1.6',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#339af0'}
                            onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'linear-gradient(135deg, #339af0 0%, #228be6 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(34, 139, 230, 0.3)'
                        }}
                    >
                        {loading ? '수정 중...' : (
                            <>
                                <Save size={20} /> 수정 완료
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
