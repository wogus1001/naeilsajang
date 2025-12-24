import json
import os
import pandas as pd # pandas 라이브러리 추가

def extract_network_info_from_har(har_file_path):
    """HAR 파일에서 요청 이름, 상태, 유형, 크기, 시간 정보를 추출합니다."""
    if not os.path.exists(har_file_path):
        print(f"❌ 오류: 파일을 찾을 수 없습니다. 경로를 확인해 주세요: {har_file_path}")
        return []
        
    try:
        with open(har_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError:
        print("❌ 오류: HAR 파일이 유효한 JSON 형식이 아닙니다. 파일이 손상되었을 수 있습니다.")
        return []

    extracted_data = []

    for entry in data['log']['entries']:
        # 1. 이름 (Name) - URL의 파일명 또는 경로
        url = entry['request']['url']
        name = url.split('/')[-1].split('?')[0] if url.split('/')[-1].split('?')[0] else url
        
        # 2. 상태 (Status) - HTTP 응답 코드
        status = entry['response']['status']
        
        # 3. 유형 (Type) - MIME Type에서 추출
        mime_type = entry['response']['content'].get('mimeType', 'N/A')
        type_abbr = mime_type.split('/')[-1].split(';')[0].split(',')[0]
        
        # 4. 시작점 (Initiator)
        initiator = entry.get('_initiator', {}).get('type', 'N/A')
        
        # 5. 크기 (Size) - 전송된 크기 (바이트)
        size_bytes = entry['response']['_transferSize']
        
        # 6. 시간 (Time) - 요청의 전체 소요 시간 (밀리초)
        time_ms = entry['time']

        extracted_data.append({
            '이름': name,
            '상태': status,
            '유형': type_abbr,
            '시작점': initiator,
            '크기 (Bytes)': size_bytes,
            '시간 (ms)': time_ms
        })
        
    return extracted_data

# -------------------- 실행 부분: 파일 경로 및 엑셀 저장 추가 --------------------

# 📌 HAR 파일 경로 (이전에 설정한 경로)
har_file_path = r'C:\Users\awmve\OneDrive\바탕 화면\my_project\sajang.opentest.kr.har'

# 📌 엑셀 파일 저장 경로 (HAR 파일과 같은 폴더에 저장됩니다.)
# 파일명을 원하는 대로 변경할 수 있습니다.
excel_file_path = os.path.join(os.path.dirname(har_file_path), 'network_analysis_results.xlsx')


print(f"HAR 파일을 분석 중입니다: {har_file_path}\n")

try:
    results = extract_network_info_from_har(har_file_path)

    if results:
        # Pandas DataFrame으로 변환
        df = pd.DataFrame(results)
        
        # 엑셀 파일로 저장 (index=False는 행 번호를 제외하는 옵션입니다.)
        df.to_excel(excel_file_path, index=False, engine='openpyxl')
        
        print(f"✅ 총 {len(results)}개의 요청을 성공적으로 추출했습니다.")
        print(f"✅ 결과가 다음 경로에 엑셀 파일로 저장되었습니다: {excel_file_path}")
    
    elif results == []:
        print("⚠️ 경고: HAR 파일에서 추출된 요청 목록이 없습니다. 파일 내용(log.entries)을 확인해 주세요.")

except Exception as e:
    print(f"\n❌ 코드 실행 중 예상치 못한 오류가 발생했습니다. 라이브러리 설치(pandas, openpyxl)를 확인해 주세요. 오류: {e}")