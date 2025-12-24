"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map, MapMarker, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import { X, Star } from 'lucide-react';
import styles from './page.module.css';

interface Property {
    id: string;
    name: string;
    address: string;
    status: string; // Used for Grade
    type: string; // Category Major
    // typeDetail?: string; // Category Minor (if available)
    floor: string;
    area: string;
    deposit: number; // 보증금
    monthlyRent: number; // 임대료 (월세)
    premium: number; // 권리금
    coordinates?: {
        lat: number;
        lng: number;
    };
    photos?: string[];
    isFavorite?: boolean; // For Favorites (Fixed from isImportant)
}

const STATUS_OPTIONS = [
    { value: 'progress', label: '추진', class: styles.badgeProgress, key: 'progress' },
    { value: 'manage', label: '관리', class: styles.badgeManage, key: 'manage' },
    { value: 'hold', label: '보류', class: styles.badgeHold, key: 'hold' },
    { value: 'common', label: '공동', class: styles.badgeCommon, key: 'common' }, // Handles both common/joint logic
    { value: 'complete', label: '완료', class: styles.badgeComplete, key: 'complete' },
];

export default function PropertyMapPage() {
    const router = useRouter();
    const [properties, setProperties] = useState<Property[]>([]);
    const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filter State
    const [showFavorites, setShowFavorites] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['progress', 'manage', 'hold', 'common', 'complete']));

    // New Advanced Filters
    const [areaRange, setAreaRange] = useState({ min: '', max: '' });
    const [priceRange, setPriceRange] = useState({ min: '', max: '' }); // Total Price (P+D)
    const [rentRange, setRentRange] = useState({ min: '', max: '' });

    useKakaoLoader({
        appkey: "26c1197bae99e17f8c1f3e688e22914d",
        libraries: ["clusterer", "drawing", "services"],
    });

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                const userStr = localStorage.getItem('user');
                let query = '';
                if (userStr) {
                    const user = JSON.parse(userStr);
                    if (user.companyName) {
                        query = `?company=${encodeURIComponent(user.companyName)}`;
                    }
                }

                const res = await fetch(`/api/properties${query}`);
                if (res.ok) {
                    const data = await res.json();
                    setProperties(data);
                }
            } catch (error) {
                console.error('Failed to fetch properties:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProperties();
    }, []);

    const activeProperty = properties.find(p => p.id === activeOverlayId);

    // Grade Helper
    const getGradeInfo = (status: string) => {
        // Map status to visual grade using project colors
        switch (status) {
            case 'progress': return { text: '추진', class: styles.statusProgress };
            case 'manage': return { text: '관리', class: styles.statusManage };
            case 'hold': return { text: '보류', class: styles.statusHold };
            case 'common':
            case 'joint': return { text: '공동', class: styles.statusCommon }; // Handle both
            case 'complete': return { text: '완료', class: styles.statusComplete };
            default: return { text: status || '미정', class: styles.statusDefault };
        }
    };

    // Marker Image Helper
    const getMarkerImage = (status: string) => {
        let color = '#868e96'; // Default Gray
        switch (status) {
            case 'progress': color = '#FA5252'; break; // Red
            case 'manage': color = '#007AFF'; break; // Blue
            case 'hold': color = '#FAB005'; break; // Yellow
            case 'common':
            case 'joint': color = '#BE4BDB'; break; // Purple
            case 'complete': color = '#40C057'; break; // Green
        }

        // SVG Marker Pin
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle fill="white" cx="12" cy="9" r="2.5"/>
            </svg>
        `;

        return {
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
            size: { width: 36, height: 36 },
            options: { offset: { x: 18, y: 36 } }
        };
    };

    const handleOverlayClick = (e: React.MouseEvent, id: string) => {
        // Stop all propagation to prevent map click
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        router.push(`/properties/${id}`);
    };

    const toggleStatus = (statusKey: string) => {
        const newSet = new Set(selectedStatuses);
        if (newSet.has(statusKey)) {
            newSet.delete(statusKey);
        } else {
            newSet.add(statusKey);
        }
        setSelectedStatuses(newSet);
    };

    // Filter Logic
    const filteredProperties = properties.filter(p => {
        // 1. Favorites Filter
        if (showFavorites && !p.isFavorite) return false;

        // 2. Status Filter
        // Normalize 'joint' to 'common' for filtering
        const normalizedStatus = p.status === 'joint' ? 'common' : p.status;
        if (!selectedStatuses.has(normalizedStatus)) return false;

        // 3. Area Filter
        // Use parseFloat to handle strings like "30평" -> 30
        const area = parseFloat(String(p.area).replace(/,/g, ''));
        if (areaRange.min || areaRange.max) {
            if (isNaN(area)) return false;
            if (areaRange.min && !isNaN(Number(areaRange.min)) && area < Number(areaRange.min)) return false;
            if (areaRange.max && !isNaN(Number(areaRange.max)) && area > Number(areaRange.max)) return false;
        }

        // 4. Total Price (Sum) Filter
        const totalSum = (p.deposit || 0) + (p.premium || 0);
        if (priceRange.min || priceRange.max) {
            // totalSum is number, so just checks
            if (priceRange.min && !isNaN(Number(priceRange.min)) && totalSum < Number(priceRange.min)) return false;
            if (priceRange.max && !isNaN(Number(priceRange.max)) && totalSum > Number(priceRange.max)) return false;
        }

        // 5. Rent Filter
        const rent = parseFloat(String(p.monthlyRent).replace(/,/g, '')) || 0;
        if (rentRange.min || rentRange.max) {
            // rent can be 0, which is valid. But if filtering?
            if (rentRange.min && !isNaN(Number(rentRange.min)) && rent < Number(rentRange.min)) return false;
            if (rentRange.max && !isNaN(Number(rentRange.max)) && rent > Number(rentRange.max)) return false;
        }

        return true;
    });

    return (
        <div className={styles.container}>
            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterItem} style={{ cursor: 'pointer' }}>
                        <Star className={styles.starIcon} size={20} fill={showFavorites ? "#FAB005" : "none"} color={showFavorites ? "#FAB005" : "#AAA"} />
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={showFavorites}
                            onChange={(e) => setShowFavorites(e.target.checked)}
                        />
                        <span>관심물건</span>
                    </label>
                </div>

                <div className={styles.filterGroup}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', marginRight: '8px' }}>등급 :</span>
                    {STATUS_OPTIONS.map((status) => (
                        <label key={status.key} className={styles.filterItem}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={selectedStatuses.has(status.key)}
                                onChange={() => toggleStatus(status.key)}
                            />
                            <div className={`${styles.filterBadge} ${status.class}`}>
                                {status.label}
                            </div>
                        </label>
                    ))}
                </div>

                {/* Advanced Filters: Area */}
                <div className={styles.filterGroup} style={{ gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>면적(평) :</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Min"
                        value={areaRange.min}
                        onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                    />
                    <span className={styles.filterSeparator}>~</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Max"
                        value={areaRange.max}
                        onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                    />
                </div>

                {/* Advanced Filters: Total Price */}
                <div className={styles.filterGroup} style={{ gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>합계(만원) :</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Min"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    />
                    <span className={styles.filterSeparator}>~</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Max"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    />
                </div>

                {/* Advanced Filters: Rent */}
                <div className={styles.filterGroup} style={{ gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>임대료(만원) :</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Min"
                        value={rentRange.min}
                        onChange={(e) => setRentRange({ ...rentRange, min: e.target.value })}
                    />
                    <span className={styles.filterSeparator}>~</span>
                    <input
                        className={styles.filterInput}
                        placeholder="Max"
                        value={rentRange.max}
                        onChange={(e) => setRentRange({ ...rentRange, max: e.target.value })}
                    />
                </div>
            </div>

            <Map
                center={{ lat: 37.566826, lng: 126.9786567 }}
                style={{ width: "100%", height: "100%" }}
                level={7}
                onClick={(target, mouseEvent) => {
                    if (activeOverlayId) {
                        setActiveOverlayId(null);
                    }
                }}
            >
                {filteredProperties.map((property) => (
                    property.coordinates && (
                        <MapMarker
                            key={property.id}
                            position={{ lat: property.coordinates.lat, lng: property.coordinates.lng }}
                            image={getMarkerImage(property.status)}
                            onClick={(marker) => {
                                // Prevent map click from firing
                                setActiveOverlayId(property.id);
                            }}
                        />
                    )
                ))}

                {activeProperty && activeProperty.coordinates && (
                    <CustomOverlayMap
                        position={{ lat: activeProperty.coordinates.lat, lng: activeProperty.coordinates.lng }}
                        yAnchor={1.15} // Adjusted anchor
                        zIndex={1000} // High Z-Index
                        clickable={true}
                    >
                        <div
                            className={styles.overlayWrap}
                            onClick={(e) => handleOverlayClick(e, activeProperty.id)}
                            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        >
                            <div className={styles.overlayHeader}>
                                <div className={styles.headerLeft}>
                                    <div className={`${styles.gradeIcon} ${getGradeInfo(activeProperty.status).class}`}>
                                        {getGradeInfo(activeProperty.status).text}
                                    </div>
                                    <div className={styles.propertyTitle} title={activeProperty.name}>
                                        {activeProperty.name}
                                    </div>
                                </div>
                                <button
                                    className={styles.closeBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        setActiveOverlayId(null);
                                    }}
                                    title="닫기"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className={styles.overlayContent}>
                                <div className={styles.addressRow}>
                                    {activeProperty.address}
                                </div>
                                <div className={styles.categoryRow}>
                                    {activeProperty.type}
                                </div>

                                <div className={styles.priceRow}>
                                    <span className={styles.priceLabel}>면적</span>
                                    <span className={styles.priceValue}>{activeProperty.area}평</span>
                                </div>
                                <div className={styles.priceRow}>
                                    <span className={styles.priceLabel}>권리금</span>
                                    <span className={styles.priceValue}>{activeProperty.premium ? activeProperty.premium.toLocaleString() + '만원' : '-'}</span>
                                </div>
                                <div className={styles.priceRow}>
                                    <span className={styles.priceLabel}>보증금</span>
                                    <span className={styles.priceValue}>{activeProperty.deposit ? activeProperty.deposit.toLocaleString() + '만원' : '-'}</span>
                                </div>
                                <div className={styles.priceRow}>
                                    <span className={styles.priceLabel}>임대료</span>
                                    <span className={styles.priceValue}>{activeProperty.monthlyRent ? activeProperty.monthlyRent.toLocaleString() + '만원' : '-'}</span>
                                </div>
                                <div className={styles.priceTotal}>
                                    <span>합계</span>
                                    <span>{((activeProperty.premium || 0) + (activeProperty.deposit || 0)).toLocaleString()} 만원</span>
                                </div>
                            </div>
                        </div>
                    </CustomOverlayMap>
                )}
            </Map>
        </div>
    );
}
