
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Check, ShieldAlert, ArrowRight, ArrowLeft, Users } from 'lucide-react';
import { Template } from '@/lib/ucansign/client';

export default function ContractCreatePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const propertyId = searchParams.get('propertyId');

    const [step, setStep] = useState<'TEMPLATE' | 'PARTICIPANTS'>('TEMPLATE');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateDetails, setTemplateDetails] = useState<any>(null);
    const [participantMap, setParticipantMap] = useState<Record<string, { name: string, contact: string }>>({});

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserId(user.id);
            loadTemplates(user.id);
        } else {
            // alert('로그인이 필요합니다.');
        }
    }, []);

    const loadTemplates = async (uid: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/contracts/templates?userId=${uid}`);
            if (!res.ok) throw new Error('템플릿을 불러오는데 실패했습니다.');
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTemplateSelect = (template: Template) => {
        setSelectedTemplate(template.documentId === selectedTemplate?.documentId ? null : template);
    };

    const handleNext = async () => {
        if (!selectedTemplate || !userId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/contracts/templates/${selectedTemplate.documentId}?userId=${userId}`);
            if (!res.ok) throw new Error('템플릿 상세 정보를 불러오는데 실패했습니다.');
            const data = await res.json();
            setTemplateDetails(data);

            const initialMap: any = {};
            if (data.participants) {
                data.participants.forEach((p: any) => {
                    initialMap[p.participantId] = { name: '', contact: '' };
                });
            }
            setParticipantMap(initialMap);
            setStep('PARTICIPANTS');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleParticipantChange = (id: string, field: string, value: string) => {
        setParticipantMap(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleCreateContract = async () => {
        if (!userId || !selectedTemplate || !templateDetails) return;
        setIsLoading(true);

        try {
            // ... (validation)
            const targets = templateDetails.participants.filter((p: any) => p.participantRole !== 'requester');

            for (const t of targets) {
                const info = participantMap[t.participantId];
                if (!info?.name || !info?.contact) {
                    alert(`${t.roleName || '참여자'} 정보를 모두 입력해주세요.`);
                    setIsLoading(false);
                    return;
                }
            }

            const payload = {
                templateId: selectedTemplate.documentId,
                participants: participantMap,
                propertyId: propertyId // Pass propertyId if exists
            };

            const res = await fetch(`/api/contracts/create?userId=${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '계약 생성 실패');
            }

            const result = await res.json();
            alert('계약이 성공적으로 생성 및 전송되었습니다!');
            window.location.href = '/contracts';

        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                    onClick={() => step === 'TEMPLATE' ? router.back() : setStep('TEMPLATE')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {step === 'TEMPLATE' ? '계약 템플릿 선택' : '참여자 설정'}
                </h1>
                {step === 'TEMPLATE' && (
                    <a
                        href="https://app.ucansign.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            marginLeft: 'auto',
                            padding: '8px 16px',
                            background: '#f3f4f6',
                            color: '#4b5563',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: '1px solid #e5e7eb'
                        }}
                    >
                        <FileText size={14} />
                        새 템플릿 만들기 (유캔싸인)
                    </a>
                )}
            </div>

            {error && (
                <div style={{ padding: '20px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {step === 'TEMPLATE' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                        {templates.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px' }}>
                                <p style={{ color: '#666', marginBottom: '10px' }}>등록된 템플릿이 없습니다.</p>
                                <a
                                    href="https://app.ucansign.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '14px' }}
                                >
                                    유캔싸인에서 템플릿 만들기 &rarr;
                                </a>
                            </div>
                        )}
                        {templates.map(template => (
                            <div
                                key={template.documentId}
                                onClick={() => handleTemplateSelect(template)}
                                style={{
                                    border: selectedTemplate?.documentId === template.documentId ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    cursor: 'pointer',
                                    background: 'white',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                            >
                                <div style={{
                                    width: '40px', height: '40px',
                                    background: '#eff6ff', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '15px', color: '#2563eb'
                                }}>
                                    <FileText size={20} />
                                </div>
                                <h3 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>{template.name}</h3>
                                <p style={{ color: '#666', fontSize: '13px' }}>
                                    생성일: {new Date(template.createdAt).toLocaleDateString()}
                                </p>

                                {selectedTemplate?.documentId === template.documentId && (
                                    <div style={{ position: 'absolute', top: '15px', right: '15px', color: '#2563eb' }}>
                                        <Check size={20} strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleNext}
                            disabled={!selectedTemplate}
                            style={{
                                padding: '12px 24px',
                                background: selectedTemplate ? '#2563eb' : '#9ca3af',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: selectedTemplate ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            다음 단계 <Users size={18} />
                        </button>
                    </div>
                </>
            )}

            {step === 'PARTICIPANTS' && selectedTemplate && (
                <div style={{ background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>참여자 설정</h2>
                    <p style={{ color: '#666', marginBottom: '30px' }}>
                        선택한 템플릿(<strong>{selectedTemplate.name}</strong>)의 서명 참여자 정보를 입력해주세요.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {templateDetails?.participants?.map((participant: any, index: number) => (
                            <div key={participant.participantId} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                                    <span style={{
                                        background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '8px'
                                    }}>
                                        {participant.roleName || `참여자 ${index + 1}`}
                                    </span>
                                    {participant.participantRole === 'requester' && <span style={{ fontSize: '12px', color: '#666' }}>(본인)</span>}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>이름</label>
                                        <input
                                            type="text"
                                            placeholder="이름 입력"
                                            defaultValue={participant.participantRole === 'requester' ? '본인(자동입력)' : ''}
                                            disabled={participant.participantRole === 'requester'}
                                            onChange={(e) => handleParticipantChange(participant.participantId, 'name', e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>연락처 (휴대폰/이메일)</label>
                                        <input
                                            type="text"
                                            placeholder="010-0000-0000 또는 example@email.com"
                                            defaultValue={participant.participantRole === 'requester' ? '본인(자동입력)' : ''}
                                            disabled={participant.participantRole === 'requester'}
                                            onChange={(e) => handleParticipantChange(participant.participantId, 'contact', e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                        <button
                            onClick={() => setStep('TEMPLATE')}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            이전 단계
                        </button>
                        <button
                            onClick={handleCreateContract}
                            disabled={isLoading}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isLoading ? '#93c5fd' : '#2563eb',
                                color: 'white',
                                fontWeight: 'bold',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            {isLoading ? '계약 생성 중...' : '계약 생성 및 전송'}
                            {!isLoading && <ArrowRight size={18} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
