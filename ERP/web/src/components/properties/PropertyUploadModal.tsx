"use client";

import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

import { AlertModal } from '@/components/common/AlertModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

import { readApiJson } from '@/utils/apiResponse';
import { getSupabase } from '@/lib/supabase'; // Import Supabase client

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
        photos: FileList | null;
        docFolder: FileList | null;
        contracts: File | null;
        targetCustomers: File | null;
    }>({ main: null, work: null, price: null, photos: null, docFolder: null, contracts: null, targetCustomers: null });

    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info'; onClose?: () => void }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void; isDanger?: boolean }>({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        isDanger: false
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
        setAlertConfig({ isOpen: true, message, type, onClose });
    };

    const closeAlert = () => {
        if (alertConfig.onClose) alertConfig.onClose();
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    const showConfirm = (message: string, onConfirm: () => void, isDanger = false) => {
        setConfirmModal({ isOpen: true, message, onConfirm, isDanger });
    };

    if (!isOpen) return null;

    const handleFileChange = (type: 'main' | 'work' | 'price' | 'contracts' | 'targetCustomers') => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => ({ ...prev, photos: e.target.files }));
        }
    };

    const handleDocFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => ({ ...prev, docFolder: e.target.files }));
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
            reader.readAsBinaryString(file);
        });
    };

    // Helper: Geocode Addresses (Client-side Kakao)
    const geocodeData = async (data: any[]) => {
        if (typeof window === 'undefined' || !(window as any).kakao || !(window as any).kakao.maps) {
            console.warn('Kakao Maps SDK not loaded. Skipping geocoding.');
            return data;
        }

        const geocoder = new (window as any).kakao.maps.services.Geocoder();
        const processed = [...data];
        let successCount = 0;

        for (let i = 0; i < processed.length; i++) {
            const row = processed[i];
            // 주소 키 탐색
            const addrKey = Object.keys(row).find(k => ['지번주소', '도로명주소', '소재지', '주소', '위치상권'].includes(k));
            const address = addrKey ? row[addrKey] : null;

            if (address && !row['lat'] && !row['lng']) {
                try {
                    setLogs(prev => {
                        const newLogs = [...prev];
                        if (newLogs.length > 0 && newLogs[newLogs.length - 1].startsWith('좌표 변환 중')) {
                            newLogs[newLogs.length - 1] = `좌표 변환 중... (${i + 1}/${processed.length})`;
                            return newLogs;
                        }
                        return [...prev, `좌표 변환 중... (${i + 1}/${processed.length})`];
                    });

                    await new Promise<void>((resolve) => {
                        geocoder.addressSearch(address, (result: any[], status: any) => {
                            if (status === (window as any).kakao.maps.services.Status.OK) {
                                row['lat'] = result[0].y;
                                row['lng'] = result[0].x;
                                successCount++;
                            }
                            resolve();
                        });
                    });

                    // 카카오 API 레이트 리밋 방지 (50ms 딜레이)
                    await new Promise(r => setTimeout(r, 50));
                } catch (e) {
                    console.error('Geocoding error', e);
                }
            }
        }
        console.log(`Geocoding complete. Success: ${successCount}`);
        return processed;
    };

    const handleUpload = async () => {
        if (!files.main && !files.work && !files.price && !files.contracts && !files.targetCustomers) {
            showAlert('적어도 하나의 파일을 선택해주세요.', 'error');
            return;
        }

        showConfirm('선택한 파일들로 점포 데이터를 업로드하시겠습니까?\n(관리번호 기준 업데이트)', async () => {
            setLoading(true);
            setLogs(['데이터 파싱 중...']);

            try {
                let mainData = files.main ? await parseExcel(files.main) : [];
                // 좌표 변환 (Geocoding)
                if (mainData.length > 0) {
                    mainData = await geocodeData(mainData);
                }

                const workData = files.work ? await parseExcel(files.work) : [];
                const priceData = files.price ? await parseExcel(files.price) : [];
                const contractData = files.contracts ? await parseExcel(files.contracts) : [];
                const targetCustomerData = files.targetCustomers ? await parseExcel(files.targetCustomers) : [];

                setLogs(prev => [...prev,
                `파싱 완료: 메인 ${mainData.length}건, 작업 ${workData.length}건, 가격 ${priceData.length}건, 계약 ${contractData.length}건, 추진고객 ${targetCustomerData.length}건`,
                    '서버 전송 중...'
                ]);

                // 사용자 메타 정보
                const userStr = localStorage.getItem('user');
                let userCompanyName = 'Unknown';
                let managerIdVal = '';
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const user = parsed.user || parsed;
                    userCompanyName = user.companyName || 'Unknown';
                    managerIdVal = user.uid || user.id || '';
                }

                // Vercel 요청 크기 제한(4.5MB) 방지: 100건씩 분할 전송
                // 500건도 행당 데이터(월별매출현황 등 JSONB)가 크면 4.5MB 초과 가능
                const CHUNK_SIZE = 100;
                let totalMainCount = 0;
                let totalWorkCount = 0;
                let totalPriceCount = 0;
                let totalContractCount = 0;
                let totalTargetCustomerCount = 0;
                // 사진/문서 업로드를 위해 모든 청크의 processedProperties를 누적
                let allProcessedProperties: any[] = [];

                for (let i = 0; i < mainData.length; i += CHUNK_SIZE) {
                    const mainChunk = mainData.slice(i, i + CHUNK_SIZE);

                    // 해당 청크의 관리번호 기준으로 연관 데이터 필터링 (데이터 누락 없음)
                    const chunkIds = new Set(mainChunk.map((r: any) => String(r['관리번호'] || r['manageId'] || '')).filter(Boolean));
                    const workChunk = workData.filter((r: any) => chunkIds.has(String(r['관리번호'] || r['manageId'] || '')));
                    const priceChunk = priceData.filter((r: any) => chunkIds.has(String(r['관리번호'] || r['manageId'] || '')));
                    const contractChunk = contractData.filter((r: any) => chunkIds.has(String(r['관리번호'] || r['manageId'] || '')));
                    const targetChunk = targetCustomerData.filter((r: any) => chunkIds.has(String(r['관리번호'] || r['manageId'] || '')));

                    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
                    const totalChunks = Math.ceil(mainData.length / CHUNK_SIZE);
                    setLogs(prev => [...prev, `청크 ${chunkNum}/${totalChunks} 전송 중... (${i + 1}~${Math.min(i + CHUNK_SIZE, mainData.length)}번)`]);

                    const payload = {
                        main: mainChunk,
                        work: workChunk,
                        price: priceChunk,
                        contracts: contractChunk,
                        targetCustomers: targetChunk,
                        meta: { userCompanyName, managerId: managerIdVal }
                    };

                    const res = await fetch('/api/properties/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        // 413 등 plain text 응답도 안전하게 처리
                        let errMsg = '알 수 없는 오류';
                        try {
                            const errJson = await readApiJson(res);
                            errMsg = errJson.error || errMsg;
                        } catch {
                            // JSON 파싱 실패 시 텍스트로 읽음 (예: 413 Request Entity Too Large)
                            const text = await res.text().catch(() => '');
                            errMsg = text ? text.substring(0, 80) : `HTTP ${res.status}`;
                        }
                        setLogs(prev => [...prev, `오류 발생 (청크 ${chunkNum}): ${errMsg}`]);
                        showAlert(`업로드 실패 (${i + 1}~${i + mainChunk.length}번째 행): ${errMsg}`, 'error');
                        return;
                    }

                    const result = await readApiJson(res);
                    totalMainCount += result.mainCount || 0;
                    totalWorkCount += result.workCount || 0;
                    totalPriceCount += result.priceCount || 0;
                    totalContractCount += result.contractCount || 0;
                    totalTargetCustomerCount += result.targetCustomerCount || 0;

                    // 사진/문서 업로드용 processedProperties 누적
                    if (result.processedProperties && Array.isArray(result.processedProperties)) {
                        allProcessedProperties = allProcessedProperties.concat(result.processedProperties);
                    }
                }

                setLogs(prev => [...prev,
                    '업로드 성공!',
                `- 점포 처리: ${totalMainCount}건`,
                `- 작업내역 추가: ${totalWorkCount}건`,
                `- 가격내역 추가: ${totalPriceCount}건`,
                `- 계약내역 추가: ${totalContractCount}건`,
                `- 추진고객 추가: ${totalTargetCustomerCount}건`
                ]);

                // 청크 결과 통합본으로 후속 작업 수행
                const combinedResult = {
                    mainCount: totalMainCount,
                    workCount: totalWorkCount,
                    priceCount: totalPriceCount,
                    contractCount: totalContractCount,
                    targetCustomerCount: totalTargetCustomerCount,
                    processedProperties: allProcessedProperties
                };

                const handleDocStep = (result: any) => {
                    // --- 문서 업로드 로직 ---
                    if (files.docFolder && result.processedProperties && result.processedProperties.length > 0) {
                        showConfirm('이어서 선택된 폴더의 관련문서를 업로드하시겠습니까?', async () => {
                            setLogs(prev => [...prev, '--- 문서 업로드 시작 ---']);
                            const supabase = getSupabase();
                            let docUploadCount = 0;
                            const processedMap = new Map(result.processedProperties.map((p: any) => [String(p.manageId).trim(), p]));

                            // 문서 정보 파싱을 위해 main 파일 재파싱
                            const mainDataForDoc = files.main ? await parseExcel(files.main) : [];

                            // 파일 경로 맵 구성: "관리번호/파일명" → File
                            const fileMap = new Map<string, File>();
                            Array.from(files.docFolder as FileList).forEach((file: File) => {
                                const pathParts = file.webkitRelativePath.split('/');
                                if (pathParts.length >= 3) {
                                    const key = `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
                                    fileMap.set(key, file);
                                }
                            });

                            for (const row of mainDataForDoc) {
                                const rowAny = row as any;
                                const docRaw = rowAny['관련문서'];
                                if (!docRaw) continue;

                                let docList: any[] = [];
                                try {
                                    if (typeof docRaw === 'string') {
                                        const cleaned = docRaw.replace(/'/g, '"');
                                        docList = JSON.parse(cleaned);
                                    } else if (Array.isArray(docRaw)) {
                                        docList = docRaw;
                                    }
                                } catch (e) {
                                    console.warn('Failed to parse doc column', docRaw);
                                    continue;
                                }

                                const manageId = String(rowAny['관리번호'] || rowAny['manageId'] || '').trim();
                                if (!processedMap.has(manageId)) continue;
                                const prop: any = processedMap.get(manageId);

                                if (Array.isArray(docList)) {
                                    for (const item of docList) {
                                        if (!Array.isArray(item) || item.length < 6) continue;

                                        const uploader = item[3];
                                        const fileName = item[5];
                                        if (!fileName) continue;

                                        const fileKey = `${manageId}/${fileName}`;
                                        const file = fileMap.get(fileKey);

                                        if (file) {
                                            setLogs(prev => [...prev, `[${manageId}] 문서 매칭: ${fileName}`]);
                                            const ext = fileName.split('.').pop() || 'unknown';
                                            const timestamp = Date.now();
                                            const randomSuffix = Math.random().toString(36).substring(2, 8);
                                            const safetyStorageName = `${timestamp}_${randomSuffix}.${ext}`;
                                            const storagePath = `properties/${prop.id}/${safetyStorageName}`;

                                            const formData = new FormData();
                                            formData.append('file', file);
                                            formData.append('path', storagePath);
                                            formData.append('bucket', 'property-documents');

                                            try {
                                                const uploadRes = await fetch('/api/upload', {
                                                    method: 'POST',
                                                    body: formData
                                                });

                                                if (uploadRes.ok) {
                                                    const { publicUrl } = await readApiJson(uploadRes);
                                                    const newDoc = {
                                                        id: timestamp.toString() + Math.random().toString().substr(2, 5),
                                                        date: new Date().toISOString().split('T')[0],
                                                        uploader: uploader || 'System',
                                                        type: ext,
                                                        name: fileName,
                                                        size: file.size,
                                                        url: publicUrl,
                                                        path: storagePath
                                                    };

                                                    const { data: currentProp } = await supabase.from('properties').select('data').eq('id', prop.id).single();
                                                    const currentDocs = currentProp?.data?.documents || [];
                                                    const updatedDocs = [...currentDocs, newDoc];

                                                    await supabase.from('properties').update({
                                                        data: { ...currentProp?.data, documents: updatedDocs }
                                                    }).eq('id', prop.id);

                                                    docUploadCount++;
                                                } else {
                                                    const errText = await uploadRes.text();
                                                    console.error(`Doc upload failed: ${fileName}`, errText);
                                                    setLogs(prev => [...prev, `[문서실패] ${fileName} (${uploadRes.status}): ${errText.substring(0, 50)}`]);
                                                }
                                            } catch (err: any) {
                                                console.error(`Doc upload error: ${fileName}`, err);
                                                setLogs(prev => [...prev, `[문서오류] ${fileName}: ${err.message}`]);
                                            }
                                        }
                                    }
                                }
                            }
                            showAlert(`문서 업로드 완료: 총 ${docUploadCount}개 성공`, 'success', () => {
                                onUploadSuccess();
                                onClose();
                            });
                        });
                    } else {
                        onUploadSuccess();
                        onClose();
                    }
                };

                const nextStep = () => {
                    // --- 사진 업로드 로직 ---
                    if (files.photos && combinedResult.processedProperties && combinedResult.processedProperties.length > 0) {
                        showConfirm('엑셀 업로드가 완료되었습니다. 이어서 선택된 폴더의 사진을 업로드하시겠습니까?', async () => {
                            setLogs(prev => [...prev, '--- 사진 업로드 시작 ---']);
                            const supabase = getSupabase();
                            let uploadCount = 0;
                            const processedMap = new Map(combinedResult.processedProperties.map((p: any) => [String(p.manageId).trim(), p]));

                            // 관리번호 폴더별 파일 그룹화
                            const fileGroups = new Map<string, File[]>();
                            Array.from(files.photos as FileList).forEach((file: File) => {
                                const pathParts = file.webkitRelativePath.split('/');
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
                                            const errData = await readApiJson(uploadRes);
                                            throw new Error(errData.error || 'Upload failed');
                                        }

                                        const { publicUrl } = await readApiJson(uploadRes);
                                        uploadedUrls.push(publicUrl);
                                    } catch (err: any) {
                                        console.error(`Upload failed for ${file.name}`, err);
                                        setLogs(prev => [...prev, `[업로드 실패] ${file.name}: ${err.message}`]);
                                    }
                                }

                                if (uploadedUrls.length > 0) {
                                    const { data: currentProp } = await supabase.from('properties').select('data').eq('id', prop.id).single();
                                    const currentPhotos = currentProp?.data?.photos || [];
                                    const newPhotos = [...currentPhotos, ...uploadedUrls];

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
                            showAlert(`사진 업로드 완료: 총 ${uploadCount}장`, 'success', () => handleDocStep(combinedResult));
                        });
                    } else {
                        handleDocStep(combinedResult);
                    }
                };

                showAlert(
                    `업로드 완료\n- 점포: ${combinedResult.mainCount}\n- 작업: ${combinedResult.workCount}\n- 가격: ${combinedResult.priceCount}\n- 계약: ${combinedResult.contractCount || 0}\n- 추진고객: ${combinedResult.targetCustomerCount || 0}`,
                    'success',
                    nextStep
                );
            } catch (error: any) {
                console.error(error);
                setLogs(prev => [...prev, `치명적 오류: ${error.message}`]);
                showAlert('오류 발생', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    // 사진만 별도 업로드 (엑셀 없이 이미 등록된 매물에 사진 추가)
    const handleOnlyPhotoUpload = async () => {
        if (!files.photos || files.photos.length === 0) {
            showAlert('사진 폴더를 선택해주세요.', 'error');
            return;
        }

        showConfirm('선택한 폴더의 사진을 업로드하시겠습니까?\n(등록된 매물 정보와 매칭하여 업로드합니다)', async () => {
            setLoading(true);
            setLogs(['매물 정보 불러오는 중...']);

            try {
                // 1. 매물 목록 조회
                const userStr = localStorage.getItem('user');
                const parsed = userStr ? JSON.parse(userStr) : {};
                const user = parsed.user || parsed;
                const companyQuery = user?.companyName ? `&company=${encodeURIComponent(user.companyName)}` : '';

                const res = await fetch(`/api/properties?min=true${companyQuery}`);
                if (!res.ok) throw new Error('매물 정보를 불러오는데 실패했습니다.');
                const properties = await readApiJson(res);

                setLogs(prev => [...prev, `매물 ${properties.length}건 로드 완료.`, '사진 매칭 및 업로드 시작...']);

                const supabase = getSupabase();
                const processedMap = new Map();
                properties.forEach((p: any) => {
                    if (p.manageId) processedMap.set(String(p.manageId).trim(), p);
                });

                // 관리번호 폴더별로 파일 그룹화
                const fileGroups = new Map<string, File[]>();
                Array.from(files.photos as FileList).forEach((file: File) => {
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

                    // 이름으로 퍼지 매칭 (보조 수단)
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
                                const errData = await readApiJson(uploadRes);
                                throw new Error(errData.error || 'Upload failed');
                            }

                            const { publicUrl } = await readApiJson(uploadRes);
                            uploadedUrls.push(publicUrl);

                        } catch (err: any) {
                            console.error(`Upload failed for ${file.name}`, err);
                            setLogs(prev => [...prev, `[업로드 실패] ${file.name}: ${err.message}`]);
                        }
                    }

                    if (uploadedUrls.length > 0) {
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
                showAlert(`완료: ${matchCount}개 매물 처리, ${uploadCount}장 업로드`, 'success', () => onUploadSuccess());

            } catch (error: any) {
                console.error(error);
                setLogs(prev => [...prev, `오류: ${error.message}`]);
                showAlert('오류 발생', 'error');
            } finally {
                setLoading(false);
            }
        });
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

                    {/* Contract History */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileSpreadsheet size={16} color="#845ef7" />
                            고객 계약 내역 (store_contracts_v2.xlsx)
                            {files.contracts && <Check size={14} color="#51cf66" />}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange('contracts')} style={{ fontSize: 12 }} />
                    </div>

                    {/* Target Customers */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileSpreadsheet size={16} color="#e64980" />
                            추진 고객 내역 (store_target_customers.xlsx)
                            {files.targetCustomers && <Check size={14} color="#51cf66" />}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange('targetCustomers')} style={{ fontSize: 12 }} />
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

                    {/* Document Folder */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Upload size={16} color="#40C057" />
                            문서 저장 폴더 (documents)
                            {files.docFolder && <Check size={14} color="#51cf66" />}
                        </div>
                        <div style={{ fontSize: 11, color: '#868e96', marginBottom: 6 }}>
                            * 'documents' 폴더를 통째로 선택하세요 (하위에 번호별 폴더 포함)
                        </div>
                        {/* @ts-ignore */}
                        <input type="file" webkitdirectory="" directory="" multiple onChange={handleDocFolderChange} style={{ fontSize: 12 }} />
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
                    {/* 사진만 별도 업로드 버튼 */}
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

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
            />
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                message={alertConfig.message}
                type={alertConfig.type}
            />
        </div>
    );
}
