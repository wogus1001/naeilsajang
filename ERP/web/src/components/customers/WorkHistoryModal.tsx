import React, { useState } from 'react';
import { X, Plus, Save, Calendar, Search, Trash2 } from 'lucide-react';
import styles from './WorkHistoryModal.module.css';
import PropertySelectorModal from '@/components/properties/PropertySelectorModal';

interface WorkHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: any;
}

export default function WorkHistoryModal({ isOpen, onClose, onSave, initialData }: WorkHistoryModalProps) {
    const [formData, setFormData] = useState({
        content: '',
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        details: '',
        targetType: 'store', // 'store', 'building', 'hotel', etc.
        targetName: '',
        targetId: ''
    });
    const [showSelector, setShowSelector] = useState(false);

    // Reset or Load Data when Modal Opens
    React.useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    content: initialData.content || '',
                    date: initialData.date || new Date().toISOString().split('T')[0],
                    details: initialData.details || '',
                    targetType: initialData.targetType || 'store',
                    targetName: initialData.targetName || initialData.relatedProperty || initialData.related || initialData.relatedItem || '', // Handle various legacy fields including relatedItem
                    targetId: initialData.targetId || ''
                });
            } else {
                // Reset for New Entry
                setFormData({
                    content: '',
                    date: new Date().toISOString().split('T')[0],
                    details: '',
                    targetType: 'store',
                    targetName: '',
                    targetId: ''
                });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleDateAdjust = (days: number) => {
        const d = new Date(formData.date);
        d.setDate(d.getDate() + days);
        setFormData({ ...formData, date: d.toISOString().split('T')[0] });
    };

    const setDateTo = (target: 'today' | 'yesterday' | 'tomorrow') => {
        const d = new Date();
        if (target === 'yesterday') d.setDate(d.getDate() - 1);
        if (target === 'tomorrow') d.setDate(d.getDate() + 1);
        setFormData({ ...formData, date: d.toISOString().split('T')[0] });
    };

    const handleChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        // Validation if needed
        onSave(formData);
        onClose();
    };

    // Format date for display: "2025년 12월 9일 화요일"
    const formatDateDisplay = (dateStr: string) => {
        const d = new Date(dateStr);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return d.toLocaleDateString('ko-KR', options);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <span className={styles.title}>작업내역 추가</span>
                    <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
                </div>

                <div className={styles.content}>
                    <div className={styles.row}>
                        <div className={styles.label}>내역</div>
                        <div className={styles.inputWrapper}>
                            <input
                                className={styles.input}
                                value={formData.content}
                                onChange={(e) => handleChange('content', e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.label}>날짜</div>
                        <div className={styles.inputWrapper} style={{ gap: 8 }}>
                            <div className={styles.dateDisplay}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={true} readOnly // Always checked as per screenshot logic usually implication
                                />
                                <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 'bold' }}>{formatDateDisplay(formData.date)}</span>
                                <input
                                    type="date"
                                    className={styles.datePickerHidden}
                                    value={formData.date}
                                    onChange={(e) => handleChange('date', e.target.value)}
                                />
                                {/* Hidden date picker overlay or custom trigger could be better, but simple for now */}
                            </div>

                            <div className={styles.btnGroup}>
                                <button className={styles.dateBtn} onClick={() => handleDateAdjust(-1)} style={{ color: '#e03131' }}>- 1일</button>
                                <button className={styles.dateBtn} onClick={() => setDateTo('yesterday')}>어제</button>
                                <button className={styles.dateBtn} onClick={() => setDateTo('today')}>오늘</button>
                                <button className={styles.dateBtn} onClick={() => setDateTo('tomorrow')}>내일</button>
                                <button className={styles.dateBtn} onClick={() => handleDateAdjust(1)} style={{ color: '#2b8a3e' }}>+ 1일</button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.row} style={{ flex: 1, alignItems: 'flex-start' }}>
                        <div className={styles.label} style={{ height: '100%' }}>상세내역</div>
                        <div className={styles.inputWrapper} style={{ height: '100%' }}>
                            <textarea
                                className={styles.textarea}
                                value={formData.details}
                                onChange={(e) => handleChange('details', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.footerRow}>
                    <div className={styles.label}>대상</div>
                    <div className={styles.inputWrapper} style={{ gap: 4 }}>
                        <select
                            className={styles.select}
                            style={{ width: 80 }}
                            value={formData.targetType}
                            onChange={(e) => handleChange('targetType', e.target.value)}
                        >
                            <option value="store">점포</option>
                            <option value="building">빌딩</option>
                            <option value="hotel">호텔</option>
                        </select>
                        <input
                            className={styles.input}
                            style={{ flex: 1, backgroundColor: '#fff9db' }}
                            value={formData.targetName}
                            onChange={(e) => handleChange('targetName', e.target.value)}
                        />
                        <button
                            className={styles.iconBtn}
                            style={{ width: 40, color: '#e03131', borderColor: '#ffc9c9', background: '#fff5f5' }}
                            onClick={() => setFormData(prev => ({ ...prev, targetName: '', targetId: '' }))}
                        >
                            <Trash2 size={14} />
                        </button>
                        <button className={styles.searchBtn} onClick={() => setShowSelector(true)}>
                            <Plus size={14} /> 목록에서 찾기
                        </button>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.saveBtn} onClick={handleSave}>
                        <Save size={16} /> 내역저장후 닫기
                    </button>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        <X size={16} /> 닫기
                    </button>
                </div>
            </div>
            <PropertySelectorModal
                isOpen={showSelector}
                onClose={() => setShowSelector(false)}
                onSelect={(property) => {
                    setFormData(prev => ({
                        ...prev,
                        targetType: 'store', // property.type matches?
                        targetName: property.name,
                        targetId: property.id // SAVE TARGET ID
                    }));
                }}
            />
        </div>
    );
}
