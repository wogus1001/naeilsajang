import React from 'react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean; // If true, confirm button is red
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    message,
    confirmText = '확인',
    cancelText = '취소',
    isDanger = false
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.content}>
                    <p className={styles.message}>{message}</p>
                </div>
                <div className={styles.footer}>
                    <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        className={`${styles.btn} ${isDanger ? styles.dangerBtn : styles.confirmBtn}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
