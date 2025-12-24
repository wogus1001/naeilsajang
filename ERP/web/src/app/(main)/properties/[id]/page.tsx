"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';

export default function PropertyDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [property, setProperty] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        async function fetchProperty() {
            try {
                // console.log('Fetching property with ID:', id);
                const res = await fetch(`/api/properties?id=${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setProperty(data);
                } else {
                    console.error('Property not found');
                }
            } catch (error) {
                console.error('Failed to fetch property:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchProperty();
    }, [id]);

    if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>;
    if (!property) return <div style={{ padding: 40, textAlign: 'center' }}>물건을 찾을 수 없습니다.</div>;

    return (
        <div style={{ padding: '10px 40px 40px', maxWidth: 1800, margin: '0 auto' }}>
            <button
                onClick={() => router.back()}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#495057'
                }}
            >
                <ArrowLeft size={20} />
                목록으로 돌아가기
            </button>

            <div style={{ height: 'calc(100vh - 120px)' }}>
                <PropertyCard
                    property={property}
                    onClose={() => router.back()}
                    onRefresh={() => {
                        // Optional: refresh logic if needed, or window.location.reload()
                        window.location.reload();
                    }}
                />
            </div>
        </div>
    );
}
