
/**
 * CONTRACT ARCHITECTURE - DATA MODELS
 * 
 * Based on "Template-Driven Architecture" requirements.
 */

// 1. PROJECT (CASE) - The overarching transaction
export interface ContractProject {
    id: string;
    title: string;          // e.g. "Ediya Cafe Sale Gangnam"
    status: 'draft' | 'active' | 'completed';
    category?: string;      // e.g. "사업체 양도양수", "부동산"
    participants?: string;  // e.g. "김매도, 이매수"
    createdAt: string;
    updatedAt: string;

    // Common Data: Inherited by all documents in this project
    commonData: CommonData;

    // Documents belonging to this project
    documents: ContractDocument[];
}

export interface CommonData {
    // Participants
    sellerName?: string;
    sellerPhone?: string;
    sellerIdNum?: string; // 주민/사업자 번호
    sellerAddress?: string;

    buyerName?: string;
    buyerPhone?: string;
    buyerAddress?: string;

    // Property / Target
    storeName?: string;     // 상호
    storeAddress?: string;  // 소재지
    storeArea?: string;     // 면적

    // Financials (Defaults)
    totalPrice?: number;    // 총 권리금
    deposit?: number;       // 보증금
    monthlyRent?: number;   // 월세
    contractDate?: string;  // 계약일
    balanceDate?: string;   // 잔금일

    [key: string]: any;     // Extensible
}

// 2. TEMPLATE (DEFINITION) - The blueprints
export interface ContractTemplate {
    id: string;
    name: string;           // e.g. "점포 양도양수 계약서"
    category: string;       // e.g. "사업체 양도양수", "부동산"
    description?: string;

    // Dynamic Form Definition
    formSchema: FormField[];

    // HTML Layout with {{Handlebars}} style placeholders
    htmlTemplate: string;

    createdAt?: string;
    updatedAt?: string;
}

export type FieldType = 'text' | 'number' | 'money' | 'currency' | 'date' | 'textarea' | 'section' | 'info';

export interface FormField {
    key: string;            // Variable name e.g. "downPayment"
    label: string;          // UI Label e.g. "계약금"
    type: FieldType;
    placeholder?: string;
    required?: boolean;
    section?: string;       // For grouping in UI
    defaultValue?: any;
    helpText?: string;
}

// 3. DOCUMENT (INSTANCE) - A concrete file
export interface ContractDocument {
    id: string;
    projectId: string;
    templateId: string;
    name: string;           // Editable name, defaults to Template name

    // Instance specific data (overrides commonData if keys match)
    formData: Record<string, any>;

    createdAt: string;
    updatedAt: string;
}

// 4. NAVIGATION TYPES
export interface CategoryGroup {
    id: string;
    label: string;
    templates: ContractTemplate[];
}
