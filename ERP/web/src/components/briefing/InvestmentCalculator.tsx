'use client';

import { useState, useEffect } from 'react';

export function InvestmentCalculator({ property }: { property: any }) {
    // Data keys are camelCase from frontend/PropertyCard logic
    const data = property.data || {};
    const revenue = data.monthlyRevenue || 0;

    // Default assumptions if not provided
    // Fix: Allow 0% material cost if explicitly set
    const initialMaterial = data.materialCostPercent !== undefined ? Number(data.materialCostPercent) : 30;
    const [materialCostPct, setMaterialCostPct] = useState(initialMaterial);

    const [laborCost, setLaborCost] = useState(data.laborCost || 0);
    const [rent, setRent] = useState(data.rentMaintenance || 0);

    // Sum of other fixed expenses (Tax + Maintenance + Other)
    const initialOther = (Number(data.taxUtilities) || 0) + (Number(data.maintenance) || 0) + (Number(data.otherExpenses) || 0);
    const [otherCost, setOtherCost] = useState(initialOther);

    // Total Investment: property.price (Briefing Price) OR sum(deposit + premium)
    // If property.price is set (Briefing Price), we use it. 
    // Otherwise fallback to deposit + premium if available.
    // Note: page.tsx forces `price` to be BriefingPrice if option selected.
    const deposit = data.deposit || 0;
    const premium = data.premium || 0;
    const realTotal = deposit + premium;
    const briefingPrice = property.price || 0;

    // Logic: Use provided price (masked) if > 0, else realTotal.
    // However, if user viewed "Briefing Price", property.price IS the briefing price.
    const totalInvestment = briefingPrice > 0 ? briefingPrice : realTotal;

    const [netIncome, setNetIncome] = useState(0);
    const [roi, setRoi] = useState(0);

    useEffect(() => {
        // Simple Logic: Net = Rev - (Rent + Labor + Material + etc)
        // Material = Rev * %
        const materialCost = revenue * (materialCostPct / 100);
        // Note: property.data may be string or number, ensure parsing
        const revNum = Number(revenue);
        const rentNum = Number(rent);
        const laborNum = Number(laborCost);
        const otherNum = Number(otherCost);

        const expenses = rentNum + laborNum + materialCost + otherNum;
        const net = revNum - expenses;

        setNetIncome(net);

        // ROI = (Net * 12) / TotalInvestment * 100
        const totalInv = Number(totalInvestment || 10000); // default 100kk if missing
        if (totalInv > 0) {
            setRoi(((net * 12) / totalInv) * 100);
        }
    }, [revenue, materialCostPct, laborCost, rent, otherCost, totalInvestment]);

    // Format helpers
    const fmt = (n: number) => n?.toLocaleString();

    return (

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-4 border-b flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <h3 className="font-bold text-lg text-slate-800">수익률 시뮬레이터</h3>
            </div>

            <div className="bg-[#0f172a] p-6 text-white text-center">
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                        <div className="text-slate-400 text-xs mb-1">예상 월 순수익</div>
                        <div className="text-3xl font-bold text-[#10b981]">
                            {fmt(Math.round(netIncome))}
                            <span className="text-lg font-normal text-white ml-0.5">만원</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs mb-1">연 수익률 (ROI)</div>
                        <div className="text-3xl font-bold">
                            {roi.toFixed(1)}
                            <span className="text-lg font-normal text-slate-400 ml-0.5">%</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 bg-white/10 rounded-lg p-2 px-3">
                    <span>기준 투자금 (보증금+권리금)</span>
                    <span className="text-white font-bold">{fmt(totalInvestment)} 만원</span>
                </div>

                {/* Visual Bar */}
                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex mb-2">
                    <div style={{ width: `${materialCostPct}%` }} className="h-full bg-slate-500" />
                    <div style={{ width: '20%' }} className="h-full bg-slate-400" /> {/* Rent proxy */}
                    <div style={{ width: `${100 - materialCostPct - 20}%` }} className="h-full bg-emerald-500" /> {/* Profit proxy */}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                    <span>비용 (재료/인건비 등)</span>
                    <span>순수익</span>
                </div>
            </div>

            {/* Sliders Area */}
            <div className="p-6 bg-slate-50 space-y-6">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-slate-600 text-sm font-bold">재료비 비율</label>
                        <span className="font-bold text-indigo-600">{materialCostPct}%</span>
                    </div>
                    <input
                        type="range"
                        min="10" max="60" step="1"
                        value={materialCostPct}
                        onChange={(e) => setMaterialCostPct(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-slate-600 text-sm font-bold">월 인건비</label>
                        <span className="font-bold text-indigo-600">{laborCost} 만원</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1500" step="10"
                        value={laborCost}
                        onChange={(e) => setLaborCost(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-slate-600 text-sm font-bold">월 임대료+관리비</label>
                        <span className="font-bold text-indigo-600">{rent} 만원</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1500" step="10"
                        value={rent}
                        onChange={(e) => setRent(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-slate-600 text-sm font-bold">기타 운영비 (공과금/유지보수 등)</label>
                        <span className="font-bold text-indigo-600">{otherCost} 만원</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1000" step="5"
                        value={otherCost}
                        onChange={(e) => setOtherCost(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>
            </div>
        </div>
    );

}
