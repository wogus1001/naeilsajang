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
def generate_yangdoja_data(product_codes, num_yangdoja):
    yangdoja_data = []
    unique_product_codes = list(set(product_codes))
    num_matches = int(min(len(unique_product_codes) * 0.9, num_yangdoja))  # 90% 매칭 가능 수
    matched_codes = random.sample(unique_product_codes, num_matches // 2)  # 매핑할 코드 수
    for i in range(num_matches // 2):
        yangdoja_id = f'YD{i+1:04d}'
        name = random.choice(names)
        city = random.choice(cities)
        district = random.choice(districts)
        address = f'{city} {district} {random.randint(1, 100)}번지'
        phone = f'010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}'
        email = f'{name.lower()}{random.randint(100, 999)}@example.com'
        product_code = matched_codes[i]
        start_date = datetime(2022, 1, 1)
        end_date = datetime(2022, 12, 31)
        days_diff = (end_date - start_date).days
        random_days = random.randint(0, days_diff)
        yangdo_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        grade = random.choice(grades)
        status = random.choice(statuses)
        amount = random.randint(100000, 5000000)
        yangdoja_data.append([yangdoja_id, name, address, phone, email, product_code, yangdo_date, grade, status, amount])
    return pd.DataFrame(yangdoja_data, columns=['양도자ID', '이름', '주소', '연락처', '이메일', '양도제품코드', '양도날짜', '양도자 등급', '계약 상태', '양도 금액'])

# 양수자 데이터셋 생성 함수
def generate_yangsuja_data(product_codes, num_yangsuja):
    yangsuja_data = []
    unique_product_codes = list(set(product_codes))
    num_matches = int(min(len(unique_product_codes) * 0.9, num_yangsuja))
    matched_codes = random.sample(unique_product_codes, num_matches // 2)
    for i in range(num_matches // 2):
        yangsuja_id = f'YS{i+1:04d}'
        name = random.choice(names)
        city = random.choice(cities)
        district = random.choice(districts)
        address = f'{city} {district} {random.randint(1, 100)}번지'
        phone = f'010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}'
        email = f'{name.lower()}{random.randint(100, 999)}@example.com'
        product_code = matched_codes[i]
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2024, 12, 31)
        days_diff = (end_date - start_date).days
        random_days = random.randint(0, days_diff)
        yangsu_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        grade = random.choice(grades)
        status = random.choice(statuses)
        amount = random.randint(100000, 5000000)
        yangsuja_data.append([yangsuja_id, name, address, phone, email, product_code, yangsu_date, grade, status, amount])
    return pd.DataFrame(yangsuja_data, columns=['양수자ID', '이름', '주소', '연락처', '이메일', '양수제품코드', '양수날짜', '양수자 등급', '계약 상태', '양수 금액'])

# list.xlsx 파일 읽기
df_products = pd.read_excel('list.xlsx')

# 상품코드 추출
product_codes = df_products['상품코드'].tolist()
unique_product_count = len(set(product_codes))  # 고유 상품코드 수
num_records = min(unique_product_count * 2, 500)  # 90% 매칭 가능 수에 맞춘 데이터 크기

# 양도자 및 양수자 데이터셋 생성
df_yangdoja = generate_yangdoja_data(product_codes, num_records)
df_yangsuja = generate_yangsuja_data(product_codes, num_records)

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

# 매칭 및 검증
merged_df = pd.merge(df_yangdoja, df_yangsuja, left_on='양도제품코드', right_on='양수제품코드', how='inner')
merged_df = pd.merge(merged_df, df_products, left_on='양도제품코드', right_on='상품코드', how='inner')

# 중복 제거
merged_df = merged_df.drop_duplicates(subset=['양도자ID', '양수자ID'])

# 매칭 검증 지표 계산
total_possible_matches = min(len(df_yangdoja), len(df_yangsuja))
actual_matches = len(merged_df)
matching_success_rate = (actual_matches / total_possible_matches) * 100

# 시간 순서 검증
temporal_consistency = (merged_df['양도날짜'] < merged_df['양수날짜']).all()

# 상품 코드 일치율 검증
code_match_rate = 100  # inner join이므로 100%

# 중복 매칭 여부 검증
duplicate_yangdoja = merged_df['양도자ID'].duplicated().any()
duplicate_yangsuja = merged_df['양수자ID'].duplicated().any()

# 결과 출력
print("\n=== 매칭 검증 결과 ===")
print(f"총 가능한 매칭 수: {total_possible_matches}")
print(f"실제 매칭된 쌍 수: {actual_matches}")
print(f"매칭 성공률: {matching_success_rate:.2f}%")
print(f"시간 순서 준수 (양도날짜 < 양수날짜): {temporal_consistency}")
print(f"상품 코드 일치율: {code_match_rate}%")
print(f"양도자ID 중복 여부: {duplicate_yangdoja}")
print(f"양수자ID 중복 여부: {duplicate_yangsuja}")

# 매칭이 잘 되었음을 나타내는 메시지 (90% 이상)
if matching_success_rate >= 90 and temporal_consistency and not duplicate_yangdoja and not duplicate_yangsuja:
    print("\n양도자와 양수자가 성공적으로 매칭되었습니다. 모든 검증 조건(성공률 90% 이상)을 만족합니다.")
else:
    print("\n매칭 성공률이 90% 미만이거나 다른 검증 조건을 만족하지 못했습니다. 조정이 필요합니다.")

# 매칭 결과 저장
result_df = merged_df[[
    '양도자ID', '양수자ID', '양도제품코드', '품명', '양도날짜', '양수날짜',
    '양도자 등급', '양수자 등급', '계약 상태_x', '계약 상태_y', '양도 금액', '양수 금액'
]]
result_df.to_csv('matched_yangdoja_yangsuja.csv', index=False, encoding='utf-8-sig')

print("\n매칭된 데이터가 'matched_yangdoja_yangsuja.csv' 파일로 저장되었습니다.")
print("\n매칭 결과 상위 5개:")
print(result_df.head())