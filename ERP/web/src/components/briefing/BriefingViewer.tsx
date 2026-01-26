'use client';

import { useState } from 'react';
import { InvestmentCalculator } from './InvestmentCalculator';
import { LocationOverlay } from './LocationOverlay';
// import { RevenueChart } from './RevenueChart'; // To be implemented
import { BriefingHeader } from './BriefingHeader';
import { BriefingFooter } from './BriefingFooter';
import { useKakaoLoader } from 'react-kakao-maps-sdk';

interface BriefingViewerProps {
    data: any;
    token: string;
}

export function BriefingViewer({ data, token }: BriefingViewerProps) {
    const { property, options, consultant } = data;

    useKakaoLoader({
        appkey: "26c1197bae99e17f8c1f3e688e22914d", // Correct key from map page
        libraries: ["clusterer", "drawing", "services"],
    });

    // Calculate key metrics for top summary
    const revenue = parseInt(property.data?.monthlyRevenue || 0);
    const materialCost = revenue * (property.data?.materialCostPercent || 0) / 100;
    const labor = parseInt(property.data?.laborCost || 0);
    const rent = parseInt(property.data?.rentMaintenance || 0);
    const other = (parseInt(property.data?.taxUtilities || 0) + parseInt(property.data?.maintenance || 0) + parseInt(property.data?.otherExpenses || 0));

    const netIncomeEst = revenue - (rent + labor + materialCost + other);

    // Format helpers
    const fmt = (n: number) => n?.toLocaleString();

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
            <BriefingHeader property={property} />

            <main className="max-w-md mx-auto px-4 -mt-6 relative z-10 space-y-6">

                {/* Key Metrics Grid */}
                <section className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="text-xs text-slate-500 font-bold mb-1">예상 월 매출</div>
                        <div className="text-xl font-extrabold text-indigo-600">{fmt(revenue)}만원</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="text-xs text-slate-500 font-bold mb-1">예상 순수익</div>
                        <div className="text-xl font-extrabold text-emerald-600">{fmt(Math.floor(netIncomeEst))}만원</div>
                    </div>
                </section>

                {/* Investment Analysis */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            💰 투자금 분석
                        </h2>
                        {options.price_mode === 'exclude' && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-bold">
                                브리핑가 제외됨
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">부동산 비용 (보증금+권리금)</span>
                            <span className="font-semibold text-slate-900">
                                {fmt(property.price)} 만원
                            </span>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-base font-bold text-slate-700">총 예상 창업비용</span>
                            <span className="text-xl font-extrabold text-indigo-700">{fmt(property.price)} <span className="text-sm font-normal text-slate-500">만원</span></span>
                        </div>
                    </div>
                </section>

                {/* Calculator */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <InvestmentCalculator property={property} />
                </section>

                {/* Expert Comment (Placeholder) */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold mb-3 text-slate-800">전문가 한줄평</h2>
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-600 text-sm leading-relaxed italic border-l-4 border-indigo-500">
                        "안정적인 매출 기반과 합리적인 권리금으로 빠른 투자금 회수가 기대되는 매물입니다. 특히 주변 상권의 유동인구가 꾸준하여 지속적인 성장이 예상됩니다."
                    </div>
                </section>

                {/* Map */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 overflow-hidden">
                    <h2 className="text-lg font-bold mb-4 text-slate-800">위치 정보</h2>
                    <div className="h-56 bg-slate-100 rounded-xl relative overflow-hidden ring-1 ring-slate-200">
                        <LocationOverlay
                            address={property.address}
                            lat={property.data?.lat}
                            lng={property.data?.lng}
                            showDetail={!options.hide_address}
                        />
                    </div>
                    {/* Neighborhood Info (Static for now) */}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                        <div className="p-2 bg-slate-50 rounded-lg"><div className="font-bold text-slate-700 text-sm mb-1">500m</div>지하철</div>
                        <div className="p-2 bg-slate-50 rounded-lg"><div className="font-bold text-slate-700 text-sm mb-1">많음</div>유동</div>
                        <div className="p-2 bg-slate-50 rounded-lg"><div className="font-bold text-slate-700 text-sm mb-1">안전</div>치안</div>
                    </div>
                </section>

                {/* Disclaimer */}
                <section className="text-xs text-slate-400 text-center px-4 leading-normal">
                    <p className="mb-2">※ 본 자료는 정보 제공을 목적으로 작성되었으며, 실제 운영 결과는 경영 방식 및 시장 상황에 따라 달라질 수 있습니다.</p>
                    <p>문의사항은 하단 담당자에게 연락 바랍니다.</p>
                </section>

            </main>

            <BriefingFooter consultant={consultant} />
        </div>
    );
}
