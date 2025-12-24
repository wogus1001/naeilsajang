import React, { useState, useRef, useEffect } from 'react';
import { Printer, Check, ChevronDown, Layout, FileText, PieChart, ArrowLeft, Star } from 'lucide-react';
import PropertyReportPrint from './reports/PropertyReportPrint';

interface PropertyReportTabProps {
    data: any;
    onChange?: (field: string, value: any) => void;
    onSave?: () => void;
    initialDirectPreview?: number;
}

interface FormatOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    isDisabled?: boolean;
}

const PropertyReportTab: React.FC<PropertyReportTabProps> = ({ data, onChange, onSave, initialDirectPreview }) => {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState('1');
    const [favoriteFormatId, setFavoriteFormatId] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false); // Local saving state for feedback

    // Helper to get user-specific favorite key
    const getFavoriteKey = () => {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        let userId = 'default';
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                userId = (u.user || u).id || (u.user || u).userId || (u.user || u).name || 'default';
            } catch (e) {
                console.error('Failed to parse user for favorite key', e);
            }
        }
        return `favorite_report_format_${userId}`;
    };

    // Initialize favorite and check for direct preview
    useEffect(() => {
        const favId = localStorage.getItem(getFavoriteKey());
        if (favId) {
            setFavoriteFormatId(favId);
            if (initialDirectPreview && initialDirectPreview > 0) {
                setSelectedFormat(favId);
                setIsPreviewOpen(true);
            }
        }
    }, [initialDirectPreview]);

    const formatOptions: FormatOption[] = [
        { id: '1', label: '인쇄형식 1', description: '상세형', icon: <Layout size={24} /> },
        { id: '2', label: '인쇄형식 2', description: '요약형', icon: <FileText size={24} /> },
        { id: '3', label: '인쇄형식 3', description: '제안형(지도포함)', icon: <FileText size={24} /> },
        { id: '4', label: '인쇄형식 4', description: '요약형(메모)', icon: <Layout size={24} /> },
        { id: '5', label: '인쇄형식 5', description: '종합형(차트/지도)', icon: <Layout size={24} /> },
        { id: '6', label: '인쇄형식 6', description: '종합형(이미지/차트)', icon: <Layout size={24} /> },
        { id: '7', label: '인쇄형식 7', description: '매출분석형(차트/그래프)', icon: <Layout size={24} /> },

    ];

    const handleFormatClick = (id: string) => {
        setSelectedFormat(id);
        setIsPreviewOpen(true);
    };

    const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Don't trigger format click
        if (favoriteFormatId === id) {
            setFavoriteFormatId(null);
            localStorage.removeItem(getFavoriteKey());
        } else {
            setFavoriteFormatId(id);
            localStorage.setItem(getFavoriteKey(), id);
        }
    };

    const handleClosePreview = () => {
        setIsPreviewOpen(false);
    };

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 100);
    };

    const handleSaveReport = async () => {
        if (onSave) {
            setIsSaving(true);
            await onSave();
            setTimeout(() => {
                setIsSaving(false);
                alert('저장되었습니다.');
            }, 500);
        }
    };

    // Global print styles to hide everything except the report
    const globalPrintStyle = `
        @media print {
            body * {
                visibility: hidden;
            }
            #property-report-print-area, #property-report-print-area * {
                visibility: visible;
            }
            #property-report-print-area {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100vw !important;
                min-height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                background-color: white !important;
                z-index: 2147483647 !important;
            }
            
            @page {
                size: A4;
                margin: 0;
            }

            html, body {
                width: 100%;
                height: 100%;
                overflow: visible;
                margin: 0;
                padding: 0;
            }
        }
    `;

    return (
        <div style={{ height: '100%', padding: '30px', backgroundColor: '#f8f9fa', overflowY: 'auto' }}>
            <style>{globalPrintStyle}</style>

            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>인쇄 형식 선택</h2>
                <p style={{ fontSize: '13px', color: '#e03131', margin: 0 }}>
                    * 지도가 잘리는 경우 해당창을 닫고 새로고침 후 다시 열어주세요.
                </p>
            </div>

            {/* Consulting Report Input */}


            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '20px' // Reduced space at bottom
            }}>
                {formatOptions.map(option => (
                    <div
                        key={option.id}
                        onClick={() => handleFormatClick(option.id)}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #dee2e6',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            height: '110px',
                            position: 'relative'
                        }}
                        className="report-format-card"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)';
                            e.currentTarget.style.borderColor = '#339af0';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                            e.currentTarget.style.borderColor = '#dee2e6';
                        }}
                    >
                        <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                            <button
                                onClick={(e) => handleToggleFavorite(e, option.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    color: favoriteFormatId === option.id ? '#fab005' : '#dee2e6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s'
                                }}
                                title={favoriteFormatId === option.id ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                            >
                                <Star size={18} fill={favoriteFormatId === option.id ? '#fab005' : 'none'} />
                            </button>
                        </div>
                        <div style={{ marginBottom: '8px', color: '#339af0' }}>
                            {option.icon}
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#333' }}>
                            {option.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#868e96', textAlign: 'center', lineHeight: '1.2' }}>
                            {option.description}
                        </div>
                    </div>
                ))}
            </div>

            {/* Consulting Report Input (Moved to Bottom) */}
            <div style={{ marginBottom: '50px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <FileText size={18} color="#339af0" />
                        컨설팅 제안서 작성

                    </h3>
                    <button
                        onClick={handleSaveReport}
                        disabled={isSaving}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: isSaving ? '#adb5bd' : '#20c997', // Green for Save
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isSaving ? 'default' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        <Check size={14} />
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
                <textarea
                    value={data.consultingReport || ''}
                    onChange={(e) => onChange && onChange('consultingReport', e.target.value)}
                    placeholder="매물에 대한 상세 분석, 추천 사유, 향후 전망 등 고객님께 제안할 내용을 작성해주세요."
                    style={{
                        width: '100%',
                        height: '150px',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#339af0'}
                    onBlur={(e) => e.target.style.borderColor = '#ced4da'}
                />
            </div>
            <div style={{ fontSize: '12px', color: '#868e96', marginTop: '-40px', marginBottom: '50px', marginLeft: '20px' }}>
                * 이 내용은 [인쇄형식 6: 종합형] 하단에 출력됩니다.
            </div>


            {/* Full Screen Modal Preview */}
            {
                isPreviewOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            height: '60px',
                            backgroundColor: 'white',
                            borderBottom: '1px solid #dee2e6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0 20px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                                미리보기: {formatOptions.find(f => f.id === selectedFormat)?.label}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={handlePrint}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 16px',
                                        backgroundColor: '#339af0',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px'
                                    }}
                                >
                                    <Printer size={16} />
                                    리포트 인쇄 / PDF 저장
                                </button>
                                <button
                                    onClick={handleClosePreview}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '36px',
                                        height: '36px',
                                        backgroundColor: '#f1f3f5',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        color: '#495057'
                                    }}
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (Preview Area) */}
                        <div style={{
                            flex: 1,
                            backgroundColor: '#525659', // Dark gray background like Chrome/PDF viewers
                            overflowY: 'auto',
                            padding: '40px',
                            display: 'flex',
                            justifyContent: 'center'
                        }} onClick={(e) => {
                            // Optional: Close on backdrop click if desired, but maybe safer not to for large forms
                            if (e.target === e.currentTarget) handleClosePreview();
                        }}>
                            <div
                                id="property-report-print-area"
                                ref={reportRef}
                                style={{
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                    backgroundColor: 'white',
                                    width: '210mm', // A4 Width
                                    minHeight: '297mm', // A4 Height
                                    boxSizing: 'border-box',
                                    transition: 'transform 0.2s'
                                }}
                                onClick={(e) => e.stopPropagation()} // Prevent close on report click
                            >
                                {(selectedFormat === '1' || selectedFormat === '2' || selectedFormat === '3' || selectedFormat === '4' || selectedFormat === '5' || selectedFormat === '6' || selectedFormat === '7') ? (
                                    <PropertyReportPrint data={data} format={selectedFormat} />
                                ) : (
                                    <div style={{ padding: '50px', textAlign: 'center', color: '#868e96' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '20px' }}>🚧</div>
                                        <h3 style={{ marginBottom: '10px' }}>{formatOptions.find(f => f.id === selectedFormat)?.label}</h3>
                                        <p>현재 준비 중인 인쇄 형식입니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PropertyReportTab;
