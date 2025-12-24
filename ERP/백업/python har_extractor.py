import json
import os

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
        # URL의 마지막 부분을 이름으로 사용합니다.
        name = url.split('/')[-1].split('?')[0] if url.split('/')[-1].split('?')[0] else url
        if len(name) > 50: 
            name = name[:47] + '...'
        
        # 2. 상태 (Status) - HTTP 응답 코드
        status = entry['response']['status']
        
        # 3. 유형 (Type) - MIME Type에서 추출
        mime_type = entry['response']['content'].get('mimeType', 'N/A')
        type_abbr = mime_type.split('/')[-1].split(';')[0].split(',')[0]
        
        # 4. 시작점 (Initiator) - HAR 파일 내의 비표준 필드 (_initiator)에서 가져옴
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
            '크기 (bytes)': size_bytes,
            '시간 (ms)': time_ms
        })
        
    return extracted_data

# -------------------- 실행 부분: 파일 경로 수정됨 --------------------
# 📌 사용자가 알려준 정확한 절대 경로를 raw string (r'')으로 설정합니다.
har_file_path = r'C:\Users\awmve\OneDrive\바탕 화면\my_project\sajang.opentest.kr.har'

print(f"HAR 파일을 분석 중입니다: {har_file_path}\n")

try:
    results = extract_network_info_from_har(har_file_path)

    if results:
        # 헤더 출력
        header = f"{'이름':<50} {'상태':<8} {'유형':<10} {'시작점':<10} {'크기 (bytes)':<15} {'시간 (ms)':<10}"
        print(header)
        print("=" * len(header))
        
        # 결과 출력
        for item in results:
            print(
                f"{item['이름']:<50} "
                f"{item['상태']:<8} "
                f"{item['유형']:<10} "
                f"{item['시작점']:<10} "
                f"{item['크기 (bytes)']:<15} "
                f"{item['시간 (ms)']:<10}"
            )
        print(f"\n✅ 총 {len(results)}개의 요청을 성공적으로 처리했습니다.")
    elif results == []:
        print("⚠️ 경고: HAR 파일에서 추출된 요청 목록이 없습니다. 파일 내용(log.entries)을 확인해 주세요.")

except Exception as e:
    print(f"\n❌ 코드 실행 중 예상치 못한 오류가 발생했습니다: {e}")