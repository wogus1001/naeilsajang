import pandas as pd
import random
from datetime import datetime, timedelta

# 한국식 이름과 주소 생성을 위한 데이터
names = ['김준호', '김서연', '김시우', '김소연', '김도윤', '김하윤', '김지은', '김지훈', '김예은', '김민준']
cities = ['서울시', '부산시', '대구시', '인천시', '광주시', '대전시', '울산시']
districts = ['강남구', '서구', '동구', '남구', '중구']
grades = ['프리미엄', '스탠다드', '일반']
statuses = ['활성', '종료', '취소']

# 양도자 데이터셋 생성 함수
def generate_yangdoja_data(product_codes, num_yangdoja=500):
    yangdoja_data = []
    for i in range(1, num_yangdoja + 1):
        yangdoja_id = f'YD{i:04d}'
        name = random.choice(names)
        city = random.choice(cities)
        district = random.choice(districts)
        address = f'{city} {district} {random.randint(1, 100)}번지'
        phone = f'010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}'
        email = f'{name.lower()}{random.randint(100, 999)}@example.com'
        product_code = random.choice(product_codes)
        start_date = datetime(2022, 1, 1)  # 양도 날짜는 양수보다 이전 (2022~2024)
        end_date = datetime(2024, 12, 31)
        days_diff = (end_date - start_date).days
        random_days = random.randint(0, days_diff)
        yangdo_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        grade = random.choice(grades)
        status = random.choice(statuses)
        amount = random.randint(100000, 5000000)  # 양도 금액: 10만~500만 원
        
        yangdoja_data.append([yangdoja_id, name, address, phone, email, product_code, yangdo_date, grade, status, amount])
    
    return pd.DataFrame(yangdoja_data, columns=['양도자ID', '이름', '주소', '연락처', '이메일', '양도제품코드', '양도날짜', '양도자 등급', '계약 상태', '양도 금액'])

# 양수자 데이터셋 생성 함수
def generate_yangsuja_data(product_codes, num_yangsuja=500):
    yangsuja_data = []
    for i in range(1, num_yangsuja + 1):
        yangsuja_id = f'YS{i:04d}'
        name = random.choice(names)
        city = random.choice(cities)
        district = random.choice(districts)
        address = f'{city} {district} {random.randint(1, 100)}번지'
        phone = f'010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}'
        email = f'{name.lower()}{random.randint(100, 999)}@example.com'
        product_code = random.choice(product_codes)
        start_date = datetime(2023, 1, 1)  # 양수 날짜: 2023~2024
        end_date = datetime(2024, 12, 31)
        days_diff = (end_date - start_date).days
        random_days = random.randint(0, days_diff)
        yangsu_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        grade = random.choice(grades)
        status = random.choice(statuses)
        amount = random.randint(100000, 5000000)  # 양수 금액: 10만~500만 원
        
        yangsuja_data.append([yangsuja_id, name, address, phone, email, product_code, yangsu_date, grade, status, amount])
    
    return pd.DataFrame(yangsuja_data, columns=['양수자ID', '이름', '주소', '연락처', '이메일', '양수제품코드', '양수날짜', '양수자 등급', '계약 상태', '양수 금액'])

# list.xlsx 파일 읽기
df_products = pd.read_excel('list.xlsx')

# 상품코드 추출
product_codes = df_products['상품코드'].tolist()

# 양도자 및 양수자 데이터셋 생성
df_yangdoja = generate_yangdoja_data(product_codes, num_yangdoja=500)
df_yangsuja = generate_yangsuja_data(product_codes, num_yangsuja=500)

# CSV 파일로 저장
df_yangdoja.to_csv('yangdoja.csv', index=False, encoding='utf-8-sig')
df_yangsuja.to_csv('yangsuja.csv', index=False, encoding='utf-8-sig')

print("양도자 데이터셋이 'yangdoja.csv' 파일로 저장되었습니다.")
print("양수자 데이터셋이 'yangsuja.csv' 파일로 저장되었습니다.")

# 상위 5개 데이터 미리보기
print("\n양도자 데이터셋 상위 5개:")
print(df_yangdoja.head())
print("\n양수자 데이터셋 상위 5개:")
print(df_yangsuja.head())

# 매칭: 양도자와 양수자를 상품코드를 기준으로 연결
# 여기서는 동일 상품코드를 가진 양도자와 양수자를 매칭 (1:1 매칭 예시)
merged_df = pd.merge(df_yangdoja, df_yangsuja, left_on='양도제품코드', right_on='양수제품코드', how='inner')
merged_df = pd.merge(merged_df, df_products, left_on='양도제품코드', right_on='상품코드', how='inner')

# 매칭 결과에서 주요 컬럼만 선택
result_df = merged_df[[
    '양도자ID', '양수자ID', '양도제품코드', '품명', '양도날짜', '양수날짜', 
    '양도자 등급', '양수자 등급', '계약 상태_x', '계약 상태_y', '양도 금액', '양수 금액'
]]

# 매칭 결과 CSV로 저장
result_df.to_csv('matched_yangdoja_yangsuja.csv', index=False, encoding='utf-8-sig')

print("\n매칭된 데이터가 'matched_yangdoja_yangsuja.csv' 파일로 저장되었습니다.")
print("\n매칭 결과 상위 5개:")
print(result_df.head())