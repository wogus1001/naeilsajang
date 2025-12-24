
import { ContractTemplate } from "../../types/contract-core";

/**
 * CONTRACT PRESETS
 * 
 * Defines bundles of templates that are automatically added when a project
 * of a certain category is created.
 */

export interface ContractCategoryPreset {
    categoryId: string;
    label: string;
    description: string;
    defaultTemplateIds: string[]; // IDs of templates to create by default
    iconName?: string;
}

export const CATEGORY_PRESETS: ContractCategoryPreset[] = [
    {
        categoryId: 'business_transfer',
        label: '사업체 양도양수',
        description: '상가 점포 권리금 계약을 위한 표준 세트입니다.',
        defaultTemplateIds: [
            't-transfer-001', // 사업체 양도양수 계약서
            't-receipt-001',  // 권리금 영수증
            't-facility-check' // 시설 확인서
        ],
        iconName: 'Store'
    },
    {
        categoryId: 'real_estate_sale',
        label: '부동산 매매',
        description: '준비 중입니다. (아파트, 다세대 주택 등)',
        defaultTemplateIds: [],
        iconName: 'Building'
    },
    {
        categoryId: 'real_estate_rent',
        label: '부동산 임대차',
        description: '준비 중입니다. (원룸, 투룸 전월세)',
        defaultTemplateIds: [],
        iconName: 'Key'
    },
    {
        categoryId: 'c_consulting',
        label: '단순 컨설팅',
        description: '컨설팅 용역 계약 등',
        defaultTemplateIds: [],
        iconName: 'Briefcase'
    }
];

export const getPresetByCategory = (categoryLabel: string) => {
    // Mapping human readable category labels to IDs if necessary, 
    // or just finding by label if we store label as key.
    // Given the current system uses full korean strings as keys often:
    return CATEGORY_PRESETS.find(p => p.label === categoryLabel);
};
