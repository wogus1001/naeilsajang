"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import styles from './page.module.css';
import { AlertModal } from '@/components/common/AlertModal';

type LoginUser = {
    id?: string;
    uid?: string;
    name?: string;
    role?: string;
    companyName?: string;
};

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loggedInUser, setLoggedInUser] = useState<LoginUser | null>(null);

    const [savedId, setSavedId] = useState('');
    const [rememberId, setRememberId] = useState(false);

    React.useEffect(() => {
        const bootstrap = async () => {
            const saved = localStorage.getItem('saved_login_id');
            if (saved) {
                setSavedId(saved);
                setRememberId(true);
            }

            try {
                const supabase = getSupabase();
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData.session?.access_token;

                if (!accessToken) {
                    localStorage.removeItem('user');
                    setLoggedInUser(null);
                    return;
                }

                const meRes = await fetch('/api/auth/me', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: 'no-store'
                });

                if (!meRes.ok) {
                    await supabase.auth.signOut();
                    localStorage.removeItem('user');
                    setLoggedInUser(null);
                    return;
                }

                const payload = await meRes.json() as { user?: LoginUser };
                if (!payload.user) {
                    localStorage.removeItem('user');
                    setLoggedInUser(null);
                    return;
                }

                localStorage.setItem('user', JSON.stringify(payload.user));
                setLoggedInUser(payload.user);
            } catch (error) {
                console.error('Failed to bootstrap login state:', error);
                localStorage.removeItem('user');
                setLoggedInUser(null);
            }
        };

        void bootstrap();
    }, []);

    const handleLogout = async () => {
        try {
            const supabase = getSupabase();
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Failed to sign out from login page:', error);
        }
        localStorage.removeItem('user');
        setLoggedInUser(null);
        window.location.reload();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        const id = (document.getElementById('email') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        try {
            // Heuristic for migration compatibility + Default Domain
            // If no @, assume it's a legacy ID and append default domain
            let email = id;
            if (!id.includes('@')) {
                email = `${id}@example.com`;
            }

            const supabase = getSupabase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('Supabase auth error:', error);
                if (error.message.includes('Invalid login credentials')) {
                    setErrorMsg('아이디 또는 비밀번호가 일치하지 않습니다.');
                } else {
                    setErrorMsg(error.message);
                }
            } else if (data.user) {
                // Fetch additional profile info from 'profiles' table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (!profile) {
                    await supabase.auth.signOut();
                    setErrorMsg('사용자 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');
                    setIsLoading(false);
                    return;
                }

                // Security Check: Enforce Status
                console.log('[Login] Profile Status:', profile.status);

                if (profile.status === 'pending_approval') {
                    await supabase.auth.signOut();
                    setErrorMsg('승인 대기 중입니다. 팀장의 승인 후 이용 가능합니다.');
                    setIsLoading(false);
                    return;
                }

                if (profile.status !== 'active') { // Explicit check, no fallback
                    await supabase.auth.signOut();
                    setErrorMsg('사용이 정지된 계정입니다. 관리자에게 문의하세요.');
                    setIsLoading(false);
                    return;
                }

                const { data: company } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', profile.company_id)
                    .single();

                // Construct user object
                const userInfo = {
                    id: id,
                    email: data.user.email,
                    name: profile.name || data.user.user_metadata.name || '사용자',
                    role: profile.role || 'staff',
                    companyName: company?.name || '',
                    companyId: profile.company_id,
                    uid: data.user.id,
                    status: profile.status // No default 'active'
                };

                if (rememberId) {
                    localStorage.setItem('saved_login_id', id);
                } else {
                    localStorage.removeItem('saved_login_id');
                }

                localStorage.setItem('user', JSON.stringify(userInfo));
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Login error:', error);
            setErrorMsg('로그인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>
                        <div className={styles.gridIcon} />
                    </div>
                    <h1 className={styles.title}>내일사장</h1>
                    <p className={styles.subtitle}>부동산 전문가를 위한 통합 솔루션</p>
                </div>

                {loggedInUser ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ marginBottom: '24px', fontSize: '16px', color: '#333' }}>
                            <strong>{loggedInUser.name}</strong>님, 이미 로그인되어 있습니다.
                        </p>
                        <button
                            onClick={() => { void handleLogout(); }}
                            className={styles.loginButton}
                            style={{ backgroundColor: '#ff4444' }}
                        >
                            로그아웃
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className={styles.loginButton}
                            style={{ marginTop: '12px', backgroundColor: '#2196f3' }}
                        >
                            메인으로 이동
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>아이디</label>
                            <input
                                type="text"
                                id="email"
                                placeholder="아이디를 입력하세요"
                                className={styles.input}
                                defaultValue={savedId}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>비밀번호</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="비밀번호를 입력하세요"
                                className={styles.input}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                            <input
                                type="checkbox"
                                id="rememberId"
                                checked={rememberId}
                                onChange={(e) => setRememberId(e.target.checked)}
                                style={{ width: '16px', height: '16px', marginRight: '8px', cursor: 'pointer' }}
                            />
                            <label htmlFor="rememberId" style={{ fontSize: '14px', color: '#666', cursor: 'pointer' }}>아이디 저장</label>
                        </div>

                        <button type="submit" className={styles.loginButton} disabled={isLoading}>
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>
                )}

                <div className={styles.footer}>
                    <a href="/find-password" className={styles.link}>비밀번호 찾기</a>
                    <span className={styles.divider}>|</span>
                    <a href="/signup" className={styles.link}>회원가입</a>
                </div>
            </div>

            {/* Custom Error Modal */}
            <AlertModal
                isOpen={!!errorMsg}
                onClose={() => setErrorMsg(null)}
                title="로그인 실패"
                message={errorMsg || ''}
                type="error"
            />
        </div>
    );
}
