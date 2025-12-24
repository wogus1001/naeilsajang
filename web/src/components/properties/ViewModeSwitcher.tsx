import React from 'react';
import { LayoutTemplate, Sidebar, Maximize2, MoreHorizontal } from 'lucide-react';

export type ViewMode = 'center' | 'side' | 'page';

interface ViewModeSwitcherProps {
    currentMode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
}

export default function ViewModeSwitcher({ currentMode, onModeChange }: ViewModeSwitcherProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const modes = [
        { id: 'side', label: '사이드 보기', icon: Sidebar },
        { id: 'center', label: '중앙에서 보기', icon: LayoutTemplate },
        { id: 'page', label: '전체 페이지 보기', icon: Maximize2 },
    ];

    const currentLabel = modes.find(m => m.id === currentMode)?.label || '보기 설정';

    return (
        <div style={{ position: 'relative', zIndex: 2000 }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    borderRadius: 6,
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: '#333'
                }}
            >
                <MoreHorizontal size={16} />
                <span>{currentLabel}</span>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    backgroundColor: '#fff',
                    border: '1px solid #dee2e6',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 2001,
                    minWidth: 160,
                    padding: 4
                }}>
                    {modes.map(mode => {
                        const Icon = mode.icon;
                        const isSelected = currentMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => {
                                    onModeChange(mode.id as ViewMode);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: 'none',
                                    backgroundColor: isSelected ? '#e7f5ff' : 'transparent',
                                    color: isSelected ? '#1971c2' : '#495057',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: 13,
                                    borderRadius: 4
                                }}
                            >
                                <Icon size={14} />
                                {mode.label}
                                {isSelected && <span style={{ marginLeft: 'auto' }}>✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
