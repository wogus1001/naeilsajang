"use client";

import React, { useState } from 'react';
import { X, Folder, Check } from 'lucide-react';
import { ContractFolder } from '@/lib/ucansign/client';

interface MoveToFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (folderId: string) => Promise<void>;
    folders: ContractFolder[];
    selectedCount: number;
}

export default function MoveToFolderModal({ isOpen, onClose, onMove, folders, selectedCount }: MoveToFolderModalProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedFolderId) return;
        setIsSubmitting(true);
        await onMove(selectedFolderId);
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={styles.title}>폴더 이동</h3>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.body}>
                    <p style={styles.description}>
                        선택한 <strong>{selectedCount}개</strong>의 문서를 이동할 폴더를 선택하세요.
                    </p>

                    <div style={styles.folderList}>
                        {folders.map(folder => (
                            <div
                                key={folder.documentId || folder.folderId} // API inconsistency fallback
                                style={{
                                    ...styles.folderItem,
                                    ...(selectedFolderId === (folder.documentId || folder.folderId).toString() ? styles.folderItemSelected : {})
                                }}
                                onClick={() => setSelectedFolderId((folder.documentId || folder.folderId).toString())}
                            >
                                <Folder size={16} fill={selectedFolderId === (folder.documentId || folder.folderId).toString() ? "#fac418" : "none"} color="#fac418" />
                                <span style={styles.folderName}>{folder.name}</span>
                                {selectedFolderId === (folder.documentId || folder.folderId).toString() && <Check size={16} color="#12b886" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.footer}>
                    <button style={styles.cancelBtn} onClick={onClose}>취소</button>
                    <button
                        style={{ ...styles.confirmBtn, opacity: selectedFolderId ? 1 : 0.5 }}
                        onClick={handleSubmit}
                        disabled={!selectedFolderId || isSubmitting}
                    >
                        {isSubmitting ? '이동 중...' : '이동하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    modal: {
        backgroundColor: 'white', width: '400px', borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden'
    },
    header: {
        padding: '16px 20px', borderBottom: '1px solid #eee',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    title: { margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#343a40' },
    closeBtn: {
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        color: '#868e96'
    },
    body: { padding: '20px' },
    description: { fontSize: '14px', color: '#495057', marginBottom: '16px' },
    folderList: {
        display: 'flex', flexDirection: 'column' as const, gap: '8px',
        maxHeight: '300px', overflowY: 'auto' as 'auto'
    },
    folderItem: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6',
        cursor: 'pointer', transition: 'all 0.2s', backgroundColor: 'white'
    },
    folderItemSelected: {
        border: '1px solid #fac418', backgroundColor: '#fff9db'
    },
    folderName: { flex: 1, fontSize: '14px', fontWeight: 500, color: '#343a40' },
    footer: {
        padding: '16px 20px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee',
        display: 'flex', justifyContent: 'flex-end', gap: '8px'
    },
    cancelBtn: {
        padding: '8px 16px', borderRadius: '6px', border: '1px solid #dee2e6',
        backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', color: '#495057'
    },
    confirmBtn: {
        padding: '8px 16px', borderRadius: '6px', border: 'none',
        backgroundColor: '#fac418', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: 'white'
    }
};
