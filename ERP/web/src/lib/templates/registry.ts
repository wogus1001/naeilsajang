import { createClient } from '@/utils/supabase/client';
import { ContractTemplate } from '@/types/contract-core';

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
    {
        id: 't-transfer-agreement',
        name: '사업체 양도양수 계약서',
        category: '사업체 양도양수',
        description: '표준 권리금 계약서 양식입니다.',
        formSchema: [
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
        htmlTemplate: `<h3 style="text-align: center;"><span style="font-size: 18pt;">사업체 양도양수 계약서</span></h3><p><span style="font-size: 10pt;">본 계약은 현재 사업체의 영업및 시설에 관한 제반권리(영업권)를 양도ㆍ양수 하는 계약임</span></p><p><b><span style="font-size: 10pt;">1. 대상물의 표시</span></b></p><p style="text-align: left;"><span style="font-size: 10pt;">&nbsp; 주&nbsp; &nbsp; &nbsp; 소&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="주소" data-label="주소">{{주소}}</span>&nbsp;</span></p><p><span style="font-size: 10pt;">&nbsp; 상&nbsp; &nbsp; &nbsp; 호&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="상호" data-label="상호">{{상호}}</span>&nbsp;</span></p><p><span style="font-size: 10pt;">&nbsp; 업&nbsp; &nbsp; &nbsp; 종&nbsp; &nbsp;:&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="업종" data-label="업종">{{업종}}</span>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;임대면적&nbsp; :&nbsp;&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="임대면적" data-label="임대면적">{{임대면적}}</span>&nbsp;m²(공유면적포함)</span></p><p><span style="font-size: 10pt;">양수인은 상기 사업체를 직접 현장 확인을 통해 실내ㆍ외면적을 확인하였고, 임대면적은 공유면적, 주차, 서비스 면적등 포함여부 및 임대인 성향에 따라 면적차이가 있기에 본 계약서 작성 후 쌍방은 임대면적과 전용면적의 차이가 있다고 하여 계약을 해제할 수 없으며, 이것을 이유로 쌍방은 추후 이의를 제기 할 수 없다.</span></p><p><b><span style="font-size: 10pt;">2. 계약내용</span></b></p><p><span style="font-size: 10pt;">제1조 양수인은 위 사업체에 대해 영업 권리를 양도인에게 아래와 같이 지불 하기로 한다.</span></p><table style="margin-top: 10px; margin-bottom: 10px;"><tbody><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: col-resize; width: 119.67px;"><span style="font-size: 10pt;">&nbsp;총 영업 권리금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="currency" data-key="총_영업_권리금" data-label="총 영업 권리금">{{총 영업 권리금}}</span>&nbsp; &nbsp; )</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;계약금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정은 계약 시 (<span class="contract-variable" data-type="variable" data-var-type="date" data-key="계약_일자" data-label="계약 일자">{{계약 일자}}</span>&nbsp;에 지불함.&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;&nbsp; <span class="contract-variable" data-type="variable" data-var-type="text" data-key="계약_금액" data-label="계약 금액">{{계약 금액}}</span>&nbsp;&nbsp;))</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;중도금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 원정은&nbsp;<span class="contract-variable" data-type="variable" data-var-type="date" data-key="중도금_일자" data-label="중도금 일자">{{중도금 일자}}</span>&nbsp;에 지불하며,&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;(<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="중도금_금액" data-label="중도금 금액">{{중도금 금액}}</span>&nbsp;)</span></span></td></tr><tr><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">&nbsp;잔금</span></td><td style="border-color: rgb(221, 221, 221); padding: 8px; cursor: text;"><span style="font-size: 10pt;">일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정은&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="잔금_일자" data-label="잔금 일자">{{잔금 일자}}</span>&nbsp;에 지불한다.&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; (<span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;;">￦&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="잔금_금액" data-label="잔금 금액">{{잔금 금액}}</span>&nbsp;)</span></span></td></tr></tbody></table><p style="text-indent: -21px; padding-left: 21px;"><span style="font-size: 10pt;">제4조 양도인과 양수인이 악의로 임대인및 프랜차이즈 본사와 임대차계약 및 가맹계약을 체결하지 않거나, 임대차&nbsp;</span><span style="font-size: 13.3333px;">계약 및 가맹계약을 방해하거나, 이외 유사한 행위를 한 경우 또한 위약에 해당한다.</span></p><p><br></p>`
    },
    {
        id: 't-special-terms',
        name: '특약서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '업종', label: '업종', type: 'text', placeholder: '업종을(를) 입력하세요' },
            { key: '상호', label: '상호', type: 'text', placeholder: '상호을(를) 입력하세요' },
            { key: '보증금', label: '보증금', type: 'currency', placeholder: '보증금을(를) 입력하세요' },
            { key: '월_임대료', label: '월 임대료', type: 'currency', placeholder: '월 임대료을(를) 입력하세요' },
            { key: '관리비', label: '관리비', type: 'currency', placeholder: '관리비을(를) 입력하세요' },
            { key: '부가세', label: '부가세', type: 'currency', placeholder: '부가세을(를) 입력하세요' },
            { key: '가맹비', label: '가맹비', type: 'text', placeholder: '가맹비을(를) 입력하세요' },
            { key: '물품보증금', label: '물품보증금', type: 'text', placeholder: '물품보증금을(를) 입력하세요' },
            { key: '로열티', label: '로열티', type: 'text', placeholder: '로열티을(를) 입력하세요' },
            { key: '기타', label: '기타', type: 'text', placeholder: '기타을(를) 입력하세요' }
        ],
        htmlTemplate: `<h3 style="text-align: center;"><span style="font-size: 18pt;">특약서</span></h3><p><span style="font-size: 10pt;">1. 양수인은 본 점포(대상물)에서</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp;업&nbsp; 종 :&nbsp; &nbsp;</span>{{업종}}<span style="font-size: 10pt;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp;상&nbsp; 호 :&nbsp; &nbsp;</span>{{상호}}<span style="font-size: 10pt;">&nbsp; &nbsp; 을(를) 운영 할 목적으로 계약함.&nbsp;</span></p><p><span style="font-size: 10pt;">2. 추후 양수인 명의로 임대차 재계약 시 계약기간은 잔여기간 승계를 원칙으로 한다.</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp;단, 별도 약정시 재계약 기간은&nbsp; &nbsp; &nbsp; &nbsp;개월로 정한다.</span></p><p><span style="font-size: 10pt;">3. 추후 양수인의 임대차 조건은&nbsp; &nbsp;보증금&nbsp;&nbsp;</span><span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;; letter-spacing: normal; word-spacing: 0px;"><span style="font-size: 15px;">￦&nbsp;</span>{{보증금}}<span style="font-size: 15px;">&nbsp;&nbsp;</span></span><span style="font-size: 10pt;">만원 (일금</span><span style="font-size: 13.3333px;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;</span><span style="font-size: 13.3333px;">&nbsp;</span><span style="font-size: 10pt;">원정)</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;월임대료&nbsp; &nbsp;</span><span style="color: rgb(17, 17, 17); font-family: Roboto, &quot;Noto Sans KR&quot;, 나눔고딕, &quot;Nanum Gothic&quot;, &quot;Malgun Gothic&quot;, 맑은고딕, 굴림, 돋움, Dotum, &quot;sans-serif&quot;; letter-spacing: normal; word-spacing: 0px;"><span style="font-size: 15px;">￦&nbsp;</span>{{월_임대료}}<span style="font-size: 15px;">&nbsp;&nbsp;</span></span><span style="font-size: 10pt;">만원 (일금&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;원정)</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;관리비&nbsp; (</span>{{관리비}}<span style="font-size: 10pt;">)</span></p><p><span style="font-size: 10pt;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;부가세&nbsp; (&nbsp;</span>{{부가세}}<span style="font-size: 10pt;">) 임을 예상 후 계약함.</span></p><p style="text-indent: -21px; padding-left: 21px;"><span style="font-size: 10pt;">4. 추후 양수인 명의로 임대차 재계약 시 보증금 및 임대료 인상 변동이 있을 경우&nbsp;인상되는 금액의<u>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;</u>개월 치를 계산하여<u>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;</u>이(가) 부담하기로 한다. (보증금 인상시 월 1부 계산)&nbsp;만약, 터무니 없는 인상으로 쌍방이 합의 할 수 없을 경우 발생시 위약금 없이 해약 할 수 있다.</span></p>`
    },
    {
        id: 't-transfer-request',
        name: '사업체 양도양수 의뢰계약서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '갑', label: '갑', type: 'text', placeholder: '갑 을(를) 입력하세요' },
            { key: '을', label: '을', type: 'text', placeholder: '을 을(를) 입력하세요' },
            { key: '병', label: '병', type: 'text', placeholder: '병 을(를) 입력하세요' },
            { key: '날짜', label: '날짜', type: 'date', placeholder: '날짜 을(를) 입력하세요' },
            { key: '갑_주소', label: '갑 주소', type: 'text', placeholder: '갑 주소 을(를) 입력하세요' },
            { key: '갑_사업자등록번호', label: '갑 사업자등록번호', type: 'text', placeholder: '갑 사업자등록번호 을(를) 입력하세요' },
            { key: '갑_연락처', label: '갑 연락처', type: 'text', placeholder: '갑 연락처 을(를) 입력하세요' },
            { key: '갑_상호', label: '갑 상호', type: 'text', placeholder: '갑 상호 을(를) 입력하세요' },
            { key: '을_주소', label: '을 주소', type: 'text', placeholder: '을 주소 을(를) 입력하세요' },
            { key: '을_주민번호', label: '을 주민번호', type: 'text', placeholder: '을 주민번호 을(를) 입력하세요' },
            { key: '을_연락처', label: '을 연락처', type: 'text', placeholder: '을 연락처 을(를) 입력하세요' },
            { key: '을_성명', label: '을 성명', type: 'text', placeholder: '을 성명 을(를) 입력하세요' },
            { key: '병_주소', label: '병 주소', type: 'text', placeholder: '병 주소 을(를) 입력하세요' },
            { key: '병_주민번호', label: '병 주민번호', type: 'text', placeholder: '병 주민번호 을(를) 입력하세요' },
            { key: '병_연락처', label: '병 연락처', type: 'text', placeholder: '병 연락처 을(를) 입력하세요' },
            { key: '병_성명', label: '병 성명', type: 'text', placeholder: '병 성명 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h3 style="text-align: center; margin-bottom: 5px;">사업체 양도양수 의뢰계약서</h3><p><span style="font-size: 10pt;">본 계약은 영업권(권리금)계약이며, 영업권은 유ㆍ무형의 자산임을 인지한다.</span></p><p style="line-height: 1; margin-bottom: 0px;"><span style="font-size: 10pt;">"갑" 표시 :&nbsp;</span><font style="font-size: 10pt;"><span class="contract-variable" data-type="variable" data-var-type="text" data-key="갑" data-label="갑">{{갑}}</span>&nbsp;</font></p><p><font style="font-size: 10pt;">"을</font><font style="font-size: 10pt;"><font style="">" 표시 :&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="을" data-label="을">{{을}}</span></font>&nbsp;</font></p><p><font style="font-size: 10pt;">"병" 표시 :&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="병" data-label="병">{{병}}</span>&nbsp;</font><span style="font-size: 13.3333px;"></span></p>`
    },
    {
        id: 't-object-confirm',
        name: '대상물 확인, 설명서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '대상물', label: '대상물', type: 'text', placeholder: '대상물 을(를) 입력하세요' },
            { key: '소재지', label: '소재지', type: 'text', placeholder: '소재지 을(를) 입력하세요' },
            { key: '날짜', label: '날짜', type: 'text', placeholder: '날짜 을(를) 입력하세요' },
            { key: '물건제공주', label: '물건제공주', type: 'text', placeholder: '물건제공주 을(를) 입력하세요' },
            { key: '창업주', label: '창업주', type: 'text', placeholder: '창업주 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h1 style="text-align: center;"><font style="font-size: 16pt;">대상물 확인, 설명서</font></h1><p><span style="font-size: 10pt;">대&nbsp; 상&nbsp; 물&nbsp; :&nbsp;&nbsp;</span><span class="contract-variable" data-type="variable" data-var-type="text" data-key="대상물" data-label="대상물" style="margin: 0px 2px; font-weight: 500; display: inline;"><font style="font-size: 12pt;">{{대상물}}</font></span><span style="font-size: 10pt;">&nbsp;</span></p><p><font style=""><span style="font-size: 10pt;">소&nbsp; 재&nbsp; 지&nbsp; :&nbsp;&nbsp;</span><span class="contract-variable" data-type="variable" data-var-type="text" data-key="소재지" data-label="소재지" style="margin: 0px 2px; font-weight: 500; display: inline;"><font style="font-size: 12pt;">{{소재지}}</font></span><span style="font-size: 10pt;">&nbsp;</span></font></p>`
    },
    {
        id: 't-pre-agreement',
        name: '사업체 권리양수도 (가)계약서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '대상명', label: '대상명', type: 'text', placeholder: '대상명 을(를) 입력하세요' },
            { key: '소재지', label: '소재지', type: 'text', placeholder: '소재지 을(를) 입력하세요' },
            { key: '계약금', label: '계약금', type: 'text', placeholder: '계약금 을(를) 입력하세요' },
            { key: '계약날짜', label: '계약날짜', type: 'date', placeholder: '계약날짜 을(를) 입력하세요' },
            { key: '창업주', label: '창업주', type: 'text', placeholder: '창업주 을(를) 입력하세요' },
            { key: '주민번호', label: '주민번호', type: 'text', placeholder: '주민번호 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h1 style="text-align: center;"><font style="font-size: 14pt;">사업체 권리양수도 (가)계약서</font></h1><p><font style="font-size: 10pt;">대&nbsp; 상&nbsp; 명&nbsp; :&nbsp;&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="대상명" data-label="대상명">{{대상명}}</span>&nbsp;</font></p><p><font style="font-size: 10pt;">소&nbsp; 재&nbsp; 지&nbsp; :&nbsp;&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="소재지" data-label="소재지">{{소재지}}</span>&nbsp;</font></p>`
    },
    {
        id: 't-success-fee',
        name: '성과보수 (양도용역비) 약정서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '상호', label: '상호', type: 'text', placeholder: '상호 을(를) 입력하세요' },
            { key: '주소', label: '주소', type: 'text', placeholder: '주소 을(를) 입력하세요' },
            { key: '임대보증금', label: '임대보증금', type: 'currency', placeholder: '임대보증금 을(를) 입력하세요' },
            { key: '월세', label: '월세', type: 'currency', placeholder: '월세 을(를) 입력하세요' },
            { key: '총_영업권리금', label: '총 영업권리금', type: 'currency', placeholder: '총 영업권리금 을(를) 입력하세요' },
            { key: '성과보수', label: '성과보수', type: 'currency', placeholder: '성과보수 을(를) 입력하세요' },
            { key: '날짜', label: '날짜', type: 'date', placeholder: '날짜 을(를) 입력하세요' },
            { key: '양도인_주소', label: '양도인 주소', type: 'text', placeholder: '양도인 주소 을(를) 입력하세요' },
            { key: '양도인_주민번호', label: '양도인 주민번호', type: 'text', placeholder: '양도인 주민번호 을(를) 입력하세요' },
            { key: '양도인_연락처', label: '양도인 연락처', type: 'text', placeholder: '양도인 연락처 을(를) 입력하세요' },
            { key: '양도인_성명', label: '양도인 성명', type: 'text', placeholder: '양도인 성명 을(를) 입력하세요' },
            { key: '지급보증인_주민번호', label: '지급보증인 주민번호', type: 'text', placeholder: '지급보증인 주민번호 을(를) 입력하세요' },
            { key: '지급보증인_성명', label: '지급보증인 성명', type: 'text', placeholder: '지급보증인 성명 을(를) 입력하세요' },
            { key: '지급보증인_주소', label: '지급보증인 주소', type: 'text', placeholder: '지급보증인 주소 을(를) 입력하세요' },
            { key: '지급보증인_연락처', label: '지급보증인 연락처', type: 'text', placeholder: '지급보증인 연락처 을(를) 입력하세요' },
            { key: '양도인주소', label: '양도인주소', type: 'text', placeholder: '양도인주소 을(를) 입력하세요' },
            { key: '양도인주민번호', label: '양도인주민번호', type: 'text', placeholder: '양도인주민번호 을(를) 입력하세요' },
            { key: '양도인연락처', label: '양도인연락처', type: 'text', placeholder: '양도인연락처 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h1 style="text-align: center;"><font style="font-size: 14pt;">성과보수 (양도용역비) 약정서</font></h1><p><font style=""><span style="font-size: 10pt;">상&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;호&nbsp; :&nbsp;&nbsp;</span><span class="contract-variable" data-type="variable" data-var-type="text" data-key="상호" data-label="상호" style="margin: 0px 2px; font-weight: 500; display: inline;"><font style="font-size: 10pt;">{{상호}}</font></span><span style="font-size: 10pt;">&nbsp;</span></font></p><p><font style="font-size: 10pt;">주&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;소&nbsp; :&nbsp; &nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="주소" data-label="주소" style="margin: 0px 2px; font-weight: 500; display: inline;">{{주소}}</span>&nbsp;</font></p>`
    },
    {
        id: 't-agreement',
        name: '약정서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '날짜', label: '날짜', type: 'date', placeholder: '날짜 을(를) 입력하세요' },
            { key: '성명', label: '성명', type: 'text', placeholder: '성명 을(를) 입력하세요' },
            { key: '주소', label: '주소', type: 'text', placeholder: '주소 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h1 style="text-align: center;">사업체 양도</h1><p><br></p><p>-사업체 양수도의 표시</p><p><br></p>`
    },
    {
        id: 't-sales-check',
        name: '매출확인서',
        category: '사업체 양도양수',
        description: '사용자 정의 템플릿',
        formSchema: [
            { key: '상호', label: '상호', type: 'text', placeholder: '상호 을(를) 입력하세요' },
            { key: '소재지', label: '소재지', type: 'text', placeholder: '소재지 을(를) 입력하세요' },
            { key: '주관회사_명', label: '주관회사 명', type: 'text', placeholder: '주관회사 명 을(를) 입력하세요' },
            { key: '날짜', label: '날짜', type: 'date', placeholder: '날짜 을(를) 입력하세요' },
            { key: '양도인주소', label: '양도인주소', type: 'text', placeholder: '양도인주소 을(를) 입력하세요' },
            { key: '양도인주민번호', label: '양도인주민번호', type: 'text', placeholder: '양도인주민번호 을(를) 입력하세요' },
            { key: '양도인성명', label: '양도인성명', type: 'text', placeholder: '양도인성명 을(를) 입력하세요' },
            { key: '양수인주소', label: '양수인주소', type: 'text', placeholder: '양수인주소 을(를) 입력하세요' },
            { key: '양수인_주민번호', label: '양수인 주민번호', type: 'text', placeholder: '양수인 주민번호 을(를) 입력하세요' },
            { key: '양수인성명', label: '양수인성명', type: 'text', placeholder: '양수인성명 을(를) 입력하세요' },
            { key: '주관회사주소', label: '주관회사주소', type: 'text', placeholder: '주관회사주소 을(를) 입력하세요' },
            { key: '주관회사사업자번호', label: '주관회사사업자번호', type: 'text', placeholder: '주관회사사업자번호 을(를) 입력하세요' },
            { key: '주관회사_전화번호', label: '주관회사 전화번호', type: 'text', placeholder: '주관회사 전화번호 을(를) 입력하세요' },
            { key: '주관회사상호', label: '주관회사상호', type: 'text', placeholder: '주관회사상호 을(를) 입력하세요' },
            { key: '계약주관담당자', label: '계약주관담당자', type: 'text', placeholder: '계약주관담당자 을(를) 입력하세요' }
        ],
        htmlTemplate: `<h1 style="text-align: center;">매 출 확 인 서</h1><p>상&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;호&nbsp; :&nbsp;&nbsp;<span class="contract-variable" data-type="variable" data-var-type="text" data-key="상호" data-label="상호" style="margin: 0px 2px; font-weight: 500; display: inline;">{{상호}}</span>&nbsp;</p>`
    }
];

// Helper to get ALL templates (static + user saved)
export const getAllTemplates = (): ContractTemplate[] => {
    if (typeof window === 'undefined') return CONTRACT_TEMPLATES;

    // Global templates from code
    const defaults = CONTRACT_TEMPLATES;

    // User saves templates from Builder (stored in localStorage)
    const stored = localStorage.getItem('custom_templates');
    const customs = stored ? JSON.parse(stored) : [];

    return [...defaults, ...customs];
};

export const getTemplateById = (id: string): ContractTemplate | undefined => {
    return getAllTemplates().find(t => t.id === id);
};

// Async helper to fetch from API + LocalStorage
export const fetchCombinedTemplates = async (): Promise<ContractTemplate[]> => {
    if (typeof window === 'undefined') return CONTRACT_TEMPLATES;

    // 1. Fetch from DB
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
            console.error('Failed to fetch templates from API');
        }
    } catch (e) {
        console.error('Error fetching templates:', e);
    }

    // 2. Fetch from LocalStorage
    const stored = localStorage.getItem('custom_templates');
    const localTemplates = stored ? JSON.parse(stored) : [];

    // 3. Merge (DB takes precedence)
    const uniqueLocal = localTemplates.filter((l: ContractTemplate) => !dbTemplates.find(d => d.id === l.id));

    // If DB fetch failed completely (network error), fallback to static system templates?
    // We already have dbTemplates empty if failed.
    // We should probably inject CONTRACT_TEMPLATES (static) if DB fetch yielded nothing AND we suspect failure?
    // But maybe DB is empty initially?
    // The seed script ensures it's not empty. 
    // If fetch failed, dbTemplates is []. 
    // We should allow fallback to CONTRACT_TEMPLATES for robustness, but prioritize DB.

    if (dbTemplates.length === 0) {
        // Fallback to static if DB is empty/unreachable (optional safety)
        const staticTemplates = CONTRACT_TEMPLATES;
        // Filter local against static
        const uniqueLocalStatic = localTemplates.filter((l: ContractTemplate) => !staticTemplates.find(d => d.id === l.id));

        // However, if DB worked but is empty (unlikely), we shouldn't overwrite.
        // Let's assume if fetch throws, we use static.
        // We'll leave it simple: DB + Local. Static is legacy.
    }

    return [...dbTemplates, ...uniqueLocal];
};
