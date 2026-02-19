"use client";

import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Trash2, Star, List, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import styles from '@/app/(main)/customers/register/page.module.css'; // Reusing Customer styles for consistency
import WorkHistoryModal from '../customers/WorkHistoryModal';
import PropertySelector from '../customers/PropertySelector';
import PropertyCard from '../properties/PropertyCard';
import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { getRequesterId as resolveRequesterId, getStoredCompanyName, getStoredUser } from '@/utils/userUtils';

interface BusinessCardData {
    id?: string;
    name: string;
    gender: 'M' | 'F';
    category: string;
    companyName: string; // The target company, not the user's company
    companyAddress: string;
    department: string;
    position: string; // Added missing field
    homeAddress: string;
    mobile: string;
    companyPhone1: string;
    companyPhone2: string;
    fax: string;
    homePhone: string;
    homepage: string;
    email: string;
    memo: string;

    // System fields
    managerId?: string; // The user who owns this card
    manager_id?: string; // UUID from DB
    userCompanyName?: string; // The segregation key
    isFavorite?: boolean;

    createdAt?: string;
    history: any[];
    promotedProperties?: any[];
}

const INITIAL_DATA: BusinessCardData = {
    name: '',
    gender: 'M',
    category: '',
    companyName: '',
    companyAddress: '',
    department: '',
    position: '', // Fix: Add missing field
    homeAddress: '',
    mobile: '',
    companyPhone1: '',
    companyPhone2: '',
    fax: '',
    homePhone: '',
    homepage: '',
    email: '',
    memo: '',
    history: [],
    promotedProperties: []
};

interface BusinessCardProps {
    id?: string | null;
    onClose: () => void;
    onSuccess?: () => void;
    isModal?: boolean;
    // Navigation Props
    onNavigate?: (action: 'first' | 'prev' | 'next' | 'last') => void;
    canNavigate?: { first: boolean; prev: boolean; next: boolean; last: boolean };
}

