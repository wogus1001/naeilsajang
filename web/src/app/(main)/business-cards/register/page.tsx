"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BusinessCard from '@/components/business/BusinessCard';
import styles from '@/app/(main)/customers/register/page.module.css'; // Reusing styles

export default function BusinessCardRegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') ?? undefined;

    return (
        <div className={styles.container}>
            <BusinessCard
                id={id}
                onClose={() => router.back()}
                onSuccess={() => router.push('/business-cards')}
            />
        </div>
    );
}
