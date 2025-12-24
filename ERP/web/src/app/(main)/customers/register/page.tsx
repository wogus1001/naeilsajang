"use client";

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CustomerCard from '@/components/customers/CustomerCard';

function CustomerRegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const handleClose = () => {
        router.back();
    };

    const handleSuccess = () => {
        router.push('/customers');
    };

    return (
        <CustomerCard
            id={id}
            onClose={handleClose}
            onSuccess={handleSuccess}
        />
    );
}

export default function CustomerRegisterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomerRegisterContent />
        </Suspense>
    );
}