export default function BusinessCard({ id, onClose, onSuccess, isModal = false, onNavigate, canNavigate }: BusinessCardProps) {
    const [formData, setFormData] = useState<BusinessCardData>(INITIAL_DATA);
    const [loading, setLoading] = useState(false);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [isDirectCategory, setIsDirectCategory] = useState(false);

    // Modals & Selection State
    const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
    const [isPropertySelectorOpen, setIsPropertySelectorOpen] = useState(false);
    const [selectedPromotedIds, setSelectedPromotedIds] = useState<string[]>([]);
    const [openedPropertyId, setOpenedPropertyId] = useState<string | null>(null);
    const [openedPropertyData, setOpenedPropertyData] = useState<any>(null);

    const [managers, setManagers] = useState<{ id: string, name: string }[]>([]);

    // Edit State for Work History
    const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info'; onClose?: () => void }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void; isDanger?: boolean }>({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        isDanger: false
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
        setAlertConfig({ isOpen: true, message, type, onClose });
    };

    const closeAlert = () => {
        if (alertConfig.onClose) alertConfig.onClose();
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    const showConfirm = (message: string, onConfirm: () => void, isDanger = false) => {
        setConfirmModal({ isOpen: true, message, onConfirm, isDanger });
    };

    const getRequesterId = () => {
        return resolveRequesterId(getStoredUser());
    };

    const withRequesterId = (url: string) => {
        const requesterId = getRequesterId();
        if (!requesterId) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}requesterId=${encodeURIComponent(requesterId)}`;
    };

    const withRequesterPayload = <T extends Record<string, unknown>>(payload: T): T | (T & { requesterId: string }) => {
        const requesterId = getRequesterId();
        if (!requesterId) return payload;
        return { ...payload, requesterId };
    };

    // Load Data & Managers
    useEffect(() => {
        // Fetch Managers
        // Fetch Managers moved inside loadData to use company filter

        const loadData = async () => {
            try {
                const currentUser = getStoredUser();
                const myCompany = getStoredCompanyName(currentUser);
                const myId = resolveRequesterId(currentUser);

                // Fetch Managers (Filtered by Company)
                if (myCompany) {
                    const managerParams = new URLSearchParams();
                    managerParams.set('company', myCompany);
                    if (myId) managerParams.set('requesterId', myId);
                    const managerQuery = managerParams.toString();
                    fetch(`/api/users${managerQuery ? `?${managerQuery}` : ''}`)
                        .then(res => res.json())
                        .then(data => setManagers(data))
                        .catch(err => console.error(err));
                }

                // Set default manager for new
                if (!id) {
                    setFormData(prev => ({ ...prev, managerId: myId }));
                }

                const listParams = new URLSearchParams();
                if (myCompany) listParams.set('company', myCompany);
                if (myId) listParams.set('userId', myId);

                const query = listParams.toString();
                const res = await fetch(`/api/business-cards${query ? `?${query}` : ''}`, { cache: 'no-store' });
                if (res.ok) {
                    const cards: BusinessCardData[] = await res.json();
                    const categories = Array.from(new Set(['기타', ...cards.map(c => c.category).filter(Boolean)])).sort();
                    setCategoryOptions(categories);

                    if (id) {
                        const found = cards.find(c => c.id === id);
                        if (found) {
                            // Sanitize nulls to empty strings for inputs
                            setFormData({
                                ...INITIAL_DATA,
                                ...found,
                                companyName: found.companyName || '',
                                department: found.department || '',
                                position: found.position || '',
                                mobile: found.mobile || '',
                                companyPhone1: found.companyPhone1 || '',
                                companyPhone2: found.companyPhone2 || '',
                                fax: found.fax || '',
                                homePhone: found.homePhone || '',
                                homepage: found.homepage || '',
                                email: found.email || '',
                                memo: found.memo || '',
                                companyAddress: found.companyAddress || '',
                                homeAddress: found.homeAddress || '',
                                managerId: found.managerId || '',
                                manager_id: found.manager_id // Copy UUID from DB if exists
                            });

                            if (found.category && (!categories.includes(found.category) || found.category === '기타')) {
                                // Logic for direct input or existing category
                                if (found.category !== '기타' && !categories.includes(found.category)) setIsDirectCategory(true);
                                else setIsDirectCategory(false);
                            } else {
                                setIsDirectCategory(false);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load business cards:", error);
            }
        };
        loadData();
    }, [id]);



    // Fetch Property Detail
    useEffect(() => {
        if (openedPropertyId) {
            fetch(withRequesterId(`/api/properties?id=${openedPropertyId}`))
                .then(res => res.json())
                .then(data => setOpenedPropertyData(data))
                .catch(err => console.error(err));
        } else {
            setOpenedPropertyData(null);
        }
    }, [openedPropertyId]);

    // ESC Key Handling
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isWorkModalOpen) {
                    setIsWorkModalOpen(false);
                    e.stopPropagation();
                    return;
                }

                if (openedPropertyId) {
                    setOpenedPropertyId(null);
                    e.stopPropagation();
                } else if (isPropertySelectorOpen) {
                    setIsPropertySelectorOpen(false);
                    e.stopPropagation();
                }
            }
        };
        window.addEventListener('keydown', handleEsc, { capture: true });
        return () => window.removeEventListener('keydown', handleEsc, { capture: true });
    }, [openedPropertyId, isPropertySelectorOpen, isWorkModalOpen]);

    // --- LOGIC: Schedule & History ---

    const createScheduleSync = async (historyItem: any, cardName: string, cardId: string) => {
        try {
            const currentUser = getStoredUser();
            const userInfo = {
                userId: resolveRequesterId(currentUser),
                companyName: getStoredCompanyName(currentUser)
            };

            const payload = {
                title: `[고객작업] ${cardName} - ${historyItem.content}`,
                date: historyItem.date,
                scope: 'work',
                status: 'completed',
                details: historyItem.details || '',
                type: 'work',
                color: '#7950f2', // Purple for Business Card Work (Unified)
                businessCardId: cardId,
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

    const handleChange = (field: keyof BusinessCardData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__direct__') {
            setIsDirectCategory(true);
            // setFormData(prev => ({ ...prev, category: '' })); // Optional: clear or keep? Keep is safer.
        } else {
            setIsDirectCategory(false);
            handleChange('category', val);
        }
    };

    const toggleFavorite = () => {
        setFormData(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const currentUser = getStoredUser();
            const userCompanyName = getStoredCompanyName(currentUser);
            const managerId = resolveRequesterId(currentUser);

            const payload = {
                ...formData,
                userCompanyName: formData.userCompanyName || userCompanyName,
                managerId: formData.managerId || managerId
            };

            const method = id ? 'PUT' : 'POST';
            const res = await fetch('/api/business-cards', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const savedData = await res.json();

                // 1. Sync History (Original Logic - kept)
                if (!id && formData.history.length > 0) {
                    for (const h of formData.history) {
                        await createScheduleSync(h, formData.name, savedData.id);
                    }
                }

                // 2. Sync Promoted Properties (New Logic)
                if (!id && formData.promotedProperties && formData.promotedProperties.length > 0) {
                    for (const p of formData.promotedProperties) {
                        await syncToProperty(savedData, p);
                    }
                }


                showAlert('저장되었습니다.', 'success', () => {
                    if (onSuccess) onSuccess();
                    else onClose();
                });
            } else {
                const savedData = await res.json();
                showAlert(`저장에 실패했습니다.\n사유: ${savedData.error || '알 수 없는 오류'}`, 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC: History Operations ---

    const handleHistoryAdd = async (newHistory: any) => {
        const updatedHistory = [newHistory, ...formData.history];
        const updatedData = { ...formData, history: updatedHistory };
        setFormData(updatedData);
        setIsWorkModalOpen(false);

        if (formData.id) {
            try {
                await fetch('/api/business-cards', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                await createScheduleSync(newHistory, formData.name, formData.id);
            } catch (e) { console.error(e) }
        }
    };

    const handleSaveWorkHistory = (data: any) => {
        const userStr = localStorage.getItem('user');
        let managerName = 'Unknown';
        if (userStr) {
            const parsed = JSON.parse(userStr);
            const u = parsed.user || parsed;
            managerName = u.name || u.managerName || 'Unknown';
        }

        if (editingHistoryIndex !== null) {
            // Edit Mode
            const updatedItem = {
                ...formData.history[editingHistoryIndex],
                ...data,
                // Do not overwrite ID or Manager if not intended, but usually we keep original manager unless changed?
                // Let's keep original manager for history integrity? Or update to current editor?
                // Usually edit updates content but not "Worker". Or maybe it does.
                // For now, let's just update content fields.
                date: data.date,
                content: data.content,
                details: data.details,
                relatedProperty: data.targetName || ''
            };

            const newHistoryList = [...formData.history];
            newHistoryList[editingHistoryIndex] = updatedItem;

            setFormData(prev => ({ ...prev, history: newHistoryList }));

            // Sync Update to Server immediately if card exists
            if (formData.id) {
                fetch('/api/business-cards', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...formData, history: newHistoryList })
                }).catch(console.error);

                // TODO: Also sync update to Property/Schedule if Linked? 
                // Getting complicated. For now, just fix the view/edit in this list.
            }

        } else {
            // Add Mode
            const newHistory = {
                id: Date.now(),
                ...data,
                manager: managerName,
                relatedProperty: data.targetName || ''
            };
            handleHistoryAdd(newHistory);

            // NEW: Sync to Property if targetId exists
            if (data.targetId) {
                syncWorkHistoryToProperty(data.targetId, newHistory, formData.name);
            }
        }

        // Reset
        setEditingHistoryIndex(null);
        setIsWorkModalOpen(false);
    };

    const syncWorkHistoryToProperty = async (propertyId: string, historyItem: any, personName: string) => {
        try {
            const res = await fetch(withRequesterId(`/api/properties?id=${propertyId}`));
            if (!res.ok) return;
            const propertyData = await res.json();

            // Create Work History Item for Property
            const newWorkHistory = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: historyItem.date,
                manager: historyItem.manager, // Current User Name
                content: historyItem.content,
                details: historyItem.details || '',
                targetType: 'businessCard',
                targetKeyword: personName,
                targetId: formData.id // Link back to this business card
            };

            const updatedProperty = {
                ...propertyData,
                workHistory: [...(propertyData.workHistory || []), newWorkHistory]
            };

            const putRes = await fetch(withRequesterId(`/api/properties?id=${propertyId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withRequesterPayload(updatedProperty))
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

    const deleteWorkHistoryFromProperty = async (propertyId: string, historyItem: any) => {
        try {
            const res = await fetch(withRequesterId(`/api/properties?id=${propertyId}`));
            if (!res.ok) return;
            const propertyData = await res.json();

            // Match by targetId (BusinessCard ID), Date, and Content
            const updatedWorkHistory = (propertyData.workHistory || []).filter((h: any) => {
                let isMatch = false;
                if (h.targetId && formData.id) {
                    isMatch = h.targetId === formData.id &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                // Fallback
                if (!isMatch && !h.targetId) {
                    isMatch = h.targetKeyword === formData.name &&
                        h.date === historyItem.date &&
                        h.content === historyItem.content;
                }
                return !isMatch;
            });

            if (updatedWorkHistory.length === (propertyData.workHistory || []).length) return;

            const updatedProperty = {
                ...propertyData,
                workHistory: updatedWorkHistory
            };

            await fetch(withRequesterId(`/api/properties?id=${propertyId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withRequesterPayload(updatedProperty))
            });

        } catch (e) {
            console.error('Failed to sync delete to property:', e);
        }
    };

    const handleDeleteHistory = async (index: number) => {
        showConfirm('작업내역을 삭제하시겠습니까?', async () => {
            const itemToDelete = formData.history[index];

            const updatedHistory = formData.history.filter((_, i) => i !== index);
            const updatedData = { ...formData, history: updatedHistory };
            setFormData(updatedData);

            if (formData.id) {
                try {
                    await fetch('/api/business-cards', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData)
                    });
                    // Sync Delete to Property
                    if (itemToDelete.targetId) {
                        await deleteWorkHistoryFromProperty(itemToDelete.targetId, itemToDelete);
                    }
                } catch (e) { console.error(e) }
            }
        });
    };

    // --- LOGIC: Promoted Properties ---

    const handleAddPromotedProperty = () => {
        setLinkingPromotedItem(null);
        setIsPropertySelectorOpen(true);
    };
    const [linkingPromotedItem, setLinkingPromotedItem] = useState<{ id: string, name: string } | null>(null);

    // Sync to property (for new items)
    const syncToProperty = async (card: BusinessCardData, property: any) => {
        try {
            // 1. Fetch Property
            const res = await fetch(withRequesterId(`/api/properties?id=${property.id}`));
            if (!res.ok) return;
            const propData = await res.json();

            // 2. Check overlap
            const currentPromoted = propData.promotedCustomers || [];
            if (currentPromoted.some((p: any) => p.targetId === card.id)) return;

            // 3. Add to Property
            const newPromoted = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: new Date().toISOString().split('T')[0],
                name: card.name,
                type: 'businessCard',
                classification: card.category || '-',
                budget: '-', // Business cards usually don't have budget
                features: card.memo || '-',
                targetId: card.id,
                contact: card.mobile || card.companyPhone1 || ''
            };

            const updatedProp = {
                ...propData,
                promotedCustomers: [...currentPromoted, newPromoted]
            };

            await fetch(withRequesterId(`/api/properties?id=${property.id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withRequesterPayload(updatedProp))
            });

            // 4. Create Schedule Event
            const currentUser = getStoredUser();
            const userInfo = {
                userId: resolveRequesterId(currentUser),
                companyName: getStoredCompanyName(currentUser)
            };

            const schedulePayload = {
                title: `[추진등록] ${card.name} - ${property.name}`,
                date: new Date().toISOString().split('T')[0],
                scope: 'work',
                status: 'completed',
                type: 'work',
                color: '#339af0', // Blue
                propertyId: property.id,
                businessCardId: card.id,
                details: `추진고객 등록: ${card.name} (명함/자동연동)`,
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
        // CASE 1: Linking Existing Promoted Item
        if (linkingPromotedItem) {
            if (selectedProperties.length === 0) return;
            const property = selectedProperties[0]; // Take first one

            try {
                const res = await fetch('/api/business-cards/promoted/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        promotedId: linkingPromotedItem.id,
                        propertyId: property.id
                    })
                });

                if (res.ok) {
                    showAlert('연동되었습니다.', 'success');

                    // Optimistic Update: Immediate Value Change
                    setFormData(prev => ({
                        ...prev,
                        promotedProperties: (prev.promotedProperties || []).map(item =>
                            item.id === linkingPromotedItem.id
                                ? { ...item, propertyId: property.id, itemName: property.name }
                                : item
                        )
                    }));

                    // Reload for consistency
                    const loadRes = await fetch(withRequesterId(`/api/business-cards?id=${id}`));
                    if (loadRes.ok) {
                        const refreshed = await loadRes.json();
                        setFormData(prev => ({
                            ...prev,
                            promotedProperties: refreshed.promotedProperties || []
                        }));
                    }
                } else {
                    showAlert('연동 실패', 'error');
                }
            } catch (e) {
                console.error(e);
                showAlert('오류가 발생했습니다.', 'error');
            } finally {
                setLinkingPromotedItem(null);
                setIsPropertySelectorOpen(false);
            }
            return;
        }

        // CASE 2: Adding New Promoted Items (Original Logic)
        const currentList = formData.promotedProperties || [];
        const currentIds = currentList.map((p: any) => p.id);
        const newItems = selectedProperties.filter((p: any) => !currentIds.includes(p.id));

        if (newItems.length === 0) {
            showAlert('이미 추가된 물건입니다.', 'info');
            return;
        }

        const itemsToAdd = newItems.map((p: any) => ({
            ...p,
            propertyId: p.id, // Critical: Set propertyId for the link
            itemName: p.name, // Set name explicitly if needed for display
            addedDate: new Date().toISOString().split('T')[0]
        }));
        const updatedList = [...itemsToAdd, ...currentList];
        const updatedData = { ...formData, promotedProperties: updatedList };

        setFormData(updatedData);

        if (formData.id) {
            // Save local change
            await fetch('/api/business-cards', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            // Sync to Property
            for (const item of itemsToAdd) {
                await syncToProperty(updatedData, item);
            }
        }
    };

    const handleSync = async () => {
        showConfirm('DB 데이터와 동기화하시겠습니까?', async () => {
            try {
                const res = await fetch('/api/business-cards/sync', { method: 'POST' });
                const result = await res.json();
                if (res.ok) {
                    const dbg = result.debug || {};
                    let debugMsg = `\n(Debug - Found: ${dbg.promotedFound || 0}, Matched: ${dbg.promotedMatches || 0})`;
                    if (dbg.lastFailure) debugMsg += `\n[Last Error]: ${dbg.lastFailure}`;

                    showAlert(`동기화 완료\n- 작업내역 연결: ${result.results.history?.matched || 0}건\n- 추진물건 연결: ${result.results.promoted?.matched || 0}건${debugMsg}`, 'success');

                    // Refresh data
                    if (id) {
                        const loadRes = await fetch(withRequesterId(`/api/business-cards?id=${id}`));
                        if (loadRes.ok) {
                            const newData = await loadRes.json();
                            // Sanitize nulls
                            // ... (logic handled in useEffect mainly, but here we do it ad-hoc or could trust useEffect if we trigger it?)
                            // We replicated logic in original code
                            const sanitized = {
                                ...newData,
                                name: newData.name || '',
                                category: newData.category || '',
                                position: newData.position || '',
                                companyName: newData.companyName || '',
                                companyAddress: newData.companyAddress || '',
                                department: newData.department || '',
                                homeAddress: newData.homeAddress || '',
                                mobile: newData.mobile || '',
                                companyPhone1: newData.companyPhone1 || '',
                                companyPhone2: newData.companyPhone2 || '',
                                fax: newData.fax || '',
                                homePhone: newData.homePhone || '',
                                homepage: newData.homepage || '',
                                email: newData.email || '',
                                memo: newData.memo || '',
                                history: newData.history || [],
                                promotedProperties: newData.promotedProperties || []
                            };

                            setFormData(sanitized);
                        }
                    }
                } else {
                    showAlert('동기화 실패: ' + (result.error || '알 수 없는 오류'), 'error');
                }
            } catch (e) {
                console.error(e);
                showAlert('오류가 발생했습니다.', 'error');
            }
        });
    };

    const handleTogglePromotedSelect = (id: string, checked: boolean) => {
        if (checked) setSelectedPromotedIds(prev => [...prev, id]);
        else setSelectedPromotedIds(prev => prev.filter(pid => pid !== id));
    };

    const deletePromotedCustomerFromProperty = async (propertyId: string, businessCardId: string) => {
        try {
            const res = await fetch(withRequesterId(`/api/properties?id=${propertyId}`));
            if (!res.ok) return;
            const propertyData = await res.json();

            const updatedPromoted = (propertyData.promotedCustomers || []).filter((c: any) => c.targetId !== businessCardId);

            if (updatedPromoted.length === (propertyData.promotedCustomers || []).length) return;

            const updatedProperty = {
                ...propertyData,
                promotedCustomers: updatedPromoted
            };

            await fetch(withRequesterId(`/api/properties?id=${propertyId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withRequesterPayload(updatedProperty))
            });
        } catch (e) {
            console.error('Failed to sync promoted customer deletion to property:', e);
        }
    };

    const handleDeletePromotedProperties = async () => {
        if (selectedPromotedIds.length === 0) return;
        showConfirm('선택한 물건을 삭제하시겠습니까?', async () => {
            const itemsToDelete = (formData.promotedProperties || []).filter((p: any) => selectedPromotedIds.includes(p.id));

            const updatedList = (formData.promotedProperties || []).filter((p: any) => !selectedPromotedIds.includes(p.id));
            const updatedData = { ...formData, promotedProperties: updatedList };
            setFormData(updatedData);
            setSelectedPromotedIds([]);

            if (formData.id) {
                await fetch('/api/business-cards', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                // Sync Deletion to Property
                for (const item of itemsToDelete) {
                    if (item.id) {
                        await deletePromotedCustomerFromProperty(item.id, formData.id);
                    }
                }
            }
        });
    };

    // --- Render ---

    const handleDelete = async () => {
        if (!id) return;
        showConfirm('삭제하시겠습니까?', async () => {
            setLoading(true);
            try {
                const requesterId = getRequesterId();
                if (!requesterId) {
                    showAlert('로그인 정보가 없습니다. 다시 로그인 해주세요.', 'error');
                    return;
                }

                const res = await fetch(`/api/business-cards?id=${id}&requesterId=${encodeURIComponent(requesterId)}`, { method: 'DELETE' });
                if (res.ok) {
                    showAlert('삭제되었습니다.', 'success', () => {
                        if (onSuccess) onSuccess();
                        else onClose();
                    });
                } else {
                    showAlert('삭제 실패', 'error');
                }
            } catch (e) {
                console.error(e);
                showAlert('오류 발생', 'error');
            } finally {
                setLoading(false);
            }
        }, true);
    };

    const handleReset = () => {
        showConfirm('작성 내용을 초기화하시겠습니까?', () => {
            setFormData(INITIAL_DATA);
            setIsDirectCategory(false);
        }, true);
    };

    const getSelectedManagerId = () => {
        // 1. Exact Match on Legacy ID
        if (formData.managerId && managers.some((m: any) => m.id === formData.managerId)) return formData.managerId;

        // 2. Exact Match via UUID field (if populated)
        // Check finding by manager_id (from DB column)
        const uuidToFind = formData.manager_id;
        if (uuidToFind) {
            const match = managers.find((m: any) => m.uuid === uuidToFind);
            if (match) return match.id;
        }

        // 3. Fallback: If managerId LOOKS like a UUID (approx len check), try matching it against manager UUIDs
        // This handles data where UUID was saved into the managerId field
        if (formData.managerId && formData.managerId.length > 30) {
            const match = managers.find((m: any) => m.uuid === formData.managerId);
            if (match) return match.id;
        }

        return '';
    };

    return (
        <div className={styles.container} style={{ height: '100%', border: 'none', background: 'transparent' }}>
            {/* Header */}
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={styles.title}>명함카드 {id ? '' : '(신규)'}</div>
                    <div
                        onClick={toggleFavorite}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="관심명함 등록/해제"
                    >
                        <Star
                            size={24}
                            fill={formData.isFavorite ? "#FAB005" : "none"}
                            color={formData.isFavorite ? "#FAB005" : "#ced4da"}
                        />
                    </div>
                </div>
                {id && formData.createdAt && (
                    <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#868e96' }}>
                        등록일 : {formData.createdAt.split('T')[0]}
                    </div>
                )}
            </div>

            <div className={styles.grid}>
                {/* Left Panel: Info */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span>명함 정보</span>
                        {/* Optional: Star here too if modal */}
                        {isModal && (
                            <div
                                onClick={toggleFavorite}
                                style={{ cursor: 'pointer', marginLeft: 10 }}
                            >
                                <Star
                                    size={20}
                                    fill={formData.isFavorite ? "#FAB005" : "none"}
                                    color={formData.isFavorite ? "#FAB005" : "#ced4da"}
                                />
                            </div>
                        )}
                    </div>
                    <div className={styles.panelContent}>
                        {/* Row 1: Name, Manager */}
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>이름</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>담당자</div>
                                <div className={styles.inputWrapper}>
                                    <select
                                        className={styles.select}
                                        value={getSelectedManagerId() || ""}
                                        onChange={(e) => handleChange('managerId', e.target.value)}
                                    >
                                        <option value="">(선택)</option>
                                        {managers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Row: Gender, Department */}
                        <div className={styles.rowPair}>
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
                                <div className={styles.label}>부서 / 직급</div>
                                <div className={styles.inputWrapper} style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        className={styles.input}
                                        value={formData.department || ''}
                                        onChange={(e) => handleChange('department', e.target.value)}
                                        placeholder="부서"
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        className={styles.input}
                                        value={formData.position || ''}
                                        onChange={(e) => handleChange('position', e.target.value)}
                                        placeholder="직급"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Category (Select/Direct) */}
                        <div className={styles.formRow}>
                            <div className={styles.label}>분류</div>
                            <div className={styles.inputWrapper} style={{ display: 'flex', gap: 4 }}>
                                {isDirectCategory ? (
                                    <>
                                        <input
                                            className={styles.input}
                                            value={formData.category}
                                            onChange={(e) => handleChange('category', e.target.value)}
                                            placeholder="직접 입력"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsDirectCategory(false)}
                                            className={styles.iconBtn}
                                            style={{ border: '1px solid #ced4da', borderRadius: 4, width: 34, justifyContent: 'center' }}
                                            title="목록에서 선택"
                                        >
                                            <List size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <select
                                        className={styles.select}
                                        value={formData.category || ""}
                                        onChange={handleCategoryChange}
                                    >
                                        {categoryOptions.map((opt, i) => (
                                            <option key={i} value={opt}>{opt}</option>
                                        ))}
                                        <option value="__direct__">+ 직접 입력</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* Row 3: Company, Homepage */}
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>회사명</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.companyName} onChange={(e) => handleChange('companyName', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>홈페이지</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.homepage} onChange={(e) => handleChange('homepage', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className={styles.formRow}>
                            <div className={styles.label}>회사주소</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.companyAddress} onChange={(e) => handleChange('companyAddress', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>자택주소</div>
                            <div className={styles.inputWrapper}>
                                <input className={styles.input} value={formData.homeAddress} onChange={(e) => handleChange('homeAddress', e.target.value)} />
                            </div>
                        </div>

                        {/* Phones */}
                        <div className={styles.sectionHeader}>[연락처 정보]</div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>핸드폰</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} />
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
                                <div className={styles.label}>회사전화1</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.companyPhone1} onChange={(e) => handleChange('companyPhone1', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>회사전화2</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.companyPhone2} onChange={(e) => handleChange('companyPhone2', e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.rowPair}>
                            <div className={styles.formRow}>
                                <div className={styles.label}>팩스</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.fax} onChange={(e) => handleChange('fax', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.label}>자택전화</div>
                                <div className={styles.inputWrapper}>
                                    <input className={styles.input} value={formData.homePhone} onChange={(e) => handleChange('homePhone', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Memo */}
                        <div className={styles.sectionHeader}>[기타]</div>
                        <div className={styles.formRow}>
                            <div className={styles.label}>기타메모</div>
                            <div className={styles.inputWrapper}>
                                <textarea className={styles.textarea} style={{ height: 100 }} value={formData.memo} onChange={(e) => handleChange('memo', e.target.value)} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Right Panel: History & Promoted Items */}
                {/* Right Panel: History & Promoted Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden', minWidth: 0 }}>
                    {/* Work History */}
                    <div className={styles.panel} style={{ flex: 1 }}>
                        <div className={styles.panelHeaderBlue}>
                            <span>명함작업내역</span>
                            <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} onClick={() => {
                                setEditingHistoryIndex(null); // Clear edit state
                                setIsWorkModalOpen(true);
                            }}>+ 작업추가</button>
                        </div>
                        <div className={styles.panelContent} style={{ padding: 0, overflowX: 'auto' }}>
                            <table className={styles.historyTable} style={{ tableLayout: 'fixed', width: '100%', minWidth: '600px' }}>
                                <colgroup><col style={{ width: 40 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 50 }} /></colgroup>
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>날짜</th>
                                        <th>작업자</th>
                                        <th>관련물건</th>
                                        <th>내역</th>
                                        <th style={{ textAlign: 'center' }}>삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!formData.history || formData.history.length === 0) ? (
                                        <tr><td colSpan={6} style={{ padding: 20, color: '#868e96' }}>등록된 내역이 없습니다.</td></tr>
                                    ) : (
                                        formData.history.map((item: any, i) => (
                                            <tr key={i} onClick={() => {
                                                // Default: Edit
                                                setEditingHistoryIndex(i);
                                                setIsWorkModalOpen(true);
                                            }} style={{ cursor: 'pointer', backgroundColor: 'inherit' }}>
                                                <td>{i + 1}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.date}</td>
                                                <td>{item.manager || item.worker}</td>
                                                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={(e) => {
                                                    // Handling Link Click
                                                    if (item.targetId) {
                                                        e.stopPropagation();
                                                        setOpenedPropertyId(item.targetId);
                                                    } else {
                                                        e.stopPropagation(); // Do nothing (as requested)
                                                    }
                                                }}>
                                                    <span style={{
                                                        color: item.targetId ? '#228BE6' : 'inherit',
                                                        textDecoration: item.targetId ? 'underline' : 'none',
                                                        cursor: item.targetId ? 'pointer' : 'default',
                                                        fontWeight: item.targetId ? 500 : 400
                                                    }}>
                                                        {item.relatedItem || item.targetName || item.related || '-'}
                                                    </span>
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.content}>{item.content}</td>
                                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    <button className={styles.iconBtn} style={{ color: '#e03131', padding: 4 }} onClick={() => handleDeleteHistory(i)}>
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

                    {/* Promoted Items */}
                    <div className={styles.panel} style={{ flex: 1 }}>
                        <div className={styles.panelHeaderBlue}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <span>추진물건</span>
                                <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} onClick={handleAddPromotedProperty}>+ 점포</button>
                                <button
                                    className={`${styles.headerBtn} ${styles.headerBtnPrimary} ${styles.mobileHidden}`}
                                    onClick={handleSync}
                                    title="DB 동기화"
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                                >
                                    <RefreshCw size={12} /> DB연동
                                </button>
                            </div>
                            <button className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} style={{ color: '#e03131' }} onClick={handleDeletePromotedProperties}>
                                - 제거
                            </button>
                        </div>
                        <div className={styles.panelContent} style={{ padding: 0, overflowX: 'auto' }}>
                            <table className={styles.historyTable} style={{ tableLayout: 'fixed', width: '100%', minWidth: '600px' }}>
                                <colgroup><col style={{ width: 40 }} /><col style={{ width: 40 }} /><col style={{ width: 90 }} /><col style={{ width: 120 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col /></colgroup>
                                <thead>
                                    <tr>
                                        <th style={{ whiteSpace: 'nowrap' }}>선택</th>
                                        <th>No</th>
                                        <th>날짜</th>
                                        <th>물건명</th>
                                        <th>업종</th>
                                        <th>금액</th>
                                        <th>주소</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!formData.promotedProperties || formData.promotedProperties.length === 0) ? (
                                        <tr><td colSpan={7} style={{ padding: 20, color: '#868e96' }}>추진 중인 물건이 없습니다.</td></tr>
                                    ) : (
                                        formData.promotedProperties.map((item: any, i) => (
                                            <tr key={item.id} style={{ cursor: 'default', backgroundColor: 'inherit' }}>
                                                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPromotedIds.includes(item.id)}
                                                        onChange={(e) => handleTogglePromotedSelect(item.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td>{i + 1}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.addedDate || item.date || '-'}</td>
                                                {/* Name: Clickable if Linked */}
                                                <td
                                                    style={{
                                                        color: item.propertyId ? '#228BE6' : 'inherit',
                                                        textDecoration: item.propertyId ? 'underline' : 'none',
                                                        cursor: item.propertyId ? 'pointer' : 'default', // Or 'pointer' if we add Link action later
                                                        fontWeight: item.propertyId ? 500 : 400
                                                    }}
                                                    onClick={(e) => {
                                                        if (item.propertyId) {
                                                            e.stopPropagation();
                                                            setOpenedPropertyId(item.propertyId);
                                                        } else {
                                                            e.stopPropagation();
                                                            setLinkingPromotedItem({ id: item.id, name: item.itemName || item.name || '' });
                                                            setIsPropertySelectorOpen(true);
                                                        }
                                                    }}
                                                >
                                                    {item.itemName || item.name || '-'}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.industrySector || item.type}</td>
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.amount || '-'}
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
                {/* Navigation Buttons - Top on Mobile */}
                {onNavigate && (
                    <div className={styles.footerNav}>
                        <button
                            className={styles.footerBtn}
                            onClick={() => onNavigate('first')}
                            disabled={!canNavigate?.first}
                            title="처음"
                            style={{ padding: '6px', flex: '0 0 auto', width: 'auto' }}
                        >
                            <ChevronsLeft size={18} />
                        </button>
                        <button
                            className={styles.footerBtn}
                            onClick={() => onNavigate('prev')}
                            disabled={!canNavigate?.prev}
                            title="이전"
                            style={{ padding: '6px', flex: '0 0 auto', width: 'auto' }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            className={styles.footerBtn}
                            onClick={() => onNavigate('next')}
                            disabled={!canNavigate?.next}
                            title="다음"
                            style={{ padding: '6px', flex: '0 0 auto', width: 'auto' }}
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            className={styles.footerBtn}
                            onClick={() => onNavigate('last')}
                            disabled={!canNavigate?.last}
                            title="마지막"
                            style={{ padding: '6px', flex: '0 0 auto', width: 'auto' }}
                        >
                            <ChevronsRight size={18} />
                        </button>
                    </div>
                )}

                {/* Action Buttons - Bottom on Mobile */}
                <div className={styles.footerActions} style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button className={styles.footerBtn} onClick={handleSave} disabled={loading}>
                        <Save size={16} /> 저장
                    </button>
                    {id && (
                        <button className={styles.footerBtn} onClick={handleDelete} disabled={loading}>
                            <Trash2 size={16} /> 삭제
                        </button>
                    )}
                    <button className={styles.footerBtn} onClick={handleReset}>
                        <Plus size={16} /> 신규
                    </button>
                    <button className={styles.footerBtn} onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>

            {/* Modals */}
            <WorkHistoryModal
                isOpen={isWorkModalOpen}
                onClose={() => {
                    setIsWorkModalOpen(false);
                    setEditingHistoryIndex(null);
                }}
                onSave={handleSaveWorkHistory}
                initialData={editingHistoryIndex !== null ? formData.history[editingHistoryIndex] : null}
            />

            <PropertySelector
                isOpen={isPropertySelectorOpen}
                onClose={() => {
                    setIsPropertySelectorOpen(false);
                    setLinkingPromotedItem(null);
                }}
                onSelect={handleSelectProperty}
                onOpenCard={(id) => setOpenedPropertyId(id)}
            />

            {
                openedPropertyId && openedPropertyData && (
                    <div className={styles.modalOverlay} style={{ zIndex: 3100 }} onClick={() => setOpenedPropertyId(null)}>
                        <div className={styles.modalContent} style={{ width: '90%', maxWidth: '1400px', height: '90vh', padding: 0 }} onClick={e => e.stopPropagation()}>
                            <PropertyCard
                                property={openedPropertyData}
                                onClose={() => setOpenedPropertyId(null)}
                                onRefresh={() => { }}
                            />
                        </div>
                    </div>
                )
            }

            {
                openedPropertyId && !openedPropertyData && (
                    <div className={styles.modalOverlay} style={{ zIndex: 3100 }}>
                        <div style={{ color: 'white' }}>로딩중...</div>
                    </div>
                )
            }

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
            />
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                type={alertConfig.type}
            />
        </div >
    );
}
