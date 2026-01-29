import React from 'react';
import { LayoutTemplate, Sidebar, Maximize2, MoreHorizontal } from 'lucide-react';

import styles from './ViewModeSwitcher.module.css';

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
        <div className={styles.container}>
            <button
                type="button"
                className={styles.triggerBtn}
                onClick={() => setIsOpen(!isOpen)}
            >
                <MoreHorizontal size={16} />
                <span className={styles.triggerLabel}>{currentLabel}</span>
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {modes.map(mode => {
                        const Icon = mode.icon;
                        const isSelected = currentMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                className={`${styles.optionBtn} ${isSelected ? styles.selected : ''}`}
                                onClick={() => {
                                    onModeChange(mode.id as ViewMode);
                                    setIsOpen(false);
                                }}
                            >
                                <Icon size={14} />
                                {mode.label}
                                {isSelected && <span className={styles.checkIcon}>✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
