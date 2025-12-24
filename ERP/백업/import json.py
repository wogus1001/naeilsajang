import json

def extract_network_info_from_har(har_file_path):
    with open(har_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    extracted_data = []

    # 'log.entries' 배열을 순회하며 요청 정보를 추출합니다.
    for entry in data['log']['entries']:
        # 1. 이름 (Name) - URL의 파일명 또는 경로
        # 보통 URL에서 가장 뒷부분만 가져와 표시합니다.
        url = entry['request']['url']
        name = url.split('/')[-1] if url.split('/')[-1] else url

        # 2. 상태 (Status) - HTTP 응답 코드
        status = entry['response']['status']

        # 3. 유형 (Type) - MIME Type에서 추출
        # Content-Type 헤더가 없으면 빈 문자열일 수 있습니다.
        mime_type = entry['response']['content'].get('mimeType', 'N/A')
        # 간단하게 주 유형만 추출 (예: 'image/png' -> 'png' 또는 'image')
        type_abbr = mime_type.split('/')[-1].split(';')[0].split(',')[0]
        
        # 4. 시작점 (Initiator) - 요청을 시작한 요소 (크롬 DevTools에서는 표시되나, HAR 스펙에는 명확한 필드가 없음)
        # 일반적으로는 request/response의 메타데이터를 사용하여 추정해야 합니다.
        # DevTools는 _initiator 필드를 사용하지만, 표준 HAR 스펙에는 없습니다.
        # 여기서는 단순히 'N/A' 또는 추정 가능한 필드를 사용합니다.
        initiator = entry.get('_initiator', {}).get('type', 'N/A') # 비표준 필드를 시도

        # 5. 크기 (Size) - 전송된 크기 (content.size는 인코딩된 크기, response.bodySize는 실제 크기)
        # 전송된 크기를 기준으로 합니다.
        size_bytes = entry['response']['_transferSize']

        # 6. 시간 (Time) - 요청이 시작되어 완료될 때까지 걸린 전체 시간 (밀리초)
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

# 사용 예시
# har_file_path = 'sajang.opentest.kr.har'
# results = extract_network_info_from_har(har_file_path)

# for item in results:
#     print(item)