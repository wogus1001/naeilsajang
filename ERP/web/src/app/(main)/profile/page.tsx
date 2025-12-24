"use client";

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { User, Lock, Save, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        companyName: '',
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [ucansignStatus, setUcansignStatus] = useState<{ connected: boolean; linkedAt?: string }>({ connected: false });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setFormData(prev => ({
                ...prev,
                id: parsed.id,
                name: parsed.name,
                companyName: parsed.companyName || ''
            }));

            // Fetch UCanSign status
            fetch(`/api/user/status?userId=${parsed.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.connected) {
                        setUcansignStatus({ connected: true, linkedAt: data.linkedAt });
                    }
                })
                .catch(err => console.error('Failed to fetch status:', err));
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Validation for password change
        if (formData.newPassword) {
            if (!formData.oldPassword) {
                alert('비밀번호를 변경하려면 기존 비밀번호를 입력해주세요.');
                return;
            }
            if (formData.newPassword !== formData.confirmPassword) {
                alert('새 비밀번호가 일치하지 않습니다.');
                return;
            }
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/user/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentId: user.id,
                    newId: formData.id !== user.id ? formData.id : undefined,
                    name: formData.name,
                    companyName: formData.companyName,
                    oldPassword: formData.newPassword ? formData.oldPassword : undefined,
                    newPassword: formData.newPassword || undefined
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('회원정보가 수정되었습니다.');

                // If ID changed, logout might be safer, but for now just update local storage
                // If ID changed, we must update the stored "user" object's ID too.
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);

                // Reset password fields
                setFormData(prev => ({
                    ...prev,
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));

                // If ID changed, force logout to avoid issues? Or just notify?
                if (data.user.id !== user.id) {
                    alert('아이디가 변경되었습니다. 다시 로그인해주세요.');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                } else {
                    // Force header refresh if needed - reload page or use context
                    window.location.reload();
                }

            } else {
                alert(data.error || '수정에 실패했습니다.');
            }

        } catch (error) {
            console.error('Update failed:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return <div className={styles.container}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h2>개인정보 수정</h2>
                    <p>회원님의 정보를 안전하게 관리하세요.</p>
                </div>

                <form onSubmit={handleSave} className={styles.form}>
                    <div className={styles.section}>
                        <h3>기본 정보</h3>
                        <div className={styles.inputGroup}>
                            <label>아이디</label>
                            <input
                                name="id"
                                value={formData.id}
                                onChange={handleChange}
                                placeholder="아이디"
                            />
                            {formData.id !== user.id && (
                                <span className={styles.helperText}>
                                    <AlertCircle size={14} /> 아이디 변경 시 다시 로그인해야 합니다.
                                </span>
                            )}
                        </div>

                        <div className={styles.inputGroup}>
                            <label>이름</label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="이름"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>회사명</label>
                            <input
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="회사명"
                            />
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3>비밀번호 변경</h3>
                        <p className={styles.sectionDesc}>비밀번호를 변경하려면 아래 정보를 입력하세요.</p>

                        <div className={styles.inputGroup}>
                            <label>현재 비밀번호</label>
                            <input
                                type="password"
                                name="oldPassword"
                                value={formData.oldPassword}
                                onChange={handleChange}
                                placeholder="현재 비밀번호"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>새 비밀번호</label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="새 비밀번호"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>새 비밀번호 확인</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="새 비밀번호 확인"
                            />
                        </div>
                    </div>


                    <div className={styles.section}>
                        <h3>전자계약 연동 (UCanSign)</h3>
                        <p className={styles.sectionDesc}>
                            전자계약 서비스를 이용하려면 유캔싸인 계정을 연동해야 합니다.<br />
                            계약 발송 시 연동된 계정의 포인트를 사용합니다.
                        </p>

                        <div className={styles.integrationCard} style={{
                            padding: '20px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            marginTop: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid #e9ecef'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>유캔싸인 (UCanSign)</span>
                                    {ucansignStatus.connected && (
                                        <span style={{
                                            fontSize: '12px',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            backgroundColor: '#e3f2fd',
                                            color: '#1976d2',
                                            fontWeight: 'normal'
                                        }}>
                                            연동됨
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                    {ucansignStatus.connected
                                        ? `연동 일시: ${new Date(ucansignStatus.linkedAt!).toLocaleDateString()}`
                                        : '계정이 연동되지 않았습니다.'}
                                </div>
                            </div>

                            {!ucansignStatus.connected ? (
                                <button
                                    type="button"
                                    onClick={() => window.location.href = `/api/ucansign/auth?userId=${user.id}`}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#1976d2',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    연동하기
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('정말 연동을 해제하시겠습니까?')) return;
                                        try {
                                            const res = await fetch(`/api/ucansign/disconnect?userId=${user.id}`, { method: 'DELETE' });
                                            if (res.ok) {
                                                alert('연동이 해제되었습니다.');
                                                window.location.reload();
                                            } else {
                                                alert('해제 실패');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('오류 발생');
                                        }
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#fff',
                                        color: '#ef4444',
                                        border: '1px solid #ef4444',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    연동 해제
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="submit" className={styles.saveBtn} disabled={isLoading}>
                            <Save size={18} />
                            {isLoading ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
