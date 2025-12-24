import requests
import urllib.parse
import xml.etree.ElementTree as ET
import re
import csv
import sys
import time

# --- 설정 ---
API_KEY = "e9T9pUGmWkfF7HJW8BZH%2BFiHHi9AQo1pFvc55gAO"
BASE_URL = "https://franchise.ftc.go.kr/api/search.do"
OUTPUT_FILE = "franchise_full_list.csv"  # 파일명 변경 (전체 리스트)

# 서버 연결 설정
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def decode_key(key):
    return urllib.parse.unquote(key)

def clean_text(text):
    if not text: return ""
    text = text.replace('<br>', ' ').replace('</p>', ' ').replace('</tr>', ' ').replace('</td>', ' ')
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

# 🔥 [핵심 로직] 업종 텍스트 정제 (대분류 추출)
def refine_category(text):
    if not text: return "식별실패"
    
    # 1. 띄어쓰기가 포함된 대분류 예외 처리 (붙여쓰기로 변환)
    text = text.replace("기타 도소매", "기타도소매")
    text = text.replace("기타 서비스", "기타서비스")
    text = text.replace("기타 외식", "기타외식")
    text = text.replace("기타 교육", "기타교육")
    text = text.replace("도소매 (유통)", "도소매(유통)")
    
    # 2. 공백 기준으로 쪼개서 가장 앞 단어(대분류)만 가져옴
    return text.split()[0]

def extract_industry_final(full_text):
    if not full_text: return "내용없음"
    
    # 챕터 범위 한정
    chapter_match = re.search(r"3\.\s*\[.*?\]\s*업종(.*?)(?=\s4\.|4\.\s|바로 전)", full_text)
    target_text = full_text
    if chapter_match:
        target_text = chapter_match.group(1)

    # 패턴 매칭 및 결과 정제
    
    # Pattern A
    pattern_a = r"소분류\s*\(.*?주요상품.*?\)\s*(.*?)(?=\s\d+\.|단위|4\.|지역|$)"
    match = re.search(pattern_a, target_text)
    if match: 
        return refine_category(match.group(1).strip())

    # Pattern B
    pattern_b = r"가맹사업의 종류\s*[:;]?\s*(.*?)(?=\s\d+\.|단위|4\.|$)"
    match = re.search(pattern_b, target_text)
    if match: 
        return refine_category(match.group(1).strip())

    # Pattern C
    pattern_c = r"업종\s+([가-힣]+)\s+(대분류|소분류)"
    match = re.search(pattern_c, target_text)
    if match: 
        return refine_category(match.group(1).strip())

    return "식별실패"

def run_full_crawler():
    service_key = decode_key(API_KEY)
    
    print(f"--- 🚀 전체 수집 시작: {OUTPUT_FILE}에 저장합니다 ---")
    print("--- ⚠️  데이터 양이 많아 시간이 소요됩니다. 중단하려면 Ctrl+C를 누르세요. ---")
    
    # 파일 열기 (쓰기 모드)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['일련번호', '브랜드명', '상호(법인명)', '추출된_업종'])

        page_no = 1
        total_collected = 0
        
        while True: # 무한 루프 (데이터 끝날 때까지)
            params = {
                'type': 'list', 
                'yr': '2023', 
                'serviceKey': service_key,
                'viewType': 'xml', 
                'pageNo': str(page_no), 
                'numOfRows': '50' # 한 페이지당 50개씩 요청 (속도 향상)
            }
            
            try:
                # 리스트 요청
                res = requests.get(BASE_URL, params=params, headers=HEADERS)
                if res.status_code != 200:
                    print(f"\n[페이지 {page_no}] 요청 실패. 상태 코드: {res.status_code}")
                    break

                root = ET.fromstring(res.text)
                items = root.findall('.//item')
                
                # 종료 조건: 해당 페이지에 아이템이 없으면 끝
                if not items:
                    print(f"\n\n🏁 [수집 완료] 더 이상 데이터가 없습니다. (총 {total_collected}개)")
                    break
                
                # 아이템 순회
                for item in items:
                    sn = item.findtext('jngIfrmpSn')
                    brand = item.findtext('brandNm')
                    corp = item.findtext('corpNm')
                    
                    # 상세 내용 요청 (content)
                    c_params = {'type': 'content', 'jngIfrmpSn': sn, 'serviceKey': service_key, 'viewType': 'xml'}
                    
                    industry = "조회실패" # 기본값
                    try:
                        c_res = requests.get(BASE_URL, params=c_params, headers=HEADERS, timeout=10)
                        if c_res.status_code == 200:
                            # 업종 추출 및 정제 실행
                            industry = extract_industry_final(clean_text(c_res.text))
                    except Exception:
                        industry = "타임아웃"

                    # CSV 쓰기
                    writer.writerow([sn, brand, corp, industry])
                    total_collected += 1
                    
                    # 진행 상황 출력
                    sys.stdout.write(f"\r[P.{page_no}] 누적 {total_collected}개 | {brand[:8]:<10} -> {industry}")
                    sys.stdout.flush()
                
                # 다음 페이지로 이동
                page_no += 1
                # time.sleep(0.5) # 페이지 넘김 간격 (서버 보호용)

            except Exception as e:
                print(f"\n[치명적 오류 발생] {e}")
                print("진행 내용을 저장하고 종료합니다.")
                break

if __name__ == "__main__":
    run_full_crawler()