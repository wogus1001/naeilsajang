"use client";

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BusinessCard from '@/components/business/BusinessCard';
import styles from '@/app/(main)/customers/register/page.module.css'; // Reusing styles

function RegisterContent() {
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

export default function BusinessCardRegisterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RegisterContent />
        </Suspense>
    );
}
