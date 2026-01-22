"use client";

import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Search, FileText, Trash2, Copy, Printer, Star } from 'lucide-react';
import styles from '@/app/(main)/customers/register/page.module.css';
import WorkHistoryModal from './WorkHistoryModal';
import PropertySelector from './PropertySelector';
import PropertyCard from '../properties/PropertyCard';

// Mock Data Removed

interface Customer {
    id?: string;
    name: string;
    gender: 'M' | 'F';
    grade: string;
    class: string;
    managerId: string;
    manager_id?: string; // UUID from DB
    status: string;
    feature: string;
    address: string;
    isFavorite?: boolean;

    // Contact
    mobile: string;
    companyPhone: string;
    homePhone: string;
    otherPhone: string;
    fax: string;
    email: string;

    // Memos
    memoSituation: string;
    memoInterest: string;
    memoHistory: string;

    // Store Customer Requirements
    wantedItem: string;
    wantedIndustry: string;
    wantedArea: string;
    wantedFeature: string;
    budget: string;

    // Ranges
    wantedAreaMin: string;
    wantedAreaMax: string;
    wantedFloorMin: string;
    wantedFloorMax: string;
    wantedRentMin: string;
    wantedRentMax: string;
    wantedDepositMin: string;
    wantedDepositMax: string;

    // Extended Fields for Property Types
    propertyType: 'store' | 'building' | 'hotel' | 'apartment' | 'estate';
    wantedLandAreaMin?: string; // 대지면적
    wantedLandAreaMax?: string;
    wantedTotalAreaMin?: string; // 연면적
    wantedTotalAreaMax?: string;
    wantedYieldMin?: string; // 수익률
    wantedYieldMax?: string;
    wantedSalePriceMin?: string; // 매매가
    wantedSalePriceMax?: string;
    wantedSupplyAreaMin?: string; // 공급면적
    wantedSupplyAreaMax?: string;

    progressSteps: string[]; // Added new field

    history: any[];
    promotedProperties?: any[];
}

const INITIAL_DATA: Customer = {
    name: '',
    gender: 'M',
    grade: 'progress',
    class: 'A',
    managerId: '',
    status: '물건진행', // Default updated
    feature: '',
    address: '',
    isFavorite: false,

    mobile: '',
    companyPhone: '',
    homePhone: '',
    otherPhone: '',
    fax: '',
    email: '',

    memoSituation: '',
    memoInterest: '',
    memoHistory: '',

    progressSteps: [], // Added new field

    wantedItem: '',
    wantedIndustry: '',
    wantedArea: '',
    wantedFeature: '',
    budget: '',

    wantedAreaMin: '', wantedAreaMax: '',
    wantedFloorMin: '', wantedFloorMax: '',
    wantedRentMin: '', wantedRentMax: '',
    wantedDepositMin: '', wantedDepositMax: '',

    propertyType: 'store',
    wantedLandAreaMin: '', wantedLandAreaMax: '',
    wantedTotalAreaMin: '', wantedTotalAreaMax: '',
    wantedYieldMin: '', wantedYieldMax: '',
    wantedSalePriceMin: '', wantedSalePriceMax: '',
    wantedSupplyAreaMin: '', wantedSupplyAreaMax: '',

    history: [],
    promotedProperties: []
};

interface CustomerCardProps {
    id?: string | null;
    onClose: () => void;
    onSuccess?: () => void;
    isModal?: boolean;
}

