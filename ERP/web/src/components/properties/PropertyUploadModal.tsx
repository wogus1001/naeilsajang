import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from './PropertyUploadModal.module.css'; // We'll assume a CSS module or use global/inline for now

interface PropertyUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

export default function PropertyUploadModal({ isOpen, onClose, onUploadSuccess }: PropertyUploadModalProps) {
    const [files, setFiles] = useState<{
        main: File | null;
        work: File | null;
        price: File | null;
    }>({ main: null, work: null, price: null });

    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    if (!isOpen) return null;

    const handleFileChange = (type: 'main' | 'work' | 'price') => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const parseExcel = (file: File) => {
        return new Promise<any[]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsBinaryString(file); // Changed to BinaryString for compatibility
        });
    };

    const handleUpload = async () => {
        if (!files.main && !files.work && !files.price) {
            alert('적어도 하나의 파일을 선택해주세요.');
            return;
        }

        if (!confirm('선택한 파일들로 점포 데이터를 업로드하시겠습니까?\n(관리번호 기준 업데이트)')) return;

        setLoading(true);
        setLogs(['데이터 파싱 중...']);

        try {
            const mainData = files.main ? await parseExcel(files.main) : [];
            const workData = files.work ? await parseExcel(files.work) : [];
            const priceData = files.price ? await parseExcel(files.price) : [];

            setLogs(prev => [...prev, `파싱 완료: 메인 ${mainData.length}건, 작업 ${workData.length}건, 가격 ${priceData.length}건`, '서버 전송 중...']);

            // Get User Info for meta
            const userStr = localStorage.getItem('user');
            let userCompanyName = 'Unknown';
            let managerIdVal = '';
            if (userStr) {
                const parsed = JSON.parse(userStr);
                const user = parsed.user || parsed;
                userCompanyName = user.companyName || 'Unknown';
                managerIdVal = user.uid || user.id || '';
            }

            const payload = {
                main: mainData,
                work: workData,
                price: priceData,
                meta: {
                    userCompanyName,
                    managerId: managerIdVal
                }
            };

            const res = await fetch('/api/properties/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                setLogs(prev => [...prev, '업로드 성공!', `- 점포 처리: ${result.mainCount}건`, `- 작업내역 추가: ${result.workCount}건`, `- 가격내역 추가: ${result.priceCount}건`]);
                alert(`업로드 완료\n- 점포: ${result.mainCount}\n- 작업: ${result.workCount}\n- 가격: ${result.priceCount}`);
                onUploadSuccess();
                onClose();
            } else {
                const err = await res.json();
                setLogs(prev => [...prev, `오류 발생: ${err.error}`]);
                alert(`업로드 실패: ${err.error}`);
            }
        } catch (error: any) {
            console.error(error);
            setLogs(prev => [...prev, `치명적 오류: ${error.message}`]);
            alert('오류 발생');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: 12, width: 500, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>점포 데이터 일괄 업로드</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Main File */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileSpreadsheet size={16} color="#4C6EF5" />
                            점포 목록 (store_main.xlsx)
                            {files.main && <Check size={14} color="#51cf66" />}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange('main')} style={{ fontSize: 12 }} />
                    </div>

                    {/* Work History */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileSpreadsheet size={16} color="#fab005" />
                            물건 작업 내역 (store_work_history.xlsx)
                            {files.work && <Check size={14} color="#51cf66" />}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange('work')} style={{ fontSize: 12 }} />
                    </div>

                    {/* Price History */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileSpreadsheet size={16} color="#fa5252" />
                            가격 변동 내역 (store_price_history.xlsx)
                            {files.price && <Check size={14} color="#51cf66" />}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange('price')} style={{ fontSize: 12 }} />
                    </div>
                </div>

                {logs.length > 0 && (
                    <div style={{ marginTop: 20, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8, fontSize: 11, color: '#495057', maxHeight: 100, overflowY: 'auto' }}>
                        {logs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #dee2e6', background: 'white', cursor: 'pointer' }}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={loading}
                        style={{
                            padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#adb5bd' : '#228be6', color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        {loading ? '처리 중...' : '업로드 시작'}
                    </button>
                </div>
            </div>
        </div>
    );
}
