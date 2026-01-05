
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SYSTEM_TEMPLATES = [
    {
        id: 't-transfer-agreement',
        name: '사업체 양도양수 계약서',
        category: '사업체 양도양수',
        description: '표준 권리금 계약서 양식입니다.',
        is_system: true,
        form_schema: [
            { key: '주소', label: '주소', type: 'text', placeholder: '주소을(를) 입력하세요' },
            { key: '상호', label: '상호', type: 'text', placeholder: '상호을(를) 입력하세요' },
            { key: '업종', label: '업종', type: 'text', placeholder: '업종을(를) 입력하세요' },
            { key: '임대면적', label: '임대면적', type: 'text', placeholder: '임대면적을(를) 입력하세요' },
            { key: '총_영업_권리금', label: '총 영업 권리금', type: 'currency', placeholder: '총 영업 권리금을(를) 입력하세요' },
            { key: '계약_일자', label: '계약 일자', type: 'date', placeholder: '계약 일자을(를) 입력하세요' },
            { key: '계약_금액', label: '계약 금액', type: 'text', placeholder: '계약 금액을(를) 입력하세요' },
            { key: '중도금_일자', label: '중도금 일자', type: 'date', placeholder: '중도금 일자을(를) 입력하세요' },
            { key: '중도금_금액', label: '중도금 금액', type: 'text', placeholder: '중도금 금액을(를) 입력하세요' },
            { key: '잔금_일자', label: '잔금 일자', type: 'text', placeholder: '잔금 일자을(를) 입력하세요' },
            { key: '잔금_금액', label: '잔금 금액', type: 'text', placeholder: '잔금 금액을(를) 입력하세요' },
            { key: '임차보증금', label: '임차보증금', type: 'currency', placeholder: '임차보증금을(를) 입력하세요' },
            { key: '월_차임', label: '월 차임', type: 'currency', placeholder: '월 차임을(를) 입력하세요' },
            { key: '관리비', label: '관리비', type: 'currency', placeholder: '관리비을(를) 입력하세요' },
            { key: '임대차_계약기간1', label: '임대차 계약기간1', type: 'date', placeholder: '임대차 계약기간1을(를) 입력하세요' },
            { key: '임대차_계약기간2', label: '임대차 계약기간2', type: 'date', placeholder: '임대차 계약기간2을(를) 입력하세요' },
            { key: '잔여기간', label: '잔여기간', type: 'text', placeholder: '잔여기간을(를) 입력하세요' },
            { key: '계약날짜', label: '계약날짜', type: 'date', placeholder: '계약날짜을(를) 입력하세요' },
            { key: '양도인_주소', label: '양도인 주소', type: 'text', placeholder: '양도인 주소을(를) 입력하세요' },
            { key: '양도인_주민번호', label: '양도인 주민번호', type: 'text', placeholder: '양도인 주민번호을(를) 입력하세요' },
            { key: '양도인_연락처', label: '양도인 연락처', type: 'text', placeholder: '양도인 연락처을(를) 입력하세요' },
            { key: '양도인_성명', label: '양도인 성명', type: 'text', placeholder: '양도인 성명을(를) 입력하세요' },
            { key: '양수인_주소', label: '양수인 주소', type: 'text', placeholder: '양수인 주소을(를) 입력하세요' },
            { key: '양수인_주민번호', label: '양수인 주민번호', type: 'text', placeholder: '양수인 주민번호을(를) 입력하세요' },
            { key: '양수인_연락처', label: '양수인 연락처', type: 'text', placeholder: '양수인 연락처을(를) 입력하세요' },
            { key: '양수인_성명', label: '양수인 성명', type: 'text', placeholder: '양수인 성명을(를) 입력하세요' },
            { key: '주관회사_주소', label: '주관회사 주소', type: 'text', placeholder: '주관회사 주소을(를) 입력하세요' },
            { key: '사업자_등록번호', label: '사업자 등록번호', type: 'text', placeholder: '사업자 등록번호을(를) 입력하세요' },
            { key: '주관회사_전화번호', label: '주관회사 전화번호', type: 'text', placeholder: '주관회사 전화번호을(를) 입력하세요' },
            { key: '주관회사_상호', label: '주관회사 상호', type: 'text', placeholder: '주관회사 상호을(를) 입력하세요' },
            { key: '계약주관담당자', label: '계약주관담당자', type: 'text', placeholder: '계약주관담당자을(를) 입력하세요' }
        ],
        // Added PAGE DELIMITER for pagination
        html_content: `<h3 style="text-align: center;"><span style="font-size: 18pt;">사업체 양도양수 계약서</span></h3><p><span style="font-size: 10pt;">본 계약은 현재 사업체의 영업및 시설에 관한 제반권리(영업권)를 양도ㆍ양수 하는 계약임</span></p><p><b><span style="font-size: 10pt;">1. 대상물의 표시</span></b></p><p style="text-align: left;"><span style="font-size: 10pt;">&nbsp; 주&nbsp; &nbsp; &nbsp; 소&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="주소" data-label="주소">{{주소}}</span>&nbsp;</span></p><p><span style="font-size: 10pt;">&nbsp; 상&nbsp; &nbsp; &nbsp; 호&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="상호" data-label="상호">{{상호}}</span>&nbsp;</span></p><p><span style="font-size: 10pt;">&nbsp; 업&nbsp; &nbsp; &nbsp; 종&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="업종" data-label="업종">{{업종}}</span>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;임대면적&nbsp; :&nbsp;&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="임대면적" data-label="임대면적">{{임대면적}}</span>&nbsp;m²(공유면적포함)</span></p><p><span style="font-size: 10pt;">양수인은 상기 사업체를 직접 현장 확인을 통해 실내ㆍ외면적을 확인하였고, 임대면적은 공유면적, 주차, 서비스 면적등 포함여부 및 임대인 성향에 따라 면적차이가 있기에 본 계약서 작성 후 쌍방은 임대면적과 전용면적의 차이가 있다고 하여 계약을 해제할 수 없으며, 이것을 이유로 쌍방은 추후 이의를 제기 할 수 없다.</span></p><p><b><span style="font-size: 10pt;">2. 계약내용</span></b></p><p><span style="font-size: 10pt;">제1조 양수인은 위 사업체에 대해 영업 권리를 양도인에게 아래와 같이 지불 하기로 한다.</span></p><table style="margin-top: 10px; margin-bottom: 10px;"><tbody><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: col-resize; width: 119.67px;"><span style="font-size: 10pt;">&nbsp;총 영업 권리금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="currency" data-key="총_영업_권리금" data-label="총 영업 권리금">{{총 영업 권리금}}</span>&nbsp; &nbsp; )</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;계약금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정은 계약 시 (<span class="contract-variable" data-type="variable" data-var-type="date" data-key="계약_일자" data-label="계약 일자">{{계약 일자}}</span>&nbsp;에 지불함.&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;&nbsp; <span class="contract-variable" data-type="variable" data-var-type="text" data-key="계약_금액" data-label="계약 금액">{{계약 금액}}</span>&nbsp;&nbsp;))</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;중도금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 원정은&nbsp;<span class="contract-variable" data-type="variable" data-var-type="date" data-key="중도금_일자" data-label="중도금 일자">{{중도금 일자}}</span>&nbsp;에 지불하며,&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="중도금_금액" data-label="중도금 금액">{{중도금 금액}}</span>&nbsp;)</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;잔금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정은&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="잔금_일자" data-label="잔금 일자">{{잔금 일자}}</span>&nbsp;에 지불한다.&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; (<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="잔금_금액" data-label="잔금 금액">{{잔금 금액}}</span>&nbsp;)</span></span></td></tr></tbody></table>
<!-- GENUINE_PAGE_BREAK -->
<p style="text-indent: -21px; padding-left: 21px;"><span style="font-size: 10pt;">제4조 양도인과 양수인이 악의로 임대인및 프랜차이즈 본사와 임대차계약 및 가맹계약을 체결하지 않거나, 임대차&nbsp;</span><span style="font-size: 13.3333px;">계약 및 가맹계약을 방해하거나, 이외 유사한 행위를 한 경우 또한 위약에 해당한다.</span></p><p><br></p>`
    }
];

// Simple migration runner
async function runMigration() {
    console.log('--- Starting Migration: Contract Templates ---');

    console.log('Seeding System Templates...');

    for (const t of SYSTEM_TEMPLATES) {
        const { error } = await supabase
            .from('contract_templates')
            .upsert({
                id: t.id,
                name: t.name,
                category: t.category,
                description: t.description,
                form_schema: t.form_schema,
                html_content: t.html_content,
                is_system: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            console.error(`Error seeding ${t.name}:`, error.message);
        } else {
            console.log(`Seeded: ${t.name}`);
        }
    }

    console.log('--- Migration Complete ---');
}

runMigration();
