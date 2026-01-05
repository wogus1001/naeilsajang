"use client";

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { User, Lock, Save, AlertCircle, CheckCircle, Shield } from 'lucide-react';

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

    // ID duplication check state
    const [isIdChecked, setIsIdChecked] = useState(true); // Default true if unchanged
    const [idCheckMessage, setIdCheckMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);

            // [CRITICAL FIX] If session is old and missing UID, force re-login to ensure UUID availability
            if (!parsed.uid) {
                alert('시스템 업데이트로 인해 보안 정보 갱신이 필요합니다.\n다시 로그인해주세요.');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return;
            }

            setUser(parsed);
            setFormData(prev => ({
                ...prev,
                id: parsed.id,
                name: parsed.name,
                companyName: parsed.companyName || ''
            }));
            setIsIdChecked(true); // Initial ID is valid

            // Fetch UCanSign status
            fetch(`/api/user/status?userId=${parsed.uid}`) // Use UID here for safety too
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

        if (name === 'id') {
            if (value !== user?.id) {
                setIsIdChecked(false);
                setIdCheckMessage(null);
            } else {
                setIsIdChecked(true);
                setIdCheckMessage(null);
            }
        }
    };

    const handleCheckId = async () => {
        if (!formData.id) {
            setIdCheckMessage({ text: '아이디를 입력해주세요.', type: 'error' });
            return;
        }

        try {
            const res = await fetch('/api/users/check-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: formData.id })
            });
            const data = await res.json();

            if (data.available) {
                setIsIdChecked(true);
                setIdCheckMessage({ text: '사용 가능한 아이디입니다.', type: 'success' });
            } else {
                setIsIdChecked(false);
                setIdCheckMessage({ text: '이미 사용 중인 아이디입니다.', type: 'error' });
            }
        } catch (error) {
            console.error('Check ID failed:', error);
            setIdCheckMessage({ text: '확인 중 오류가 발생했습니다.', type: 'error' });
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (formData.id !== user.id && !isIdChecked) {
            alert('아이디 중복 확인을 해주세요.');
            return;
        }

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
                    targetUuid: user.uid, // Explicitly target by UUID
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

                const updatedUser = { ...data.user, uid: user.uid }; // Preserve UUID
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);

                // Reset password fields
                setFormData(prev => ({
                    ...prev,
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));

                // If ID changed, logout
                if (data.user.id !== user.id) {
                    alert('아이디가 변경되었습니다. 다시 로그인해주세요.');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                } else {
                    window.location.reload();
                }

            } else {
                console.error('Update failed response:', data);
                alert(`수정 실패: ${data.error || JSON.stringify(data)}`);
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
                    <p>회원님의 정보를 안전하게 관리하고 업데이트하세요.</p>
                </div>

                <form onSubmit={handleSave} className={styles.form}>
                    {/* Basic Info Section */}
                    <div className={styles.section}>
                        <h3><User size={20} /> 기본 정보</h3>
                        <div className={styles.grid}>
                            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                <label>아이디</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        name="id"
                                        value={formData.id}
                                        onChange={handleChange}
                                        placeholder="아이디"
                                    />
                                    <button
                                        type="button"
                                        className={styles.checkBtn}
                                        onClick={handleCheckId}
                                        disabled={formData.id === user.id}
                                    >
                                        중복 확인
                                    </button>
                                </div>
                                {idCheckMessage && (
                                    <span className={`${styles.helperText} ${idCheckMessage.type === 'success' ? styles.successText : styles.errorText}`}>
                                        {idCheckMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        {idCheckMessage.text}
                                    </span>
                                )}
                                {!idCheckMessage && formData.id !== user.id && (
                                    <span className={`${styles.helperText} ${styles.errorText}`}>
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

                            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                <label>직급</label>
                                <div>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        borderRadius: '30px',
                                        backgroundColor: user.role === 'manager' ? '#e7f5ff' : '#f8f9fa',
                                        color: user.role === 'manager' ? '#1971c2' : '#495057',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        border: user.role === 'manager' ? '1px solid #d0ebff' : '1px solid #e9ecef',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                                    }}>
                                        <Shield size={14} fill={user.role === 'manager' ? '#1971c2' : 'none'} />
                                        {user.role === 'manager' ? '팀장 (Manager)' : '직원 (Staff)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className={styles.section}>
                        <h3><Lock size={20} /> 비밀번호 변경</h3>
                        <p className={styles.sectionDesc}>비밀번호를 변경하려면 현재 비밀번호와 새 비밀번호를 입력하세요.</p>

                        <div className={styles.grid}>
                            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                <label>현재 비밀번호</label>
                                <input
                                    type="password"
                                    name="oldPassword"
                                    value={formData.oldPassword}
                                    onChange={handleChange}
                                    placeholder="현재 비밀번호를 입력하세요"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>새 비밀번호</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    placeholder="새 비밀번호 (8자 이상)"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>새 비밀번호 확인</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="새 비밀번호를 한번 더 입력하세요"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Integration Section */}
                    <div className={styles.section}>
                        <h3><Save size={20} /> 서비스 연동</h3>

                        <div className={styles.integrationCard}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#343a40' }}>
                                    <span>유캔싸인 (UCanSign)</span>
                                    {ucansignStatus.connected && (
                                        <span style={{
                                            fontSize: '11px',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            backgroundColor: '#e3f2fd',
                                            color: '#1864ab',
                                            fontWeight: '600'
                                        }}>
                                            CONNECTED
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '14px', color: '#868e96', lineHeight: '1.4' }}>
                                    전자계약 서비스를 위해 계정을 연동합니다.<br />
                                    {ucansignStatus.connected
                                        ? <span style={{ color: '#2b8a3e', fontWeight: '600' }}>
                                            {ucansignStatus.linkedAt ? `연동 일시: ${new Date(ucansignStatus.linkedAt).toLocaleDateString()}` : '연동됨'}
                                        </span>
                                        : '현재 연동된 계정이 없습니다.'}
                                </div>
                            </div>

                            {!ucansignStatus.connected ? (
                                <button
                                    type="button"
                                    onClick={() => window.location.href = `/api/ucansign/auth?userId=${user.id}`}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#228be6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        boxShadow: '0 2px 5px rgba(34, 139, 230, 0.2)'
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
                                        padding: '10px 20px',
                                        backgroundColor: 'white',
                                        color: '#fa5252',
                                        border: '1px solid #fa5252',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    연동 해제
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Withdrawal Section */}
                    <div className={styles.section} style={{ borderBottom: 'none' }}>
                        <h3 style={{ color: '#fa5252' }}><AlertCircle size={20} /> 회원 탈퇴</h3>
                        <p className={styles.sectionDesc}>
                            더 이상 서비스를 이용하지 않으시려면 회원 탈퇴를 진행해 주세요.<br />
                            탈퇴 시 모든 데이터는 삭제되며 복구할 수 없습니다.
                        </p>

                        <div style={{
                            padding: '20px',
                            backgroundColor: '#fff5f5',
                            borderRadius: '8px',
                            border: '1px solid #ffc9c9',
                            marginTop: '15px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#c92a2a', marginBottom: '4px' }}>계정 삭제</div>
                                    <div style={{ fontSize: '13px', color: '#495057' }}>
                                        {user.role === 'manager'
                                            ? '팀장 권한을 보유 중인 경우, 권한을 변경하거나 위임한 후 탈퇴할 수 있습니다.'
                                            : '탈퇴 시 계정과 관련된 모든 정보가 영구적으로 삭제됩니다.'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

                                        try {
                                            const res = await fetch(`/api/users?id=${user.uid || user.id}`, { method: 'DELETE' });
                                            const data = await res.json();

                                            if (res.ok) {
                                                alert('탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
                                                localStorage.removeItem('user');
                                                window.location.href = '/login';
                                            } else {
                                                console.error('Withdraw failed response:', data);
                                                alert(`탈퇴 실패: ${data.error || JSON.stringify(data)}`);
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('오류가 발생했습니다.');
                                        }
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#fa5252',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    탈퇴하기
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="submit" className={styles.saveBtn} disabled={isLoading}>
                            <Save size={18} />
                            {isLoading ? '저장 중...' : '변경사항 저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
