import csv
import random
import uuid
from datetime import datetime

# 카테고리 설정 (다양성 확보)
categories = [
    {"대카테고리": "주방장비/렌탈/양도양수", "중카테고리": ["양도양수", "렌탈서비스", "계약관리"], 
     "소카테고리": ["오븐", "냉장고", "식기세척기", "믹서", "커피머신", "전자레인지", "그릴", "제빙기"]},
    {"대카테고리": "주방기기/상업용", "중카테고리": ["상업용기기", "렌탈서비스", "유지보수"], 
     "소카테고리": ["스팀오븐", "냉장고", "식기세척기", "제빙기", "커피머신", "그릴", "블렌더"]},
    {"대카테고리": "주방기기/가정용", "중카테고리": ["가정용기기", "렌탈서비스", "양도양수"], 
     "소카테고리": ["전자레인지", "토스터", "주서기", "믹서", "커피머신", "오븐", "블렌더"]},
    {"대카테고리": "렌탈서비스/계약관리", "중카테고리": ["계약관리", "렌탈서비스", "양도양수"], 
     "소카테고리": ["렌탈계약", "양도", "냉장고", "오븐", "식기세척기", "커피머신", "제빙기"]},
    {"대카테고리": "주방장비/유지보수", "중카테고리": ["유지보수", "렌탈서비스", "상업용기기"], 
     "소카테고리": ["오븐", "냉장고", "식기세척기", "믹서", "커피머신", "스팀오븐", "그릴"]}
]
brands = ["키친에이드", "삼성", "LG", "네스프레소", "보쉬", "쿠진아트", "브레빌", "델롱기"]
origins = ["대한민국", "미국", "독일", "중국", "수입산_아시아_중국", "일본", "이탈리아"]
delivery_methods = ["직배송", "렌탈배송", "택배, 소포, 등기", "화물배송"]
delivery_fee_types = ["유료", "수량별", "무료"]
product_statuses = ["신상품", "중고상품", "렌탈상품"]

# CSV 헤더 (원본 데이터 구조 유지)
headers = [
    "상품상태", "카테고리ID", "상품명", "판매가", "재고수량", "대표 이미지 파일명", "상품 상세정보",
    "판매자 상품코드", "제조사", "브랜드", "부가세", "원산지 직접입력", "배송방법", "배송비 유형",
    "기본배송비", "배송비 결제방식", "반품배송비", "교환배송비", "지역별 차등배송비 정보", "옵션형태",
    "대카테고리", "중카테고리", "소카테고리"
]

# 랜덤 문자열 생성 함수
def random_string(length):
    import string
    letters = string.ascii_letters
    return ''.join(random.choice(letters) for i in range(length))

# 1000건 데이터 생성
data = []
for i in range(1000):
    category = random.choice(categories)
    중카테고리 = random.choice(category["중카테고리"])
    소카테고리 = random.choice(category["소카테고리"])
    brand = random.choice(brands)
    origin = random.choice(origins)
    product_status = random.choice(product_statuses)
    delivery_method = random.choice(delivery_methods)
    delivery_fee_type = random.choice(delivery_fee_types)
    
    # 상품명 생성
    product_type = 소카테고리
    product_name = f"{product_type} {'스탠다드' if random.random() > 0.3 else '프리미엄'} {random.randint(1000, 9999)}"
    if product_status == "렌탈상품":
        product_name = f"렌탈 {product_name}"
    elif random.random() > 0.5:
        product_name = f"양도양수 {product_name}"
    
    # 상품 상세정보 HTML
    rental_period = random.randint(1, 5)
    specs = {
        "오븐": "220V, 소비전력 3.5kW, 크기 1200x800x600mm",
        "냉장고": "220V, 소비전력 2.0kW, 크기 1800x900x800mm",
        "식기세척기": "220V, 소비전력 1.8kW, 크기 600x600x850mm",
        "믹서": "220V, 소비전력 0.5kW, 크기 200x200x400mm",
        "커피머신": "220V, 소비전력 1.2kW, 크기 300x400x400mm",
        "전자레인지": "220V, 소비전력 1.0kW, 크기 500x300x300mm",
        "그릴": "220V, 소비전력 2.5kW, 크기 700x400x200mm",
        "제빙기": "220V, 소비전력 1.5kW, 크기 600x500x800mm",
        "주서기": "220V, 소비전력 0.8kW, 크기 250x250x400mm",
        "토스터": "220V, 소비전력 0.9kW, 크기 300x200x200mm",
        "스팀오븐": "220V, 소비전력 3.8kW, 크기 1200x800x700mm",
        "블렌더": "220V, 소비전력 0.7kW, 크기 200x200x450mm",
        "렌탈계약": "렌탈 계약서, 계약 기간 1-5년",
        "양도": "양도양수 계약서, 계약 양도 가능"
    }
    product_details = (
        f'<p>주방 장비 렌탈 및 양도양수 관련 상세 정보. 렌탈 기간: {rental_period}년, '
        f'양도 조건: 계약 양도 가능.</p><br><img src="https://example.com/img.jpg" />'
        f'<div>제품 사양: {product_type}, {specs[product_type]}</div>'
    )
    
    # 데이터 행 생성
    row = {
        "상품상태": product_status,
        "카테고리ID": random.randint(50000000, 59999999),
        "상품명": product_name,
        "판매가": random.randint(50000, 5000000),
        "재고수량": random.randint(10, 1000),
        "대표 이미지 파일명": f"{random.randint(1000000000, 9999999999)}_{random_string(10)}_{int(datetime.now().timestamp())}_img{random.randint(10, 99)}.jpg",
        "상품 상세정보": product_details,
        "판매자 상품코드": f"CH{random.randint(1000000, 9999999)}",
        "제조사": brand,
        "브랜드": brand,
        "부가세": "과세상품",
        "원산지 직접입력": origin,
        "배송방법": delivery_method,
        "배송비 유형": delivery_fee_type,
        "기본배송비": random.choice([0, 3000, 5000, 10000, 12000, 15000]),
        "배송비 결제방식": "착불 또는 선결제" if delivery_fee_type != "무료" else "선결제",
        "반품배송비": random.choice([0, 3000, 5000, 10000, 15000]),
        "교환배송비": random.choice([0, 6000, 10000, 20000, 30000]),
        "지역별 차등배송비 정보": "제주배송비: 3000 / 도서산간배송비: 5000",
        "옵션형태": "조합형",
        "대카테고리": category["대카테고리"],
        "중카테고리": 중카테고리,
        "소카테고리": 소카테고리
    }
    data.append(row)

# CSV 파일로 저장
with open("kitchen_equipment_rental_transfer_1000.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(data)

print("CSV file 'kitchen_equipment_rental_transfer_1000.csv' has been generated successfully.")