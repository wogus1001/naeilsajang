
# AI 매물검색 성능 측정 – v3 파이프라인

## 1) 입력 파일
- `/mnt/data/raw.xlsx` : 최신 원천 매물 데이터 (Sheet1)
- `/mnt/data/문의사항_답변.xlsx` : 매핑 테이블(main_category, sub_category, adm_code)
- `/mnt/data/raw_info.xlsx` : 컬럼 설명 문서(참고)

## 2) 생성되는 파일
- `/mnt/data/mapping_config.json` : 카테고리/행정동 매핑 JSON
- `/mnt/data/ground_truth_set_v7.csv` : 최신 규격의 Ground Truth (payload_json 포함)
- `/mnt/data/ai_metric_log_all.csv` : 측정 결과 로그

## 3) 실행 순서
1) (이미 수행됨) 매핑 JSON 생성: `mapping_config.json`
2) Ground Truth 생성
```bash
cd /mnt/data
python build_ground_truth_from_raw_v7.py
```
3) 성능 측정
```bash
# Windows PowerShell 예시
setx AI_SAJANG_JWT "<JWT_토큰값>"
python /mnt/data/ai_metrics_full_pipeline_v3.py /mnt/data/ground_truth_set_v7.csv
```
또는
```bash
# macOS/Linux
export AI_SAJANG_JWT="<JWT_토큰값>"
python /mnt/data/ai_metrics_full_pipeline_v3.py /mnt/data/ground_truth_set_v7.csv
```

## 4) payload_json 규격 (요약)
```json
{
  "totalAmount": <int, 만원>,
  "monthlyAvgSales": "ANY" | "3천만원 이하" | "3천~7천만원" | "7천만원~1억원" | "1억원 이상",
  "mainCategoryId": [],
  "subCategoryId": [<int>],
  "isFranchise": 0 | 1,
  "address": {"sidoName":"서울","gunName":"종로구","dongName":"사직동"},
  "exclusiveArea": "ANY" | "10평 이하" | "10~20평" | "20~30평" | "30~40평" | "40평 이상",
  "option": ["직원 승계 가능","양도 즉시가능", "영업기간 1년 이상" ...],
  "categoryLabel": "제과제빵",
  "isPremiumPayment": 0 | 1
}
```

## 5) 주의 사항
- `topK / includeSelf / excludeSelf / *Label` 필드는 서버 미지원 가능성이 있어 요청에서 제거했습니다.
- `totalAmount`는 `takeover_amount`가 존재하면 이를 우선 사용, 없으면 `premium + deposit` 합을 사용하며 **만원 단위**로 보정합니다.
- `monthlyAvgSales`는 원 단위 값을 구간 라벨로 자동 변환합니다.
- `exclusiveArea`는 ㎡ → 평 변환 후 구간 라벨로 매핑합니다.
- 주소는 `address` 전체 문자열에서 시/군구/동을 유추합니다(adm_code를 함께 활용). 동명이 식별되지 않으면 공백으로 둡니다.

## 6) 파일 링크
- [mapping_config.json](sandbox:/mnt/data/mapping_config.json)
- [build_ground_truth_from_raw_v7.py](sandbox:/mnt/data/build_ground_truth_from_raw_v7.py)
- [ai_metrics_full_pipeline_v3.py](sandbox:/mnt/data/ai_metrics_full_pipeline_v3.py)
- [ground_truth_set_v7.csv](sandbox:/mnt/data/ground_truth_set_v7.csv)
