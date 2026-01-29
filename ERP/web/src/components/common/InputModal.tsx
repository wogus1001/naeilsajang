'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title?: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
}

export function InputModal({
    isOpen,
    onClose,
    onConfirm,
    title = '입력',
    message,
    placeholder = '',
    defaultValue = ''
}: InputModalProps) {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
        }
    }, [isOpen, defaultValue]);

    const handleConfirm = () => {
        onConfirm(value);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {message && (
                    <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                        {message}
                    </p>
                )}

                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-6 text-sm"
                    autoFocus
                    onKeyDown={handleKeyDown}
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all active:scale-[0.98]"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        disabled={!value.trim()}
                    >
                        <Check size={18} />
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
