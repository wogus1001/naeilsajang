'use client';

import React from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = '확인',
    message,
    confirmText = '확인',
    cancelText = '취소',
    isDanger = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-4">
                    <HelpCircle className="h-6 w-6 text-indigo-600" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {title}
                </h3>

                <p className="text-gray-600 mb-8 whitespace-pre-wrap text-sm leading-relaxed">
                    {message}
                </p>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-3 text-white font-bold rounded-xl transition-colors shadow-md active:scale-[0.98] ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
