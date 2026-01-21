import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from './PropertyUploadModal.module.css'; // We'll assume a CSS module or use global/inline for now

interface PropertyUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

import { getSupabase } from '@/lib/supabase'; // Import Supabase client

export default function PropertyUploadModal({ isOpen, onClose, onUploadSuccess }: PropertyUploadModalProps) {
    const [files, setFiles] = useState<{
        main: File | null;
        work: File | null;
        price: File | null;
        photos: FileList | null; // Add photos state
    }>({ main: null, work: null, price: null, photos: null });

    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    if (!isOpen) return null;

    const handleFileChange = (type: 'main' | 'work' | 'price') => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => ({ ...prev, photos: e.target.files }));
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

                // --- IMAGE UPLOAD LOGIC ---
                if (files.photos && result.processedProperties && result.processedProperties.length > 0) {
                    if (confirm('엑셀 업로드가 완료되었습니다. 이어서 선택된 폴더의 사진을 업로드하시겠습니까?')) {
                        setLogs(prev => [...prev, '--- 사진 업로드 시작 ---']);
                        const supabase = getSupabase();
                        let uploadCount = 0;
                        const processedMap = new Map(result.processedProperties.map((p: any) => [String(p.manageId).trim(), p]));

                        // Group files by parent folder name which should match manageId
                        const fileGroups = new Map<string, File[]>();
                        Array.from(files.photos).forEach(file => {
                            const pathParts = file.webkitRelativePath.split('/');
                            // path: root/10006/img.jpg -> length 3, id is parts[1]
                            // path: 10006/img.jpg -> length 2, id is parts[0]
                            if (pathParts.length >= 2) {
                                const folderName = pathParts[pathParts.length - 2];
                                if (!fileGroups.has(folderName)) fileGroups.set(folderName, []);
                                fileGroups.get(folderName)!.push(file);
                            }
                        });

                        for (const [legacyId, groupFiles] of Array.from(fileGroups.entries())) {
                            if (!processedMap.has(legacyId)) continue;
                            const prop: any = processedMap.get(legacyId);
                            setLogs(prev => [...prev, `[${legacyId}] 매물 매칭됨 (${prop.name}). 사진 ${groupFiles.length}장 업로드 중...`]);

                            const uploadedUrls: string[] = [];

                            for (const file of groupFiles) {
                                const ext = file.name.split('.').pop();
                                const path = `${prop.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
                                const { data: upData, error: upError } = await supabase.storage
                                    .from('property-images')
                                    .upload(path, file);

                                if (upError) {
                                    console.error(`Upload failed for ${file.name}`, upError);
                                    setLogs(prev => [...prev, `[업로드 실패] ${file.name}: ${upError.message}`]);
                                } else if (upData) {
                                    const publicUrl = supabase.storage.from('property-images').getPublicUrl(path).data.publicUrl;
                                    uploadedUrls.push(publicUrl);
                                }
                            }

                            if (uploadedUrls.length > 0) {
                                // Fetch current photos to merge
                                const { data: currentProp } = await supabase.from('properties').select('data').eq('id', prop.id).single();
                                const currentPhotos = currentProp?.data?.photos || [];
                                const newPhotos = [...currentPhotos, ...uploadedUrls]; // Deduplication?

                                // Update DB
                                const { error: updateError } = await supabase.from('properties').update({
                                    data: { ...currentProp?.data, photos: newPhotos }
                                }).eq('id', prop.id);

                                if (!updateError) {
                                    uploadCount += uploadedUrls.length;
                                    setLogs(prev => [...prev, `[${legacyId}] 사진 ${uploadedUrls.length}장 저장 완료`]);
                                } else {
                                    setLogs(prev => [...prev, `[${legacyId}] DB 업데이트 실패`]);
                                }
                            }
                        }
                        alert(`사진 업로드 완료: 총 ${uploadCount}장`);
                    }
                }

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

    // New Function: Standalone Photo Upload
    const handleOnlyPhotoUpload = async () => {
        if (!files.photos || files.photos.length === 0) {
            alert('사진 폴더를 선택해주세요.');
            return;
        }

        if (!confirm('선택한 폴더의 사진을 업로드하시겠습니까?\n(등록된 매물 정보와 매칭하여 업로드합니다)')) return;

        setLoading(true);
        setLogs(['매물 정보 불러오는 중...']);

        try {
            // 1. Fetch Min List
            const res = await fetch('/api/properties?min=true');
            if (!res.ok) throw new Error('매물 정보를 불러오는데 실패했습니다.');
            const properties = await res.json();

            setLogs(prev => [...prev, `매물 ${properties.length}건 로드 완료.`, '사진 매칭 및 업로드 시작...']);

            const supabase = getSupabase();
            const processedMap = new Map();
            properties.forEach((p: any) => {
                // Try multiple keys for legacy ID
                if (p.manageId) processedMap.set(String(p.manageId).trim(), p);
                // Also match by Name if it contains ID like "Name (10006)"
                // But manageId is safer.
            });

            // Group files
            const fileGroups = new Map<string, File[]>();
            Array.from(files.photos).forEach(file => {
                const pathParts = file.webkitRelativePath.split('/');
                if (pathParts.length >= 2) {
                    const folderName = pathParts[pathParts.length - 2];
                    if (!fileGroups.has(folderName)) fileGroups.set(folderName, []);
                    fileGroups.get(folderName)!.push(file);
                }
            });
            let uploadCount = 0;
            let matchCount = 0;

            for (const [legacyId, groupFiles] of Array.from(fileGroups.entries())) {
                let prop: any = processedMap.get(legacyId);

                // Fuzzy match fallback: Search in Name
                if (!prop) {
                    prop = properties.find((p: any) => p.name && p.name.includes(`(${legacyId})`));
                }

                if (!prop) {
                    setLogs(prev => [...prev, `[Skip] ${legacyId}: 매칭되는 매물 없음`]);
                    continue;
                }

                matchCount++;
                setLogs(prev => [...prev, `[${legacyId}] 매칭됨: ${prop.name}. 사진 ${groupFiles.length}장 업로드...`]);

                const uploadedUrls: string[] = [];
                for (const file of groupFiles) {
                    const ext = file.name.split('.').pop();
                    const path = `${prop.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('path', path);
                    formData.append('bucket', 'property-images');

                    try {
                        const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadRes.ok) {
                            const errData = await uploadRes.json();
                            throw new Error(errData.error || 'Upload failed');
                        }

                        const { publicUrl } = await uploadRes.json();
                        uploadedUrls.push(publicUrl);

                    } catch (err: any) {
                        console.error(`Upload failed for ${file.name}`, err);
                        setLogs(prev => [...prev, `[업로드 실패] ${file.name}: ${err.message}`]);
                    }
                }

                if (uploadedUrls.length > 0) {
                    // Update DB
                    const { data: currentProp } = await supabase.from('properties').select('data').eq('id', prop.id).single();
                    const currentPhotos = currentProp?.data?.photos || [];
                    const newPhotos = [...currentPhotos, ...uploadedUrls];

                    const { error: updateError } = await supabase.from('properties').update({
                        data: { ...currentProp?.data, photos: newPhotos },
                        updated_at: new Date().toISOString()
                    }).eq('id', prop.id);

                    if (!updateError) {
                        uploadCount += uploadedUrls.length;
                    }
                }
            }

            setLogs(prev => [...prev, `완료! 총 ${matchCount}개 매물, 사진 ${uploadCount}장 업로드.`]);
            alert(`완료: ${matchCount}개 매물 처리, ${uploadCount}장 업로드`);
            onUploadSuccess(); // Optional: Refresh list

        } catch (error: any) {
            console.error(error);
            setLogs(prev => [...prev, `오류: ${error.message}`]);
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

                    {/* Image Folder */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Upload size={16} color="#228be6" />
                            사진 저장 폴더 (images)
                            {files.photos && <Check size={14} color="#51cf66" />}
                        </div>
                        <div style={{ fontSize: 11, color: '#868e96', marginBottom: 6 }}>
                            * 'images' 폴더를 통째로 선택하세요 (하위에 번호별 폴더 포함)
                        </div>
                        {/* @ts-ignore */}
                        <input type="file" webkitdirectory="" directory="" multiple onChange={handleFolderChange} style={{ fontSize: 12 }} />
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
                    {/* Standalone Photo Upload Button */}
                    <button
                        onClick={handleOnlyPhotoUpload}
                        disabled={loading || !files.photos}
                        style={{
                            padding: '8px 16px', borderRadius: 8, border: 'none', background: (loading || !files.photos) ? '#adb5bd' : '#1098ad', color: 'white', cursor: (loading || !files.photos) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        <Upload size={16} /> 사진만 업로드
                    </button>
                </div>
            </div>
        </div>
    );
}
