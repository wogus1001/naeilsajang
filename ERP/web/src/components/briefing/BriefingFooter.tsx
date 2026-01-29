'use client';
import React, { useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { AlertModal } from '@/components/common/AlertModal';

export function BriefingFooter({ consultant }: { consultant: any }) {
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info'; onClose?: () => void }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertConfig({ isOpen: true, message, type });
    };
    const closeAlert = () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    if (!consultant) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
            <div className="max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                        {/* Avatar */}
                        <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-800">{consultant.name || '담당 컨설턴트'} <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">Expert</span></div>
                        <div className="text-xs text-slate-500">상가 창업 전문 컨설턴트</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <a
                        href={`tel:${consultant.mobile}`}
                        className="flex justify-center items-center gap-2 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                    >
                        <Phone size={18} />
                        전화 상담
                    </a>
                    <a
                        href="#"
                        className="flex justify-center items-center gap-2 py-3 bg-[#FEE500] text-[#191919] font-bold rounded-xl hover:bg-[#FDD835] transition-colors shadow-lg shadow-yellow-100"
                        onClick={(e) => {
                            e.preventDefault();
                            showAlert('카카오톡 기능 준비중입니다.'); // Or deep link logic
                        }}
                    >
                        <MessageCircle size={18} fill="#191919" />
                        카카오톡
                    </a>
                </div>
            </div>
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                type={alertConfig.type}
            />
        </div>
    );
}
