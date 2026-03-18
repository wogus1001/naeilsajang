import { createClient } from '@/utils/supabase/client';
import { ContractTemplate } from '@/types/contract-core';

// 하드코딩된 기본 템플릿 목록을 제거하고 DB에서만 불러옵니다.
// 하위 호환성을 위해 빈 배열로 유지합니다.
export const CONTRACT_TEMPLATES: ContractTemplate[] = [];

// 동기 방식으로 모든 템플릿 가져오기 (로컬스토리지만 사용)
export const getAllTemplates = (): ContractTemplate[] => {
    if (typeof window === 'undefined') return [];

    // 로컬스토리지에 백업된 사용자 정의 템플릿만 반환
    const stored = localStorage.getItem('custom_templates');
    const customs = stored ? JSON.parse(stored) : [];

    return customs;
};

export const getTemplateById = (id: string): ContractTemplate | undefined => {
    return getAllTemplates().find(t => t.id === id);
};

// 비동기 방식으로 DB + 로컬스토리지에서 템플릿 병합 가져오기
export const fetchCombinedTemplates = async (): Promise<ContractTemplate[]> => {
    if (typeof window === 'undefined') return [];

    // 1. DB에서 불러오기
    let dbTemplates: ContractTemplate[] = [];
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch('/api/templates', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        if (res.ok) {
            dbTemplates = await res.json();
        } else {
            console.error('DB에서 템플릿 불러오기 실패');
        }
    } catch (e) {
        console.error('템플릿 불러오기 오류:', e);
    }

    // 2. 로컬스토리지에서 불러오기 (DB에 없는 로컬 전용 템플릿)
    const stored = localStorage.getItem('custom_templates');
    const localTemplates = stored ? JSON.parse(stored) : [];

    // 3. 병합 (DB 우선, 중복 제거)
    const uniqueLocal = localTemplates.filter(
        (l: ContractTemplate) => !dbTemplates.find(d => d.id === l.id)
    );

    return [...dbTemplates, ...uniqueLocal];
};
