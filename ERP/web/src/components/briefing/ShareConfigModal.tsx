'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Edit2 } from 'lucide-react';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

import { createClient } from '@/utils/supabase/client';

interface ShareConfigModalProps {
    propertyId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function ShareConfigModal({ propertyId, isOpen, onClose }: ShareConfigModalProps) {
    const [loading, setLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    // Global Alert/Confirm State
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
        isDanger?: boolean;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        isDanger: false
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertConfig({ isOpen: true, message, type });
    };

    const showConfirm = (message: string, onConfirm: () => void, isDanger = false) => {
        setConfirmConfig({ isOpen: true, message, onConfirm, isDanger });
    };

    // Options
    const [hideAddress, setHideAddress] = useState(true);
    // 'include' = Deposit + Premium (Full Price)
    // 'exclude' = Deposit + Premium - BriefingPrice (Discounted/Net Price)
    // Default to 'include' based on user preference to avoid accidental masking? Or 'exclude'?
    // User asked for specific logic. Let's default to 'include' (B + P).
    const [priceMode, setPriceMode] = useState<'include' | 'exclude'>('include');
    const [expiryDays, setExpiryDays] = useState(7);

    // Content Additions
    const [expertComment, setExpertComment] = useState("안정적인 매출 기반과 합리적인 권리금으로 빠른 투자금 회수가 기대되는 매물입니다. 특히 주변 상권의 유동인구가 꾸준하여 지속적인 성장이 예상됩니다.");
    const [neighborhoodInfo, setNeighborhoodInfo] = useState([
        { label: '지하철', value: '500m' },
        { label: '유동', value: '많음' },
        { label: '치안', value: '안전' }
    ]);

    if (!isOpen) return null;

    const handleCreateLink = async () => {
        setLoading(true);

        // Calculate Expiry
        let expiresAt = null;
        if (expiryDays > 0) {
            const date = new Date();
            // Support fractional days for testing (e.g. 1 min = 1/1440 days)
            const ms = expiryDays * 24 * 60 * 60 * 1000;
            date.setTime(date.getTime() + ms);
            expiresAt = date.toISOString();
        }

        try {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();

            // Get current session for Auth header
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const res = await fetch('/api/briefing/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    property_id: propertyId,
                    options: {
                        hide_address: hideAddress,
                        price_mode: priceMode, // Send mode instead of boolean
                        // Keep legacy boolean for backward compat if needed, or just rely on mode
                        show_briefing_price: priceMode === 'exclude',
                        expert_comment: expertComment,
                        neighborhood_info: neighborhoodInfo
                    },
                    expiresAt
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '링크 생성에 실패했습니다.');
            }

            const data = await res.json();
            setGeneratedLink(`${window.location.origin}/share/${data.token}`);
        } catch (err: any) {
            console.error(err);
            showAlert(err.message || '서버 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            showAlert('링크가 복사되었습니다.', 'success');
        }
    };

    // Load Kakao SDK
    useState(() => {
        const script = document.createElement('script');
        script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
        script.async = true;
        script.onload = () => {
            if ((window as any).Kakao && !(window as any).Kakao.isInitialized()) {
                (window as any).Kakao.init('26c1197bae99e17f8c1f3e688e22914d');
            }
        };
        document.head.appendChild(script);
    });

    const shareKakao = () => {
        if (!generatedLink) return;

        if (!(window as any).Kakao || !(window as any).Kakao.isInitialized()) {
            showAlert('카카오톡 SDK가 로드되지 않았습니다.', 'error');
            return;
        }

        (window as any).Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: '프리미엄 부동산 브리핑',
                description: expertComment || '공유받은 매물 브리핑을 확인해보세요.',
                imageUrl: 'https://via.placeholder.com/800x400?text=Premium+Property', // Replace with real image if available prop
                link: {
                    mobileWebUrl: generatedLink,
                    webUrl: generatedLink,
                },
            },
            buttons: [
                {
                    title: '브리핑 자세히 보기',
                    link: {
                        mobileWebUrl: generatedLink,
                        webUrl: generatedLink,
                    },
                },
            ],
        });
    };

    // History State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [linkHistory, setLinkHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const res = await fetch(`/api/briefing/list?property_id=${propertyId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.links) setLinkHistory(data.links);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const toggleHistory = () => {
        if (!isHistoryOpen) fetchHistory();
        setIsHistoryOpen(!isHistoryOpen);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 transition-all">
            <div
                className={`bg-white rounded-2xl shadow-2xl overflow-hidden relative transition-all duration-300 ease-in-out flex flex-col md:flex-row w-[95vw] md:w-auto ${isHistoryOpen ? 'md:max-w-4xl' : 'md:max-w-md'}`}
                style={{ maxHeight: '90vh' }}
            >
                {/* Main Content (Left) */}
                <div className="w-full md:w-[28rem] flex-1 min-h-0 md:flex-none flex flex-col border-r border-gray-100 transition-all">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="font-bold text-lg">시크릿 브리핑 공유</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleHistory}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${isHistoryOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {isHistoryOpen ? '목록 닫기' : '📋 공유 내역'}
                            </button>
                            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                        <div className="space-y-6">
                            {!generatedLink ? (
                                // Config Step uses existing UI logic...
                                <>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="font-medium text-gray-700">지번 숨김 (보안)</label>
                                            <input
                                                type="checkbox"
                                                checked={hideAddress}
                                                onChange={(e) => setHideAddress(e.target.checked)}
                                                className="w-5 h-5 accent-indigo-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="font-medium text-gray-700 block text-sm">금액 표시 방식</label>
                                            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="priceMode"
                                                        value="include"
                                                        checked={priceMode === 'include'}
                                                        onChange={() => setPriceMode('include')}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <span className="text-sm">브리핑가 포함 (보증금 + 권리금)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="priceMode"
                                                        value="exclude"
                                                        checked={priceMode === 'exclude'}
                                                        onChange={() => setPriceMode('exclude')}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <span className="text-sm">브리핑가 제외/차감 (합계 - 브리핑가)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-medium text-gray-700 block text-sm">유효기간</label>
                                        <select
                                            value={expiryDays}
                                            onChange={(e) => setExpiryDays(Number(e.target.value))}
                                            className="w-full border rounded-lg p-2 text-sm"
                                        >
                                            <option value={1}>1일</option>
                                            <option value={3}>3일</option>
                                            <option value={7}>7일 (기본)</option>
                                            <option value={30}>30일</option>
                                            <option value={0}>무제한 (삭제 전까지)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-bold text-sm text-gray-800">컨텐츠 설정</h4>

                                        <div className="space-y-1">
                                            <label className="font-medium text-gray-700 block text-xs">전문가 한줄평</label>
                                            <textarea
                                                value={expertComment}
                                                onChange={(e) => setExpertComment(e.target.value)}
                                                placeholder="매물에 대한 전문가의 의견을 적어주세요."
                                                className="w-full border rounded-lg p-2 text-sm h-24 resize-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="font-medium text-gray-700 block text-xs mb-1">동네 정보 (키워드/설명)</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[0, 1, 2].map((i) => (
                                                    <div key={i} className="flex flex-col gap-1">
                                                        <input
                                                            placeholder="예: 지하철"
                                                            className="border rounded px-2 py-1 text-xs"
                                                            value={neighborhoodInfo[i].label}
                                                            onChange={(e) => {
                                                                const newInfo = [...neighborhoodInfo];
                                                                newInfo[i] = { ...newInfo[i], label: e.target.value };
                                                                setNeighborhoodInfo(newInfo);
                                                            }}
                                                        />
                                                        <input
                                                            placeholder="예: 500m"
                                                            className="border rounded px-2 py-1 text-xs font-bold"
                                                            value={neighborhoodInfo[i].value}
                                                            onChange={(e) => {
                                                                const newInfo = [...neighborhoodInfo];
                                                                newInfo[i] = { ...newInfo[i], value: e.target.value };
                                                                setNeighborhoodInfo(newInfo);
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline error removed */}

                                    <div className="pt-2">
                                        <button
                                            onClick={handleCreateLink}
                                            disabled={loading}
                                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:bg-gray-400 shadow-md transition-all active:scale-[0.98]"
                                        >
                                            {loading ? '생성 중...' : '브리핑 링크 생성하기'}
                                        </button>
                                        <div className="mt-3 text-center">
                                            <button
                                                onClick={() => {
                                                    showConfirm('정말 이 매물의 모든 공유 링크를 만료시키겠습니까?\n기존에 공유된 링크들이 더 이상 열리지 않게 됩니다.', async () => {
                                                        try {
                                                            const { createClient } = await import('@/utils/supabase/client');
                                                            const supabase = createClient();
                                                            const { data: sessionData } = await supabase.auth.getSession();
                                                            const token = sessionData.session?.access_token;

                                                            const res = await fetch('/api/briefing/expire', {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                                                },
                                                                body: JSON.stringify({ property_id: propertyId })
                                                            });
                                                            if (res.ok) showAlert('모든 링크가 만료되었습니다.', 'success');
                                                            else throw new Error('실패했습니다.');
                                                        } catch (e) {
                                                            showAlert('오류가 발생했습니다.', 'error');
                                                        }
                                                    }, true);
                                                }}
                                                className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors"
                                            >
                                                기존 공유된 링크 모두 끊기 (만료)
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Result Step
                                <div className="space-y-4 text-center">
                                    <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                                        링크가 생성되었습니다!
                                    </div>

                                    <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                                        <input
                                            readOnly
                                            value={generatedLink}
                                            className="w-full bg-transparent text-sm outline-none text-gray-600"
                                        />
                                        <button onClick={copyToClipboard} className="p-2 hover:bg-white rounded-md border border-transparent hover:border-gray-200">
                                            {copySuccess ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button onClick={shareKakao} className="flex items-center justify-center gap-2 py-3 bg-[#FEE500] text-[#191919] font-bold rounded-xl hover:bg-[#FDD835]">
                                            <MessageCircle size={18} fill="#191919" /> 카카오톡
                                        </button>
                                        <button onClick={onClose} className="py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">
                                            닫기
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* History Panel (Right) - Collapsible */}
                <div className={`bg-slate-50 border-t md:border-t-0 md:border-l border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${isHistoryOpen ? 'h-[40vh] md:h-auto w-full md:w-[24rem] opacity-100' : 'h-0 md:h-auto w-full md:w-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-4 border-b bg-slate-100 font-bold text-gray-700 flex justify-between items-center">
                        <span>전체 공유 목록</span>
                        <button onClick={() => fetchHistory()} className="text-xs text-indigo-600 hover:underline">새로고침</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {historyLoading ? (
                            <div className="text-center text-sm text-gray-400 py-10">로딩 중...</div>
                        ) : linkHistory.length === 0 ? (
                            <div className="text-center text-sm text-gray-400 py-10">생성된 링크가 없습니다.</div>
                        ) : (
                            linkHistory.map((link) => (
                                <HistoryLinkItem
                                    key={link.id}
                                    link={link}
                                    onRefresh={() => fetchHistory()}
                                    showAlert={showAlert}
                                    showConfirm={showConfirm}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Alerts & Confirms */}
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                message={alertConfig.message}
                type={alertConfig.type}
            />
            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                message={confirmConfig.message}
                isDanger={confirmConfig.isDanger}
            />
        </div>
    );
}

function HistoryLinkItem({ link, onRefresh, showAlert, showConfirm }: {
    link: any,
    onRefresh: () => void,
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void,
    showConfirm: (msg: string, onConfirm: () => void, isDanger?: boolean) => void
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [memo, setMemo] = useState(link.options?.memo || '');
    const [saving, setSaving] = useState(false);

    // Initial memo sync
    useEffect(() => {
        setMemo(link.options?.memo || '');
    }, [link.options?.memo]);

    const handleSaveMemo = async () => {
        setSaving(true);
        try {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const res = await fetch('/api/briefing/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ link_id: link.id, memo })
            });

            if (res.ok) {
                setIsEditing(false);
                onRefresh(); // Refresh parent list to sync data
            } else {
                showAlert('저장에 실패했습니다.', 'error');
            }
        } catch (e) {
            console.error(e);
            showAlert('오류가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRevokeSingle = async () => {
        showConfirm('이 링크를 만료시키겠습니까?', async () => {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;

                const res = await fetch('/api/briefing/expire', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ link_id: link.id })
                });

                if (res.ok) {
                    onRefresh();
                    showAlert('만료되었습니다.', 'success');
                }
            } catch (e) {
                showAlert('오류가 발생했습니다.', 'error');
            }
        }, true);
    };

    const handleDelete = async () => {
        showConfirm('이 기록을 목록에서 삭제하시겠습니까?', async () => {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { error } = await supabase.from('share_links').delete().eq('id', link.id);
                if (error) throw error;
                onRefresh();
            } catch (e) {
                showAlert('삭제 실패', 'error');
            }
        });
    };

    const getTimeRemaining = (expiresAt: string | null) => {
        if (!expiresAt) return '무제한';
        const now = new Date();
        const end = new Date(expiresAt);
        if (end < now) return '만료됨';
        const diff = end.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}일 남음`;
        if (hours > 0) return `${hours}시간 남음`;
        return '곧 만료';
    };

    const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
    const timeLeft = getTimeRemaining(link.expires_at);
    const linkUrl = `${window.location.origin}/share/${link.token}`;

    return (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-sm hover:border-indigo-300 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-gray-800 flex items-center gap-1 flex-1 mr-2">
                    {isEditing ? (
                        <div className="flex items-center gap-1 w-full">
                            <input
                                ref={(input) => {
                                    if (input) input.focus();
                                }}
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveMemo();
                                    if (e.key === 'Escape') {
                                        setMemo(link.options?.memo || '');
                                        setIsEditing(false);
                                    }
                                }}
                                placeholder="메모를 입력하세요"
                                className="flex-1 border-b border-indigo-500 outline-none text-indigo-900 bg-transparent py-0.5"
                            />
                            <button onClick={handleSaveMemo} disabled={saving} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 whitespace-nowrap">
                                {saving ? '...' : '저장'}
                            </button>
                        </div>
                    ) : (
                        <div onClick={() => setIsEditing(true)} className="group cursor-pointer flex items-center gap-1 hover:bg-gray-50 rounded px-1 -ml-1 transition-colors w-full">
                            {link.options?.memo ? (
                                <span className="text-indigo-900">{link.options.memo}</span>
                            ) : (
                                <span className="text-gray-400 italic">메모 없음 (클릭하여 입력)</span>
                            )}
                            <span className="opacity-0 group-hover:opacity-100 text-gray-400">
                                <Edit2 size={10} />
                            </span>
                        </div>
                    )}
                </div>
                {isExpired ? (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full whitespace-nowrap">만료됨</span>
                ) : (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold whitespace-nowrap">{timeLeft}</span>
                )}
            </div>
            <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded text-xs text-gray-500">
                <div className="truncate flex-1 font-mono">
                    {linkUrl}
                </div>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(linkUrl);
                        showAlert('링크가 복사되었습니다.', 'success');
                    }}
                    className="p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 text-indigo-600"
                    title="링크 복사"
                >
                    <Copy size={12} />
                </button>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400">
                <span>
                    {new Date(link.created_at).toLocaleDateString()} • {link.profiles?.name || '상담사'}
                </span>
                {!isExpired ? (
                    <button
                        onClick={handleRevokeSingle}
                        className="text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded"
                    >
                        만료시키기
                    </button>
                ) : (
                    <button
                        onClick={handleDelete}
                        className="text-gray-400 hover:text-gray-600 font-medium px-2 py-1 hover:bg-gray-100 rounded"
                    >
                        삭제
                    </button>
                )}
            </div>
        </div>
    );
}
