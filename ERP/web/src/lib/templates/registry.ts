
import { ContractTemplate } from "../../types/contract-core";

/**
 * TEMPLATE REGISTRY
 * 
 * Defines the standard contract templates available in the system.
 * This acts as the "Database Seeder" for templates.
 */

// --- UTILS ---
const formatMoney = (val: number) => val ? new Intl.NumberFormat('ko-KR').format(val) : '';

// --- HTML CONTENTS (Simplified for brevity, usually loaded from files) ---

const HTML_TRANSFER_AGREEMENT = `
<div class="contract-page">
    <h1 style="text-align: center; margin-bottom: 40px;">사업체 양도양수 계약서</h1>
    
    <div class="section">
        <h3>1. 대상물의 표시</h3>
        <table class="contract-table">
            <tr>
                <td class="label">상 호</td>
                <td>{{storeName}}</td>
                <td class="label">소재지</td>
                <td>{{storeAddress}}</td>
            </tr>
            <tr>
                <td class="label">면 적</td>
                <td colspan="3">{{storeArea}} (공유면적 포함)</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>2. 양도 조건 (권리금)</h3>
        <table class="contract-table">
            <tr>
                 <td class="label">총 권리금</td>
                 <td colspan="3" class="money">{{totalPrice_fmt}} 원 (₩ {{totalPrice}})</td>
            </tr>
            <tr>
                 <td class="label">계 약 금</td>
                 <td class="money">{{downPayment_fmt}} 원</td>
                 <td>계약시 지불</td>
            </tr>
            <tr>
                 <td class="label">중 도 금</td>
                 <td class="money">{{middlePayment_fmt}} 원</td>
                 <td>{{middlePaymentDate}} 지불</td>
            </tr>
            <tr>
                 <td class="label">잔    금</td>
                 <td class="money">{{balancePayment_fmt}} 원</td>
                 <td>{{balanceDate}} 지불</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>3. 특약 사항</h3>
        <div class="terms-box">
            {{specialTerms}}
        </div>
    </div>

    <div class="footer-sign">
        <div class="signer">
            <strong>양도인 (갑):</strong> {{sellerName}} (인)
        </div>
        <div class="signer">
            <strong>양수인 (을):</strong> {{buyerName}} (인)
        </div>
        <div class="date">
            작성일: {{contractDate}}
        </div>
    </div>
</div>
`;

const HTML_RECEIPT = `
<div class="receipt-page" style="border: 2px solid #333; padding: 40px;">
    <h1 style="text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 20px;">영 수 증 (Receipt)</h1>
    
    <div style="margin-top: 40px; font-size: 16px; line-height: 2;">
        <p><strong>수령 금액:</strong> 금 {{amount_fmt}} 원 (₩ {{amount}})</p>
        <p><strong>수령 내용:</strong> {{purpose}}</p>
        <p><strong>수 령 인:</strong> {{receiverName}}</p>
        <p><strong>지 급 인:</strong> {{payerName}}</p>
    </div>

    <div style="margin-top: 60px; text-align: center;">
        <p>위 금액을 정히 영수함.</p>
        <h3 style="margin-top: 30px;">{{date}}</h3>
        <div style="margin-top: 40px; font-size: 18px;">
            <strong>{{receiverName}}</strong> (인)
        </div>
    </div>
</div>
`;

// --- REGISTRY ---

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
    {
        id: 't-transfer-001',
        name: '사업체 양도양수 계약서',
        category: '사업체 양도양수',
        description: '표준 권리금 계약서 양식입니다.',
        htmlTemplate: HTML_TRANSFER_AGREEMENT,
        formSchema: [
            { key: 'section_basic', label: '기본 정보', type: 'section' },
            { key: 'storeName', label: '상호명', type: 'text', placeholder: '예: 이디야 강남점' },
            { key: 'storeAddress', label: '소재지', type: 'text' },
            { key: 'storeArea', label: '면적', type: 'text' },

            { key: 'section_money', label: '권리금 내역', type: 'section' },
            { key: 'totalPrice', label: '총 권리금', type: 'money' },
            { key: 'downPayment', label: '계약금', type: 'money' },
            { key: 'middlePayment', label: '중도금', type: 'money' },
            { key: 'middlePaymentDate', label: '중도금 지급일', type: 'date' },
            { key: 'balancePayment', label: '잔금', type: 'money' },
            { key: 'balanceDate', label: '잔금 지급일', type: 'date' },

            { key: 'section_people', label: '계약 당사자', type: 'section' },
            { key: 'sellerName', label: '양도인 성명', type: 'text' },
            { key: 'buyerName', label: '양수인 성명', type: 'text' },
            { key: 'contractDate', label: '계약 작성일', type: 'date' },

            { key: 'section_extra', label: '기타', type: 'section' },
            { key: 'specialTerms', label: '특약사항', type: 'textarea', helpText: '줄바꿈을 사용하여 입력하세요.' },
        ]
    },
    {
        id: 't-receipt-001',
        name: '권리금 영수증',
        category: '사업체 양도양수',
        description: '권리금 계약금/중도금/잔금 수령증',
        htmlTemplate: HTML_RECEIPT,
        formSchema: [
            { key: 'amount', label: '수령 금액', type: 'money' },
            { key: 'purpose', label: '수령 내용', type: 'text', placeholder: '예: 권리 계약금조' },
            { key: 'receiverName', label: '수령인 (받는사람)', type: 'text' },
            { key: 'payerName', label: '지급인 (주는사람)', type: 'text' },
            { key: 'date', label: '수령일', type: 'date' },
        ]
    },
    {
        id: 't-facility-check',
        name: '대상물 확인 설명서',
        category: '사업체 양도양수',
        description: '시설 및 비품 목록 체크리스트',
        htmlTemplate: `<div style="padding:20px;"><h1>시설 확인서</h1><p>내용 준비중...</p></div>`,
        formSchema: []
    }
];

// Helper to get ALL templates (static + user saved)
export const getAllTemplates = (): ContractTemplate[] => {
    let customTemplates: ContractTemplate[] = [];
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('custom_templates');
            if (stored) {
                customTemplates = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load custom templates', e);
        }
    }
    return [...CONTRACT_TEMPLATES, ...customTemplates];
};

export const getTemplateById = (id: string) => getAllTemplates().find(t => t.id === id);

export const getTemplatesByCategory = () => {
    const groups: Record<string, ContractTemplate[]> = {};
    getAllTemplates().forEach(t => {
        if (!groups[t.category]) groups[t.category] = [];
        groups[t.category].push(t);
    });
    return groups;
}
