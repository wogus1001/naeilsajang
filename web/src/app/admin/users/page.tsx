"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../(main)/properties/page.module.css'; // Reuse dashboard styles
import { Trash2, User } from 'lucide-react';

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    useEffect(() => {
        // Check admin role
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/login');
            return;
        }

        const user = JSON.parse(storedUser);
        if (user.role !== 'admin') {
            alert('관리자만 접근할 수 있습니다.');
            router.push('/properties');
            return;
        }

        setCurrentUser(user);
        fetchUsers();
    }, [router]);

    const fetchUsers = async () => {
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

    const confirmDelete = (userId: string) => {
        setDeleteTargetId(userId);
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;

        try {
            const res = await fetch(`/api/users?id=${deleteTargetId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // alert('사용자가 삭제되었습니다.'); // Optional: replace with toast or just refresh
                setDeleteTargetId(null);
                fetchUsers(); // Refresh list
            } else {
                const data = await res.json();
                alert(data.error || '삭제 실패');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('삭제 중 오류 발생');
        }
    };

    if (isLoading) return <div className={styles.container}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>회원 관리</h1>
                <p className={styles.subtitle}>등록된 사용자 목록을 관리합니다.</p>
            </div>

            <div className={styles.content}>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>이름</th>
                                <th>회사명</th>
                                <th>권한</th>
                                <th>가입일</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.name}</td>
                                    <td>{user.companyName || '-'}</td>
                                    <td>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: user.role === 'admin' ? '#e3f2fd' : '#f5f5f5',
                                            color: user.role === 'admin' ? '#1976d2' : '#666',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            {user.role === 'admin' ? '관리자' : '사용자'}
                                        </span>
                                    </td>
                                    <td>{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}</td>
                                    <td>
                                        {user.role !== 'admin' && (
                                            <button
                                                onClick={() => confirmDelete(user.id)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ff4444' }}
                                                title="삭제"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {deleteTargetId && (
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
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>사용자 삭제</h3>
                        <p style={{ color: '#666', marginBottom: '24px' }}>정말 이 사용자를 삭제하시겠습니까?</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={() => setDeleteTargetId(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#ff4444',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
