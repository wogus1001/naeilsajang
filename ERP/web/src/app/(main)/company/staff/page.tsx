"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Shield, Users as UsersIcon, AlertCircle } from 'lucide-react';

export default function StaffManagementPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            router.push('/login');
            return;
        }
        const parsedUser = JSON.parse(userStr);
        if (parsedUser.role !== 'manager') {
            alert('접근 권한이 없습니다.');
            router.push('/dashboard');
            return;
        }
        setUser(parsedUser);
        fetchStaff(parsedUser.companyName, parsedUser.companyId);
    }, [router]);

    const fetchStaff = async (companyName: string, companyId?: string) => {
        try {
            const res = await fetch(`/api/company/staff?companyName=${encodeURIComponent(companyName)}&companyId=${companyId || ''}`);
            if (res.ok) {
                const data = await res.json();
                setStaffList(data);
            }
        } catch (error) {
            console.error('Failed to fetch staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (targetUserId: string, action: 'approve' | 'promote' | 'demote') => {
        let confirmMsg = '';
        if (action === 'approve') confirmMsg = '이 직원의 가입을 승인하시겠습니까?';
        else if (action === 'promote') confirmMsg = '이 직원에게 팀장 권한을 부여하시겠습니까?';
        else if (action === 'demote') confirmMsg = '정말로 팀장 권한을 내려놓고 직원으로 변경하시겠습니까?';

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/company/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId,
                    action,
                    requesterId: user.id
                })
            });

            if (res.ok) {
                alert('처리되었습니다.');
// ... (omitted) ...
                                    </div >
    {
        managers.length < 2 && staff.id !== user.uid && staff.id !== user.id && (
            <button
                onClick={() => handleAction(staff.id, 'promote')}
                title="팀장 권한 부여"
                style={{ padding: '6px 12px', fontSize: '12px', background: 'white', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
            >
                팀장 승격
            </button>
        )
    }
                                </div >
                            ))
                        )
}
// If I demoted myself, I am no longer a manager. Reload to trigger redirects or UI updates.
if (action === 'demote' && targetUserId === user.id) {
    // Update local storage user
    const updatedUser = { ...user, role: 'staff' };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    window.location.href = '/dashboard'; // Redirect out as I lost access to this page
} else {
    fetchStaff(user.companyName);
}
            } else {
    const data = await res.json();
    alert(data.error || '오류가 발생했습니다.');
}
        } catch (error) {
    console.error('Action error:', error);
    alert('처리 중 오류가 발생했습니다.');
}
    };

if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

const pendingStaff = staffList.filter(u => u.status === 'pending_approval');
const managers = staffList.filter(u => u.role === 'manager');
const activeStaff = staffList.filter(u => u.role === 'staff' && u.status === 'active');

return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '12px' }}>직원 관리</h1>
            <p style={{ color: '#666' }}>
                {user?.companyName}의 직원 현황을 관리합니다.
            </p>
        </div>

        {/* 1. Pending Approval */}
        {pendingStaff.length > 0 && (
            <div style={{ marginBottom: '40px', background: '#fff9db', padding: '24px', borderRadius: '12px', border: '1px solid #ffe066' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#e67700' }}>
                    <AlertCircle size={20} /> 승인 대기 중인 직원 ({pendingStaff.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pendingStaff.map(staff => (
                        <div key={staff.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <div>
                                <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{staff.name}</span>
                                <span style={{ color: '#868e96', fontSize: '14px' }}>({staff.id})</span>
                            </div>
                            <button
                                onClick={() => handleAction(staff.id, 'approve')}
                                style={{ padding: '8px 16px', background: '#228be6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                가입 승인
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* 2. Managers */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={20} color="#7950f2" /> 팀장 ({managers.length}/2)
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {managers.map(mgr => (
                        <div key={mgr.id} style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#7950f2', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                                    M
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {mgr.name}
                                        {(mgr.id === user.uid || mgr.id === user.id) && <span style={{ fontSize: '11px', color: '#7950f2', marginLeft: '6px' }}>(나)</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#868e96' }}>{mgr.email || mgr.id}</div>
                                </div>
                            </div>
                            {(mgr.id === user.uid || mgr.id === user.id) && managers.length > 1 && (
                                <button
                                    onClick={() => handleAction(mgr.id, 'demote')}
                                    style={{
                                        padding: '6px 10px',
                                        fontSize: '11px',
                                        color: '#fa5252',
                                        background: 'white',
                                        border: '1px solid #fa5252',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    직원으로 변경
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Active Staff */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UsersIcon size={20} color="#228be6" /> 직원 ({activeStaff.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeStaff.length === 0 ? (
                        <div style={{ color: '#adb5bd', fontSize: '14px', textAlign: 'center', padding: '20px' }}>등록된 직원이 없습니다.</div>
                    ) : (
                        activeStaff.map(staff => (
                            <div key={staff.id} style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#228be6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        S
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {staff.name}
                                            {(staff.id === user.uid || staff.id === user.id || staff.email === user.email) && <span style={{ fontSize: '11px', color: '#228be6', marginLeft: '6px' }}>(나)</span>}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#868e96' }}>{staff.email || staff.id}</div>
                                    </div>
                                </div>
                                {managers.length < 2 && staff.id !== user.uid && staff.id !== user.id && staff.email !== user.email && (
                                    <button
                                        onClick={() => handleAction(staff.id, 'promote')}
                                        title="팀장 권한 부여"
                                        style={{ padding: '6px 12px', fontSize: '12px', background: 'white', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        팀장 승격
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
);
}
