"use client";

import React, { useEffect, useState } from 'react';
import { Save, Megaphone, Layers, Database, Download, ChevronRight } from 'lucide-react';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

const styles = {
    container: { padding: '32px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'var(--font-pretendard)' },
    header: { marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: '24px', fontWeight: '800', color: '#212529', margin: 0 },
    subtitle: { fontSize: '16px', color: '#868e96', marginTop: '8px' },

    section: { marginBottom: '40px' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
    sectionIcon: { color: '#495057' },
    sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#343a40', margin: 0 },

    card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e9ecef', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },

    // Form Elements
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', fontSize: '14px', fontWeight: 600, color: '#495057', marginBottom: '8px' },
    input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px' },
    textarea: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px', minHeight: '80px', resize: 'vertical' as const },
    select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dee2e6', fontSize: '14px', backgroundColor: 'white' },

    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f3f5' },
    toggleLabel: { fontSize: '15px', fontWeight: 500, color: '#212529' },

    // Custom Toggle Switch
    switch: { position: 'relative' as const, display: 'inline-block', width: '48px', height: '24px' },
    slider: { position: 'absolute' as const, cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ccc', transition: '.4s', borderRadius: '34px' },
    sliderChecked: { backgroundColor: '#1971c2' },
    sliderBefore: { position: 'absolute' as const, height: '18px', width: '18px', left: '3px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' },
    sliderCheckedBefore: { transform: 'translateX(24px)' },

    btn: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s' },
    primaryBtn: { backgroundColor: '#1971c2', color: 'white' },
    downloadBtn: { backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6', marginRight: '10px', textDecoration: 'none' },
};

// Toggle Switch Component
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <div style={styles.switch} onClick={() => onChange(!checked)}>
        <div style={{ ...styles.slider, ...(checked ? styles.sliderChecked : {}) }}>
            <div style={{ ...styles.sliderBefore, ...(checked ? styles.sliderCheckedBefore : {}) }} />
        </div>
    </div>
);

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<any>({
        announcement: { message: '', level: 'info', active: false },
        features: { electronicContracts: true, mapService: true },
        maintenance: { active: false, message: '현재 시스템 정기 점검 중입니다.' },
        systemInfo: { version: '1.2.0', lastUpdated: '' }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Alert & Confirm State
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', title: '' });
    const showAlert = (message: string, title?: string) => {
        setAlertConfig({ isOpen: true, message, title: title || '알림' });
    };
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/system/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    ...settings,
                    ...data,
                    // Ensure nested objects exist to avoid crashes
                    announcement: { ...settings.announcement, ...(data.announcement || {}) },
                    features: { ...settings.features, ...(data.features || {}) },
                    maintenance: { ...settings.maintenance, ...(data.maintenance || {}) },
                    systemInfo: { ...settings.systemInfo, ...(data.systemInfo || {}) }
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/system/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                showAlert('설정이 저장되었습니다.');
            } else {
                showAlert('저장 실패');
            }
        } catch (e) {
            console.error(e);
            showAlert('오류 발생');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUserExport = () => {
        const userStr = localStorage.getItem('user');
        const parsed = userStr ? JSON.parse(userStr) : {};
        const user = parsed.user || parsed;
        const requesterId = user?.uid || user?.id || '';
        const query = requesterId ? `?requesterId=${encodeURIComponent(requesterId)}` : '';
        window.open(`/api/users${query}`, '_blank');
    };

    if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>시스템 설정</h1>
                    <p style={styles.subtitle}>전체 공지, 기능 토글 및 유지보수 설정을 관리합니다.</p>
                </div>
                <button
                    style={{ ...styles.btn, ...styles.primaryBtn, opacity: isSaving ? 0.7 : 1 }}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    <Save size={18} />
                    {isSaving ? '저장 중...' : '변경사항 저장'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* 1. System Info */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Database size={20} style={styles.sectionIcon} />
                        <h2 style={styles.sectionTitle}>1. 시스템 정보</h2>
                    </div>
                    <div style={styles.card}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>버전 정보</label>
                            <input
                                style={styles.input}
                                value={settings.systemInfo.version}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    systemInfo: { ...settings.systemInfo, version: e.target.value }
                                })}
                            />
                        </div>
                        <div style={{ ...styles.formGroup, marginBottom: 0 }}>
                            <label style={styles.label}>최종 업데이트 날짜</label>
                            <input
                                type="date"
                                style={styles.input}
                                value={settings.systemInfo.lastUpdated}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    systemInfo: { ...settings.systemInfo, lastUpdated: e.target.value }
                                })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Maintenance Mode */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Megaphone size={20} style={{ color: settings.maintenance.active ? '#fa5252' : '#495057' }} />
                        <h2 style={styles.sectionTitle}>2. 점검 모드</h2>
                    </div>
                    <div style={{ ...styles.card, border: settings.maintenance.active ? '1px solid #ffc9c9' : '1px solid #e9ecef' }}>
                        <div style={styles.toggleRow}>
                            <span style={{ ...styles.toggleLabel, color: settings.maintenance.active ? '#e03131' : '#212529' }}>점검 모드 활성화</span>
                            <Toggle
                                checked={settings.maintenance.active}
                                onChange={(checked) => setSettings({
                                    ...settings,
                                    maintenance: { ...settings.maintenance, active: checked }
                                })}
                            />
                        </div>
                        {settings.maintenance.active && (
                            <div style={{ marginTop: '16px' }}>
                                <label style={styles.label}>점검 안내 메시지</label>
                                <textarea
                                    style={styles.textarea}
                                    value={settings.maintenance.message}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        maintenance: { ...settings.maintenance, message: e.target.value }
                                    })}
                                />
                                <p style={{ fontSize: '12px', color: '#fa5252', marginTop: '8px' }}>
                                    ! 점검 모드 활성 시 관리자를 제외한 모든 사용자의 접근이 제한됩니다.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Announcement Section */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Megaphone size={20} style={styles.sectionIcon} />
                    <h2 style={styles.sectionTitle}>전체 공지 (배너)</h2>
                </div>
                <div style={styles.card}>
                    <div style={styles.toggleRow}>
                        <span style={styles.toggleLabel}>공지 배너 활성화</span>
                        <Toggle
                            checked={settings.announcement.active}
                            onChange={(checked) => setSettings({
                                ...settings,
                                announcement: { ...settings.announcement, active: checked }
                            })}
                        />
                    </div>
                    {settings.announcement.active && (
                        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 200px', gap: '20px' }}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>공지 내용</label>
                                <textarea
                                    style={styles.textarea}
                                    value={settings.announcement.message}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        announcement: { ...settings.announcement, message: e.target.value }
                                    })}
                                    placeholder="모든 사용자 대시보드 상단에 표시될 메시지"
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>중요도 (색상)</label>
                                <select
                                    style={styles.select}
                                    value={settings.announcement.level}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        announcement: { ...settings.announcement, level: e.target.value }
                                    })}
                                >
                                    <option value="info">안내 (파란색)</option>
                                    <option value="warning">주의 (주황색)</option>
                                    <option value="error">긴급 (빨간색)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Features Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Layers size={20} style={styles.sectionIcon} />
                        <h2 style={styles.sectionTitle}>기능 제어 (Flags)</h2>
                    </div>
                    <div style={styles.card}>
                        <div style={styles.toggleRow}>
                            <span style={styles.toggleLabel}>전자계약 모듈</span>
                            <Toggle
                                checked={settings.features.electronicContracts}
                                onChange={(checked) => setSettings({
                                    ...settings,
                                    features: { ...settings.features, electronicContracts: checked }
                                })}
                            />
                        </div>
                        <div style={{ ...styles.toggleRow, borderBottom: 'none' }}>
                            <span style={styles.toggleLabel}>지도 서비스 모듈</span>
                            <Toggle
                                checked={settings.features.mapService}
                                onChange={(checked) => setSettings({
                                    ...settings,
                                    features: { ...settings.features, mapService: checked }
                                })}
                            />
                        </div>
                    </div>
                </div>

                {/* Data Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Database size={20} style={styles.sectionIcon} />
                        <h2 style={styles.sectionTitle}>데이터 내려받기 (JSON)</h2>
                    </div>
                    <div style={styles.card}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button style={{ ...styles.btn, ...styles.downloadBtn, margin: 0 }} onClick={handleUserExport}>
                                <Download size={14} /> 사용자 정보
                            </button>
                            <button style={{ ...styles.btn, ...styles.downloadBtn, margin: 0 }} onClick={() => window.open('/api/contracts', '_blank')}>
                                <Download size={14} /> 계약 리스트
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                title={alertConfig.title}
            />
        </div>
    );
}
