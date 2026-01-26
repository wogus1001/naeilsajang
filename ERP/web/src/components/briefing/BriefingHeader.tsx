'use client';

import { MapPin, ShieldCheck, Star } from 'lucide-react';

export function BriefingHeader({ property }: { property: any }) {
    const imageUrl = property.data?.photos?.[0] || property.data?.images?.[0] || 'https://via.placeholder.com/800x600?text=No+Image';

    return (
        <div className="relative h-80 w-full bg-slate-900">
            <img
                src={imageUrl}
                alt="Property Hero"
                className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent flex items-end">
                <div className="p-6 w-full text-white pb-8">
                    <div className="flex gap-2 mb-3">
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-sm rounded-full text-xs font-bold text-white shadow-sm">
                            <ShieldCheck size={12} />
                            검증된 매물
                        </span>
                        <span className="px-2.5 py-1 bg-indigo-500/90 backdrop-blur-sm rounded-full text-xs font-bold text-white shadow-sm">
                            {property.operation_type || '운영형태 미정'}
                        </span>
                    </div>

                    <h1 className="text-3xl font-extrabold leading-tight mb-2 text-white drop-shadow-md">
                        {property.name || '프리미엄 매물'}
                    </h1>

                    <div className="flex items-center text-slate-300 text-sm font-medium">
                        <MapPin size={16} className="mr-1.5 text-emerald-400" />
                        {property.masked_address}
                    </div>
                </div>
            </div>
        </div>
    );
}
