"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, CheckCircle, XCircle, Shield, User, Clock, Key, Lock } from 'lucide-react';

// Reuse some styles but inline for admin specific needs to avoid module weirdness
const styles = {
    container: { padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-pretendard)' },
    header: { marginBottom: '24px' },
    title: { fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0', color: '#212529' },
    subtitle: { fontSize: '16px', color: '#868e96', margin: 0 },

    // Tab Styles
    tabContainer: { display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #dee2e6' },
    tab: {
        padding: '12px 20px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        color: '#868e96',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    activeTab: {
        borderBottom: '2px solid #1971c2',
        color: '#1971c2'
    },
    badge: {
        backgroundColor: '#fa5252', color: 'white', fontSize: '11px', padding: '2px 6px', borderRadius: '10px', fontWeight: 700
    },

    // Table Styles
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e9ecef', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
    th: { textAlign: 'left' as const, padding: '16px', borderBottom: '1px solid #e9ecef', color: '#868e96', fontWeight: 600, fontSize: '13px', backgroundColor: '#f8f9fa' },
    td: { padding: '16px', borderBottom: '1px solid #f1f3f5', color: '#495057' },
    tr: { transition: 'background-color 0.2s' },

    // Actions
    actionBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
    approveBtn: { backgroundColor: '#e6fcf5', color: '#0ca678' },
    rejectBtn: { backgroundColor: '#fff5f5', color: '#fa5252' },

    // Status Badges
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
};

import { createClient } from '@/utils/supabase/client';

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    useEffect(() => {
        // Auth check
        const userStr = localStorage.getItem('user');
        if (!userStr || JSON.parse(userStr).role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (user: any) => {
        if (!confirm(`${user.name}님의 가입을 승인하시겠습니까?`)) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.uuid,
                    status: 'active'
                })
            });

            if (res.ok) {
                alert('승인되었습니다.');
                fetchUsers();
            } else {
                alert('승인 처리 실패');
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;

        try {
            const res = await fetch(`/api/users?id=${deleteTargetId}`, { method: 'DELETE' });
            if (res.ok) {
                setDeleteTargetId(null);
                fetchUsers();
            } else {
                const data = await res.json();
                console.error('Delete failed response:', data);
                alert(`삭제 실패 (DEBUG): ${JSON.stringify(data, null, 2)}`);
            }
        } catch (error) {
            console.error(error);
            alert('삭제 중 오류 발생');
        }
    };

    // Derived state
    const pendingUsers = users.filter(u => u.status === 'pending_approval');
    const filteredUsers = activeTab === 'pending' ? pendingUsers : users;

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <span style={{ ...styles.statusBadge, backgroundColor: '#e7f5ff', color: '#1971c2' }}>관리자</span>;
            case 'manager': return <span style={{ ...styles.statusBadge, backgroundColor: '#fff0f6', color: '#c2255c' }}>팀장</span>;
            case 'staff': return <span style={{ ...styles.statusBadge, backgroundColor: '#f3f0ff', color: '#7950f2' }}>직원</span>;
            default: return <span style={{ ...styles.statusBadge, backgroundColor: '#f8f9fa', color: '#868e96' }}>사용자</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <span style={{ ...styles.statusBadge, backgroundColor: '#e6fcf5', color: '#0ca678' }}>활성</span>;
            case 'pending_approval': return <span style={{ ...styles.statusBadge, backgroundColor: '#fff9db', color: '#f08c00' }}>승인대기</span>;
            case 'blocked': return <span style={{ ...styles.statusBadge, backgroundColor: '#fff5f5', color: '#fa5252' }}>차단됨</span>;
            default: return <span style={{ ...styles.statusBadge, backgroundColor: '#f8f9fa', color: '#868e96' }}>-</span>;
        }
    };

    // --- PASSWORD RESET LOGIC ---
    const [resetTargetId, setResetTargetId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const handlePasswordReset = async () => {
        if (!resetTargetId || !newPassword) return;
        if (newPassword.length < 6) {
            alert('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        if (!confirm('정말 이 사용자의 비밀번호를 변경하시겠습니까?')) return;

        setResetLoading(true);
        try {
            // Get current session token
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            console.log('[DEBUG-CLIENT] Reset Password Token:', token ? 'Token exists' : 'Token missing');
            if (!token) {
                alert('로그인 세션이 만료된 것 같습니다. 새로고침 후 다시 시도해주세요.');
                setResetLoading(false);
                return;
            }

            const res = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: resetTargetId,
                    newPassword: newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('비밀번호가 성공적으로 변경되었습니다.');
                setResetTargetId(null);
                setNewPassword('');
            } else {
                console.error('Reset failed data:', data);
                alert(`변경 실패 (DEBUG): ${JSON.stringify(data, null, 2)}`);
            }
        } catch (e: any) {
            console.error('Password reset failed', e);
            alert(`오류가 발생했습니다: ${e.message}`);
        } finally {
            setResetLoading(false);
        }
    };

    if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>회원 및 권한 관리</h1>
                <p style={styles.subtitle}>사용자의 가입 승인, 등급 변경, 탈퇴 처리 및 비밀번호 재설정을 관리합니다.</p>
            </div>

            {/* Tabs */}
            <div style={styles.tabContainer}>
                <div
                    style={{ ...styles.tab, ...(activeTab === 'all' ? styles.activeTab : {}) }}
                    onClick={() => setActiveTab('all')}
                >
                    전체 사용자
                    <span style={{ fontSize: '12px', color: '#adb5bd', fontWeight: 400 }}>{users.length}</span>
                </div>
                <div
                    style={{ ...styles.tab, ...(activeTab === 'pending' ? styles.activeTab : {}) }}
                    onClick={() => setActiveTab('pending')}
                >
                    승인 대기
                    {pendingUsers.length > 0 && (
                        <span style={styles.badge}>{pendingUsers.length}</span>
                    )}
                </div>
            </div>

            {/* Table */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>사용자 정보</th>
                            <th style={styles.th}>소속 회사</th>
                            <th style={styles.th}>권한</th>
                            <th style={styles.th}>상태</th>
                            <th style={styles.th}>가입일</th>
                            <th style={styles.th}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <tr key={user.id} style={styles.tr}>
                                    <td style={styles.td}>
                                        <div style={{ fontWeight: 'bold', color: '#343a40' }}>{user.id}</div>
                                        <div style={{ fontSize: '12px', color: '#868e96' }}>{user.name}</div>
                                    </td>
                                    <td style={styles.td}>{user.companyName || '-'}</td>
                                    <td style={styles.td}>{getRoleBadge(user.role)}</td>
                                    <td style={styles.td}>{getStatusBadge(user.status)}</td>
                                    <td style={styles.td}><span style={{ color: '#868e96', fontSize: '13px' }}>{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}</span></td>
                                    <td style={styles.td}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {user.status === 'pending_approval' && (
                                                <button
                                                    style={{ ...styles.actionBtn, ...styles.approveBtn }}
                                                    onClick={() => handleApprove(user)}
                                                >
                                                    <CheckCircle size={14} /> 승인
                                                </button>
                                            )}

                                            <button
                                                style={{ ...styles.actionBtn, backgroundColor: '#f1f3f5', color: '#495057' }}
                                                onClick={() => { setResetTargetId(user.uuid); setNewPassword(''); }}
                                                title="비밀번호 변경"
                                            >
                                                <Key size={14} /> <span style={{ fontSize: '11px' }}>비번변경</span>
                                            </button>

                                            {user.role !== 'admin' && (
                                                <button
                                                    style={{ ...styles.actionBtn, color: '#fa5252', backgroundColor: 'transparent' }}
                                                    onClick={() => setDeleteTargetId(user.uuid)}
                                                    title="삭제"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#adb5bd' }}>
                                    데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Modal */}
            {deleteTargetId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>사용자 삭제</h3>
                        <p style={{ color: '#666', marginBottom: '24px' }}>정말 이 사용자를 삭제하시겠습니까?</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setDeleteTargetId(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' }}>취소</button>
                            <button onClick={handleDelete} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#fa5252', color: 'white', cursor: 'pointer' }}>삭제</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Reset Modal */}
            {resetTargetId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '360px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>비밀번호 변경</h3>
                        <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
                            새로운 비밀번호를 입력하세요. <br />
                            (변경 후 즉시 적용됩니다)
                        </p>
                        <input
                            type="password"
                            placeholder="새 비밀번호 (6자 이상)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '6px',
                                border: '1px solid #dee2e6', marginBottom: '20px', fontSize: '14px'
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={() => setResetTargetId(null)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handlePasswordReset}
                                disabled={resetLoading}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    backgroundColor: '#228be6', color: 'white', cursor: 'pointer',
                                    opacity: resetLoading ? 0.7 : 1
                                }}
                            >
                                {resetLoading ? '변경 중...' : '변경하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
