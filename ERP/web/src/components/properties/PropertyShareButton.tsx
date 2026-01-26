'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareConfigModal } from '../briefing/ShareConfigModal';

interface PropertyShareButtonProps {
    propertyId: string;
    className?: string;
    variant?: 'icon' | 'text';
}

export function PropertyShareButton({ propertyId, className, variant = 'icon' }: PropertyShareButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
                title="시크릿 브리핑 공유"
            >
                <Share2 size={18} className="text-gray-600" />
                {variant === 'text' && <span className="text-sm font-medium text-gray-700">공유</span>}
            </button>

            {isModalOpen && (
                <ShareConfigModal
                    propertyId={propertyId}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
}