export default function CustomerCard({ id, onClose, onSuccess, isModal = false }: CustomerCardProps) {
    const [formData, setFormData] = useState<Customer>(INITIAL_DATA);
    const [loading, setLoading] = useState(false);
    const [managers, setManagers] = useState<any[]>([]);

    useEffect(() => {
        const loadManagers = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    if (!id) {
                        setFormData(prev => prev.managerId ? prev : { ...prev, managerId: user.id });
                    }
                    if (user.companyName) {
                        const res = await fetch(`/api/users?company=${encodeURIComponent(user.companyName)}`);
                        if (res.ok) {
                            const data = await res.json();
                            setManagers(data);
                        }
                    } else {
                        setManagers([user]);
                    }
                }
            } catch (error) {
                console.error('Failed to load managers:', error);
            }
        };
        loadManagers();
    }, [id]);

    useEffect(() => {
        if (id) {
            const fetchCustomer = async () => {
                const res = await fetch(`/api/customers`);
                const data = await res.json();
                const found = data.find((c: any) => c.id === id);
                if (found) setFormData({ ...INITIAL_DATA, ...found });
            };
            fetchCustomer();
        } else {
            setFormData(prev => ({ ...INITIAL_DATA, managerId: prev.managerId || '' }));
        }
    }, [id]);

    const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
    const [isPropertySelectorOpen, setIsPropertySelectorOpen] = useState(false);
    const [selectedPromotedIds, setSelectedPromotedIds] = useState<string[]>([]);
    const [openedPropertyId, setOpenedPropertyId] = useState<string | null>(null);
    const [openedPropertyData, setOpenedPropertyData] = useState<any>(null); // To store data for card
    const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);

    // Fetch property data when opening card
    useEffect(() => {
        if (openedPropertyId) {
            fetch(`/api/properties?id=${openedPropertyId}`)
                .then(res => res.json())
                .then(data => setOpenedPropertyData(data))
                .catch(err => console.error(err));
        } else {
            setOpenedPropertyData(null);
        }
    }, [openedPropertyId]);

    // Handle ESC key for nested modals (Capture phase to prevent parent closing)
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Priority 1: Property Card (Topmost)
                if (openedPropertyId) {
                    setOpenedPropertyId(null);
                    e.stopPropagation(); // Stop propagation to prevent parent (CustomerCard) from closing
                }
                // Priority 2: Property Selector (Middle)
                else if (isPropertySelectorOpen) {
                    setIsPropertySelectorOpen(false);
                    e.stopPropagation();
                }
            }
        };

        window.addEventListener('keydown', handleEsc, { capture: true });
        return () => window.removeEventListener('keydown', handleEsc, { capture: true });
    }, [openedPropertyId, isPropertySelectorOpen]);

    const saveCustomer = async (data: Customer) => {
        setLoading(true);
        try {
            const method = data.id ? 'PUT' : 'POST';

            // Inject Company Name
            let companyName = '';
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    if (user.companyName) companyName = user.companyName;
                }
            } catch (e) {
                console.error(e);
            }

            const payload = {
                ...(data.id ? data : { ...data, id: undefined }),
                companyName
            };

            const res = await fetch('/api/customers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // ideally creating a new customer via history add is rare/impossible as logic below handles existing check.
                if (method === 'POST') {
                    const newData = await res.json();
                    return newData;
                }
                return data;
            } else {
                alert('저장에 실패했습니다.');
                return null;
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const createScheduleSync = async (historyItem: any, customerName: string, customerId: string) => {
        try {
            const userStr = localStorage.getItem('user');
            let userInfo = { userId: '', companyName: '' };
            if (userStr) {
                const { id, companyName } = JSON.parse(userStr);
                userInfo = { userId: id, companyName };
            }

            const payload = {
                title: `[고객작업] ${customerName} - ${historyItem.content}`,
                date: historyItem.date,
                scope: 'work',
                status: 'completed', // 'Completed' effectively as it is history log
                details: historyItem.details || '',
                type: 'work',
                color: '#7950f2', // Purple for Customer Work
                customerId: customerId, // Link to customer
                ...userInfo
            };

            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Failed to sync history to schedule:', e);
        }
    };

    const handleChange = (field: keyof Customer, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleHistoryAdd = async (newHistory: any) => {
        const updatedHistory = [newHistory, ...formData.history];
        const updatedData = { ...formData, history: updatedHistory };
        setFormData(updatedData);
        setIsWorkModalOpen(false);

        // Auto-save when adding history
        const saved = await saveCustomer(updatedData);
        if (saved) {
            // Also sync to schedule
            await createScheduleSync(newHistory, saved.name, saved.id!);
        }
    };

    const handleSaveWorkHistory = (data: any) => {
        const userStr = localStorage.getItem('user');
        let managerName = 'Unknown';
        if (userStr) {
            const u = JSON.parse(userStr);
            managerName = (u.user || u).name || u.managerName || 'Unknown';
        }

        if (editingHistoryIndex !== null) {
            // Edit Mode
            const updatedHistory = [...formData.history];
            updatedHistory[editingHistoryIndex] = {
                ...updatedHistory[editingHistoryIndex],
                ...data,
                relatedProperty: data.targetName || updatedHistory[editingHistoryIndex].relatedProperty,
                targetId: data.targetId || updatedHistory[editingHistoryIndex].targetId
            };
            const updatedData = { ...formData, history: updatedHistory };
            setFormData(updatedData);
            setIsWorkModalOpen(false);
            setEditingHistoryIndex(null);

            // Auto-save update
            saveCustomer(updatedData);
            // Note: We don't implement full sync-update for schedules/properties here yet to avoid complexity.
        } else {
            // Add Mode
            const newHistory = {
                id: Date.now(),
                ...data,
                manager: managerName,
                relatedProperty: data.targetName || '' // Mapped from WorkHistoryModal's targetName
            };
            handleHistoryAdd(newHistory);

            // NEW: Sync to Property if targetId exists
            if (data.targetId) {
                syncWorkHistoryToProperty(data.targetId, newHistory, formData.name);
            }
        }
    };

    const deleteWorkHistoryFromProperty = async (propertyId: string, historyItem: any) => {
        try {
            const res = await fetch(`/api/properties?id=${propertyId}`);
            if (!res.ok) return;
            const propertyData = await res.json();

            // Find matching item in property history
            const updatedWorkHistory = (propertyData.workHistory || []).filter((h: any) => {
                let isMatch = false;
                // High precision match with ID
                if (h.targetId && formData.id) {
                    isMatch = h.targetId === formData.id &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                // Fallback for legacy items without ID
                if (!isMatch && !h.targetId) {
                    isMatch = h.targetKeyword === formData.name &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                return !isMatch;
            });

            // If no change, return
            if (updatedWorkHistory.length === (propertyData.workHistory || []).length) return;

            const updatedProperty = {
                ...propertyData,
                workHistory: updatedWorkHistory
            };

            await fetch(`/api/properties?id=${propertyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProperty)
            });

        } catch (e) {
            console.error('Failed to sync delete to property:', e);
        }
    };

    const handleDeleteHistory = async (index: number) => {
        if (!confirm('해당 작업내역을 삭제하시겠습니까?')) return;

        const itemToDelete = formData.history[index];

        const updatedHistory = formData.history.filter((_: any, i: number) => i !== index);
        const updatedData = { ...formData, history: updatedHistory };

        setFormData(updatedData);

        if (formData.id) {
            saveCustomer(updatedData).then(success => {
                if (success) {
                    alert('작업내역이 삭제되었습니다.');
                    // Sync Delete to Property if targetId exists
                    if (itemToDelete.targetId) {
                        deleteWorkHistoryFromProperty(itemToDelete.targetId, itemToDelete);
                    }
                }
            });
        }
    };

    const handleAddPromotedProperty = () => {
        setIsPropertySelectorOpen(true);
    };

    const syncWorkHistoryToProperty = async (propertyId: string, historyItem: any, personName: string) => {
        try {
            const res = await fetch(`/api/properties?id=${propertyId}`);
            if (!res.ok) {
                alert(`Sync Error: Failed to fetch property data (Status: ${res.status})`);
                return;
            }
            const propertyData = await res.json();

            // Create Work History Item for Property
            const newWorkHistory = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: historyItem.date,
                manager: historyItem.manager, // Current User Name
                content: historyItem.content,
                details: historyItem.details || '',
                targetType: 'customer',
                targetKeyword: personName,
                targetId: formData.id // Link back to this customer
            };

            const updatedProperty = {
                ...propertyData,
                workHistory: [...(propertyData.workHistory || []), newWorkHistory]
            };

            const putRes = await fetch(`/api/properties?id=${propertyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProperty)
            });

            if (putRes.ok) {
                // Success silently
            } else {
                console.error(`Property Update Failed: ${putRes.status}`);
            }

        } catch (e) {
            console.error('Failed to sync work history to property:', e);
        }
    };

    const syncToProperty = async (customer: Customer, property: any) => {
        try {
            // 1. Fetch Property
            const res = await fetch(`/api/properties?id=${property.id}`);
            if (!res.ok) return;
            const propData = await res.json();

            // 2. Check overlap
            const currentPromoted = propData.promotedCustomers || [];
            // Check if this customer is already in the list (by targetId)
            if (currentPromoted.some((p: any) => p.targetId === customer.id)) return;

            // 3. Add to Property
            const newPromoted = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: new Date().toISOString().split('T')[0],
                name: customer.name,
                type: 'customer',
                classification: customer.grade || '-',
                budget: customer.budget || '-',
                features: customer.feature || '-',
                targetId: customer.id,
                contact: customer.mobile || customer.companyPhone || ''
            };

            const updatedProp = {
                ...propData,
                promotedCustomers: [...currentPromoted, newPromoted]
            };

            await fetch(`/api/properties?id=${property.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProp)
            });

            // 4. Create Schedule Event
            const userStr = localStorage.getItem('user');
            let userInfo = { userId: '', companyName: '' };
            if (userStr) {
                const parsed = JSON.parse(userStr);
                userInfo = { userId: parsed.id, companyName: parsed.companyName || '' };
            }

            const schedulePayload = {
                title: `[추진등록] ${customer.name} - ${property.name}`,
                date: new Date().toISOString().split('T')[0],
                scope: 'work',
                status: 'completed',
                type: 'work',
                color: '#339af0', // Blue
                propertyId: property.id,
                customerId: customer.id,
                details: `추진고객 등록: ${customer.name} (자동연동)`,
                ...userInfo
            };

            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(schedulePayload)
            });

        } catch (e) {
            console.error('Failed to sync promoted property:', e);
        }
    };

    const handleSelectProperty = async (selectedProperties: any[]) => {
        const currentList = formData.promotedProperties || [];
        const currentIds = currentList.map((p: any) => p.id);

        const newItems = selectedProperties.filter((p: any) => !currentIds.includes(p.id));

        if (newItems.length === 0) {
            alert('선택한 물건이 이미 모두 추가되어 있습니다.');
            return;
        }

        const itemsToAdd = newItems.map((p: any) => ({
            ...p,
            addedDate: new Date().toISOString().split('T')[0]
        }));

        const updatedList = [...itemsToAdd, ...currentList];
        setFormData(prev => ({ ...prev, promotedProperties: updatedList }));

        if (formData.id) {
            const updatedData = { ...formData, promotedProperties: updatedList };
            const saved = await saveCustomer(updatedData);

            // Sync new items to Property & Schedule
            if (saved) {
                for (const item of itemsToAdd) {
                    await syncToProperty(saved, item);
                }
            }
        }
    };

    const handleTogglePromotedSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedPromotedIds(prev => [...prev, id]);
        } else {
            setSelectedPromotedIds(prev => prev.filter(pid => pid !== id));
        }
    };

    const deletePromotedCustomerFromProperty = async (propertyId: string, customerId: string) => {
        try {
            const res = await fetch(`/api/properties?id=${propertyId}`);
            if (!res.ok) return;
            const propertyData = await res.json();

            const updatedPromoted = (propertyData.promotedCustomers || []).filter((c: any) => c.targetId !== customerId);

            if (updatedPromoted.length === (propertyData.promotedCustomers || []).length) return;

            const updatedProperty = {
                ...propertyData,
                promotedCustomers: updatedPromoted
            };

            await fetch(`/api/properties?id=${propertyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProperty)
            });
        } catch (e) {
            console.error('Failed to sync promoted customer deletion to property:', e);
        }
    };

    const handleDeletePromotedProperties = async () => {
        if (selectedPromotedIds.length === 0) {
            alert('삭제할 물건을 선택해주세요.');
            return;
        }

        if (!confirm('선택한 추진물건을 삭제하시겠습니까?')) return;

        const itemsToDelete = (formData.promotedProperties || []).filter((p: any) => selectedPromotedIds.includes(p.id));

        const updatedList = (formData.promotedProperties || []).filter((p: any) => !selectedPromotedIds.includes(p.id));
        const updatedData = { ...formData, promotedProperties: updatedList };

        setFormData(updatedData);
        setSelectedPromotedIds([]);

        if (formData.id) {
            await saveCustomer(updatedData);

            // Sync Deletion to Property
            for (const item of itemsToDelete) {
                if (item.id) {
                    await deletePromotedCustomerFromProperty(item.id, formData.id);
                }
            }

            alert('삭제되었습니다.');
        }
    };

    const handleSave = async () => {
        const isNew = !formData.id;
        const savedData = await saveCustomer(formData);
        if (savedData) {
            // 1. Sync History for New Customer
            if (isNew && formData.history.length > 0) {
                for (const h of formData.history) {
                    await createScheduleSync(h, formData.name, savedData.id!);
                }
            }

            // 2. Sync Promoted Properties for New Customer (since handleSelectProperty couldn't sync without ID)
            if (isNew && formData.promotedProperties && formData.promotedProperties.length > 0) {
                for (const p of formData.promotedProperties) {
                    await syncToProperty(savedData, p);
                }
            }

            alert('저장되었습니다.');
            if (onSuccess) onSuccess();
            else onClose();
        }
    };

    const handleDeleteCustomer = async () => {
        if (!id) return;
        if (!confirm('정말 이 고객 정보를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/customers?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('고객 정보가 삭제되었습니다.');
                if (onSuccess) onSuccess();
                else onClose();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        if (confirm('기존 입력 내용이 초기화됩니다. 계속하시겠습니까?')) {
            let defaultManagerId = '';
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    defaultManagerId = user.id;
                } catch (e) {
                    console.error(e);
                }
            }
            setFormData({
                ...INITIAL_DATA,
                managerId: defaultManagerId
            });
        }
    };

    return (
        <div className={styles.container} style={{ height: '100%', border: 'none', background: 'transparent', padding: isModal ? 0 : 16 }}>
            {/* Header */}
            {!isModal && (
                <div className={styles.header}>
                    <div className={styles.title}>고객카드 {id ? '' : '(신규)'}</div>
                </div>
            )}

            <div className={styles.grid}>
                {/* Left Panel: Customer Info & Contact */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader} style={{ justifyContent: 'space-between' }}>
                        <span>고객정보</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 'normal',
                                fontSize: 13,
                                cursor: 'pointer',
                                backgroundColor: 'white',
                                padding: '3px 8px',
                                borderRadius: 4,
                                marginRight: 8
                            }}
                                onClick={() => handleChange('isFavorite', !formData.isFavorite)}>
                                <Star
                                    size={16}
                                    fill={formData.isFavorite ? "#FFD700" : "none"}
                                    color={formData.isFavorite ? "#FFD700" : "#adb5bd"}
                                />
                                <span style={{
                                    color: formData.isFavorite ? "#fcc419" : "#495057",
                                    fontWeight: formData.isFavorite ? 'bold' : 'normal'
                                }}>관심고객</span>
                            </div>
                            <select
                                className={styles.select}
                                style={{ width: 100, color: '#333' }}
                                value={formData.managerId || ''}
                                onChange={(e) => handleChange('managerId', e.target.value)}
                            >
                                <option value="">담당자 미지정</option>
                                {managers.map(mgr => (
                                    <option key={mgr.id} value={mgr.id}>
                                        {mgr.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={styles.panelContent}>
                        {/* Basic Info */}
                        <div className={styles.formRow}>
                            <div className={styles.label}>고객명</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>성별</div>
                            <div className={styles.inputWrapper} style={{ gap: 12 }}>
                                <label className={styles.radioLabel}>
                                    <input type="radio" name="gender" checked={formData.gender === 'M'} onChange={() => handleChange('gender', 'M')} /> 남
                                </label>
                                <label className={styles.radioLabel}>
                                    <input type="radio" name="gender" checked={formData.gender === 'F'} onChange={() => handleChange('gender', 'F')} /> 여
                                </label>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>주소</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.address} onChange={(e) => handleChange('address', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>특징</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.feature} onChange={(e) => handleChange('feature', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>고객등급</div>
                            <div className={styles.inputWrapper} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {['progress', 'manage', 'hold', 'common', 'complete'].map(g => (
                                    <label key={g} className={styles.radioLabel}>
                                        <input type="radio" name="grade" checked={formData.grade === g} onChange={() => handleChange('grade', g)} />
                                        {g === 'progress' ? '추진' : g === 'manage' ? '관리' : g === 'hold' ? '보류' : g === 'common' ? '공동' : '완료'}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>분류</div>
                            <div className={styles.inputWrapper}>
                                <input
                                    className={styles.input}
                                    value={formData.class}
                                    onChange={(e) => handleChange('class', e.target.value)}
                                    placeholder="분류 입력"
                                />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>진행상태</div>
                            <div className={styles.inputWrapper}>
                                <select className={styles.select} value={formData.status} onChange={(e) => handleChange('status', e.target.value)}>
                                    <option value="물건진행">물건진행</option>
                                    <option value="물건문의">물건문의</option>
                                    <option value="물건컨택">물건컨택</option>
                                    <option value="계약진행">계약진행</option>
                                    <option value="계약보류">계약보류</option>
                                    <option value="완전보류">완전보류</option>
                                    <option value="계약완료">계약완료</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>진행내역</div>
                            <div className={styles.inputWrapper}>
                                <textarea className={styles.textarea} value={formData.memoHistory || ''} onChange={(e) => handleChange('memoHistory', e.target.value)} />
                            </div>
                        </div>

                        {/* Contact Info (Consolidated) */}
                        <div className={styles.sectionHeader}>[상세정보: 연락처/점포]</div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>핸드폰</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>회사전화</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.companyPhone} onChange={(e) => handleChange('companyPhone', e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>자택전화</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.homePhone} onChange={(e) => handleChange('homePhone', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>이메일</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>기타전화</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.otherPhone} onChange={(e) => handleChange('otherPhone', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>팩스</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.fax} onChange={(e) => handleChange('fax', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.label}>고객상황</div>
                            <div className={styles.inputWrapper}>
                                <textarea className={styles.textarea} value={formData.memoSituation || ''} onChange={(e) => handleChange('memoSituation', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>관심내용</div>
                            <div className={styles.inputWrapper}>
                                <textarea className={styles.textarea} value={formData.memoInterest || ''} onChange={(e) => handleChange('memoInterest', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>진행</div>
                            <div className={styles.inputWrapper} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {['계약상황', '답사추진', '상담중', '물건검색', '방문예정', '미팅예정'].map(step => (
                                    <label key={step} className={styles.radioLabel}>
                                        <input
                                            type="checkbox"
                                            checked={(formData.progressSteps || []).includes(step)}
                                            onChange={(e) => {
                                                const current = formData.progressSteps || [];
                                                if (e.target.checked) {
                                                    handleChange('progressSteps', [...current, step]);
                                                } else {
                                                    handleChange('progressSteps', current.filter(s => s !== step));
                                                }
                                            }}
                                        />
                                        {step}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Store Customer Requirements */}
                        <div className={styles.sectionHeader}>[점포고객]</div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>찾는물건</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.wantedItem || ''} onChange={(e) => handleChange('wantedItem', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>찾는업종</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.wantedIndustry || ''} onChange={(e) => handleChange('wantedIndustry', e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>찾는지역</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.wantedArea || ''} onChange={(e) => handleChange('wantedArea', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>예산</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.budget || ''} onChange={(e) => handleChange('budget', e.target.value)} placeholder="예: 5000~1억" />
                                </div>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>특징</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.wantedFeature || ''} onChange={(e) => handleChange('wantedFeature', e.target.value)} />
                            </div>
                        </div>



                        {/* Dynamic Range Inputs */}
                        {(formData.propertyType === 'store' || !formData.propertyType) && (
                            <>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedAreaMin || ''}
                                                    onChange={(e) => handleChange('wantedAreaMin', e.target.value)}
                                                    placeholder="최소"
                                                    style={{ width: '100%', paddingRight: 30 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedAreaMax || ''}
                                                    onChange={(e) => handleChange('wantedAreaMax', e.target.value)}
                                                    placeholder="최대"
                                                    style={{ width: '100%', paddingRight: 30 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.label}>층수</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedFloorMin || ''}
                                                    onChange={(e) => handleChange('wantedFloorMin', e.target.value)}
                                                    placeholder="최소"
                                                    style={{ width: '100%', paddingRight: 30 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>층</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedFloorMax || ''}
                                                    onChange={(e) => handleChange('wantedFloorMax', e.target.value)}
                                                    placeholder="최대"
                                                    style={{ width: '100%', paddingRight: 30 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>층</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.label}>임대료(월세)</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedRentMin || ''}
                                                    onChange={(e) => handleChange('wantedRentMin', e.target.value)}
                                                    style={{ width: '100%', paddingRight: 40 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedRentMax || ''}
                                                    onChange={(e) => handleChange('wantedRentMax', e.target.value)}
                                                    style={{ width: '100%', paddingRight: 40 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.label}>보증금</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedDepositMin || ''}
                                                    onChange={(e) => handleChange('wantedDepositMin', e.target.value)}
                                                    style={{ width: '100%', paddingRight: 40 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    className={styles.rangeInput}
                                                    value={formData.wantedDepositMax || ''}
                                                    onChange={(e) => handleChange('wantedDepositMax', e.target.value)}
                                                    style={{ width: '100%', paddingRight: 40 }}
                                                />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {formData.propertyType === 'building' && (
                            <>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>대지면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMin || ''} onChange={(e) => handleChange('wantedLandAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMax || ''} onChange={(e) => handleChange('wantedLandAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>연면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMin || ''} onChange={(e) => handleChange('wantedTotalAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMax || ''} onChange={(e) => handleChange('wantedTotalAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>연수익률</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedYieldMin || ''} onChange={(e) => handleChange('wantedYieldMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>%</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedYieldMax || ''} onChange={(e) => handleChange('wantedYieldMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>매매가</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSalePriceMin || ''} onChange={(e) => handleChange('wantedSalePriceMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSalePriceMax || ''} onChange={(e) => handleChange('wantedSalePriceMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {formData.propertyType === 'hotel' && (
                            <>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>대지면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMin || ''} onChange={(e) => handleChange('wantedLandAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMax || ''} onChange={(e) => handleChange('wantedLandAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>연면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMin || ''} onChange={(e) => handleChange('wantedTotalAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMax || ''} onChange={(e) => handleChange('wantedTotalAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>임대료</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMin || ''} onChange={(e) => handleChange('wantedRentMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMax || ''} onChange={(e) => handleChange('wantedRentMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>보증금</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMin || ''} onChange={(e) => handleChange('wantedDepositMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMax || ''} onChange={(e) => handleChange('wantedDepositMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {formData.propertyType === 'apartment' && (
                            <>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>공급면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSupplyAreaMin || ''} onChange={(e) => handleChange('wantedSupplyAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSupplyAreaMax || ''} onChange={(e) => handleChange('wantedSupplyAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>보증금</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMin || ''} onChange={(e) => handleChange('wantedDepositMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMax || ''} onChange={(e) => handleChange('wantedDepositMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>임대료</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMin || ''} onChange={(e) => handleChange('wantedRentMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMax || ''} onChange={(e) => handleChange('wantedRentMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>매매가</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSalePriceMin || ''} onChange={(e) => handleChange('wantedSalePriceMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedSalePriceMax || ''} onChange={(e) => handleChange('wantedSalePriceMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {formData.propertyType === 'estate' && (
                            <>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>대지면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMin || ''} onChange={(e) => handleChange('wantedLandAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedLandAreaMax || ''} onChange={(e) => handleChange('wantedLandAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>연면적</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMin || ''} onChange={(e) => handleChange('wantedTotalAreaMin', e.target.value)} placeholder="최소" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedTotalAreaMax || ''} onChange={(e) => handleChange('wantedTotalAreaMax', e.target.value)} placeholder="최대" style={{ width: '100%', paddingRight: 30 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>평</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>보증금</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMin || ''} onChange={(e) => handleChange('wantedDepositMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedDepositMax || ''} onChange={(e) => handleChange('wantedDepositMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.label}>임대료</div>
                                    <div className={styles.inputWrapper}>
                                        <div className={styles.rangeWrapper}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMin || ''} onChange={(e) => handleChange('wantedRentMin', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                            <span style={{ margin: '0 8px' }}>~</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input className={styles.rangeInput} value={formData.wantedRentMax || ''} onChange={(e) => handleChange('wantedRentMax', e.target.value)} style={{ width: '100%', paddingRight: 40 }} />
                                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd', fontSize: 13, pointerEvents: 'none' }}>만원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Property Type Selection */}
                        <div className={styles.formRow}>
                            <div className={styles.label}>물건종류</div>
                            <div className={styles.inputWrapper} style={{ display: 'flex', gap: 12 }}>
                                {['store', 'building', 'hotel', 'apartment', 'estate'].map(type => (
                                    <label key={type} className={styles.radioLabel}>
                                        <input
                                            type="radio"
                                            name="propertyType"
                                            checked={(formData.propertyType || 'store') === type}
                                            onChange={() => handleChange('propertyType', type)}
                                        />
                                        {type === 'store' ? '점포' :
                                            type === 'building' ? '빌딩' :
                                                type === 'hotel' ? '호텔' :
                                                    type === 'apartment' ? '아파트' : '부동산'}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: History & Promoted Items - ALWAYS SHOW */}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Upper: Work History */}
                    <div className={styles.panel} style={{ flex: 1 }}>
                        <div className={styles.panelHeaderBlue}>
                            <span>고객작업내역</span>
                            <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} onClick={() => { setEditingHistoryIndex(null); setIsWorkModalOpen(true); }}>+ 작업추가</button>
                        </div>
                        <div className={styles.panelContent} style={{ padding: 0 }}>
                            <table className={styles.historyTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>No</th>
                                        <th style={{ width: 100, whiteSpace: 'nowrap' }}>날짜</th>
                                        <th style={{ width: 80 }}>작업자</th>
                                        <th style={{ width: 120 }}>관련물건</th>
                                        <th>내역</th>
                                        <th style={{ width: 60, textAlign: 'center' }}>삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!formData.history || formData.history.length === 0) ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 20, color: '#868e96' }}>등록된 내역이 없습니다.</td>
                                        </tr>
                                    ) : (
                                        formData.history.map((item: any, i) => (
                                            <tr key={i} onClick={() => { setEditingHistoryIndex(i); setIsWorkModalOpen(true); }} style={{ cursor: 'pointer' }}>
                                                <td>{i + 1}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.date}</td>
                                                <td>{item.manager || item.worker}</td>
                                                <td
                                                    style={{
                                                        color: item.targetId ? '#228BE6' : 'inherit',
                                                        cursor: item.targetId ? 'pointer' : 'default',
                                                        fontWeight: item.targetId ? '500' : 'normal'
                                                    }}
                                                    onClick={(e) => {
                                                        if (item.targetId) {
                                                            e.stopPropagation();
                                                            setOpenedPropertyId(item.targetId);
                                                        }
                                                    }}
                                                >
                                                    {item.relatedProperty || item.related}
                                                </td>
                                                <td>{item.content}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        className={styles.iconBtn}
                                                        style={{ color: '#e03131', padding: 4 }}
                                                        onClick={() => handleDeleteHistory(i)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Lower: Promoted Items */}
                    <div className={styles.panel} style={{ flex: 1 }}>
                        <div className={styles.panelHeaderBlue}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <span>추진물건</span>
                                <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} onClick={handleAddPromotedProperty}>+ 점포</button>
                                {/* <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}>+ 빌딩</button> */}
                                {/* <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}>+ 호텔</button> */}
                            </div>
                            <button
                                className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}
                                style={{ color: '#e03131' }}
                                onClick={handleDeletePromotedProperties}
                            >
                                - 제거
                            </button>
                        </div>
                        <div className={styles.panelContent} style={{ padding: 0 }}>
                            <table className={styles.historyTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, whiteSpace: 'nowrap' }}>선택</th>
                                        <th style={{ width: 40 }}>No</th>
                                        <th style={{ width: 90, whiteSpace: 'nowrap' }}>날짜</th>
                                        <th>물건명</th>
                                        <th style={{ width: 50 }}>업종</th>
                                        <th style={{ width: 80 }}>금액</th>
                                        <th style={{ width: 120 }}>주소</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!formData.promotedProperties || formData.promotedProperties.length === 0) ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: 20, color: '#868e96' }}>추진 중인 물건이 없습니다.</td>
                                        </tr>
                                    ) : (
                                        formData.promotedProperties.map((item: any, i) => (
                                            <tr key={item.id} onClick={() => item.isSynced !== false && setOpenedPropertyId(item.id)} style={{ cursor: item.isSynced !== false ? 'pointer' : 'default' }}>
                                                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPromotedIds.includes(item.id)}
                                                        onChange={(e) => handleTogglePromotedSelect(item.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td>{i + 1}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.addedDate || item.date || '-'}</td>
                                                <td style={{
                                                    color: item.isSynced !== false ? '#228BE6' : 'inherit',
                                                    maxWidth: '150px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }} title={item.name}>
                                                    {item.name}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.industrySector || item.type}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {Number(item.totalPrice || (parseInt(item.premium || '0') + parseInt(item.deposit || '0'))).toLocaleString()}
                                                </td>
                                                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.address}>
                                                    {item.address}
                                                </td>
                                            </tr>
                                        ))
                                    )}

                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    <button className={styles.footerBtn} onClick={handleSave}>
                        <Save size={16} /> 저장
                    </button>
                    {id && (
                        <button className={styles.footerBtn} onClick={handleDeleteCustomer}>
                            <Trash2 size={16} /> 삭제
                        </button>
                    )}
                </div>
                <div className={styles.footerRight}>
                    <button className={styles.footerBtn} onClick={handleReset}>
                        <Plus size={16} /> 신규
                    </button>
                    <button className={styles.footerBtn} onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>

            <WorkHistoryModal
                isOpen={isWorkModalOpen}
                onClose={() => { setIsWorkModalOpen(false); setEditingHistoryIndex(null); }}
                onSave={handleSaveWorkHistory}
                initialData={editingHistoryIndex !== null ? formData.history[editingHistoryIndex] : null}
            />

            <PropertySelector
                isOpen={isPropertySelectorOpen}
                onClose={() => setIsPropertySelectorOpen(false)}
                onSelect={handleSelectProperty}
                onOpenCard={(id) => setOpenedPropertyId(id)}
            />

            {/* Property Card Modal */}
            {openedPropertyId && openedPropertyData && (
                <div className={styles.modalOverlay} style={{ zIndex: 3100 }} onClick={() => setOpenedPropertyId(null)}>
                    <div className={styles.modalContent} style={{ width: '90%', maxWidth: '1400px', height: '90vh', padding: 0 }} onClick={e => e.stopPropagation()}>
                        <PropertyCard
                            property={openedPropertyData}
                            onClose={() => setOpenedPropertyId(null)}
                            onRefresh={() => {
                                // Reload property data if needed, or refresh list
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Loading Overlay if needed */}
            {openedPropertyId && !openedPropertyData && (
                <div className={styles.modalOverlay} style={{ zIndex: 3100 }}>
                    <div style={{ color: 'white' }}>로딩중...</div>
                </div>
            )}
        </div>
    );
}
