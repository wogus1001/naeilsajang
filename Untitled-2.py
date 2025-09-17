import pandas as pd
import random
from faker import Faker
import numpy as np

# Faker 초기화 (한국어 설정)
fake = Faker('ko_KR')

# 나이 분포 커스텀 (총 1000명)
ages = []
ages.extend(np.random.randint(10, 20, 30))  # 10대: 30명
ages.extend(np.random.randint(20, 30, 205))  # 20대: 205명 (원래 200 + 5)
ages.extend(np.random.randint(30, 40, 405))  # 30대: 405명 (원래 400 + 5)
ages.extend(np.random.randint(40, 50, 313))  # 40대: 313명 (원래 310 + 3)
ages.extend(np.random.randint(50, 60, 42))  # 50대: 42명 (원래 40 + 2)
ages.extend([60] * 5)  # 60대: 5명 (0.5%)
random.shuffle(ages)  # 무작위 섞기

genders = ['M', 'F', '기타']
gender_weights = [0.5, 0.48, 0.02]
regions = [
    '서울 강남구', '서울 송파구', '서울 서초구', '서울 마포구', '서울 영등포구',
    '부산 해운대구', '부산 수영구', '부산 남구',
    '대구 수성구', '대구 달서구',
    '인천 연수구', '인천 남동구',
    '광주 북구', '광주 광산구',
    '대전 유성구', '대전 서구',
    '경기 성남시', '경기 용인시',
    '강원 원주시', '제주 서귀포시'
]
region_weights = [0.10, 0.08, 0.07, 0.06, 0.05, 0.07, 0.05, 0.04, 0.06, 0.04, 0.05, 0.04, 0.05, 0.04, 0.05, 0.04, 0.06, 0.05, 0.03, 0.02]
experience_levels = ['0-1년', '1-3년', '3-5년', '5년 이상']
time_slots = ['평일 오전', '평일 오후', '평일 저녁', '주말 오전', '주말 저녁']
coach_styles = ['친절한 지도', '엄격한 피드백', '동기부여 중심', '미입력']
lesson_types = ['1:1', '그룹', '온라인']
match_frequencies = ['주 1회', '주 2회', '월 2-3회', '월 1회 미만']
training_goals = ['실력 향상', '체력 증진', '대회 준비', '취미 유지']
center_types = ['실내 코트', '야외 코트', '접근성', '시설 완비', '미입력']
app_usages = ['매일', '주 1-2회', '주 1회 미만', '미사용']
spending_levels = ['10만 원 미만', '10-30만 원', '30만 원 이상']

# 데이터 생성
data = []
for i in range(1000):
    member_id = f'M{str(i+1).zfill(3)}'
    age = ages[i]
    gender = random.choices(genders, weights=gender_weights)[0]
    region = random.choices(regions, weights=region_weights)[0]
    experience = random.choice(experience_levels)
    time_slot = random.choice(time_slots)
    coach_style = random.choices(coach_styles, weights=[0.4, 0.3, 0.2, 0.1])[0]
    lesson_type = random.choice(lesson_types)
    match_freq = random.choice(match_frequencies)
    match_result = random.choices([f'{random.randint(0,3)}승 {random.randint(0,3)}패', ''], weights=[0.7, 0.3])[0]
    training_goal = random.choice(training_goals)
    center_type = random.choices(center_types, weights=[0.3, 0.2, 0.2, 0.2, 0.1])[0]
    app_usage = random.choice(app_usages)
    spending = random.choice(spending_levels)
    data.append([member_id, age, gender, region, experience, time_slot, coach_style, lesson_type, match_freq, match_result, training_goal, center_type, app_usage, spending])

# DataFrame 생성 및 CSV 저장
columns = ['회원ID', '나이', '성별', '거주지', '테니스_경험_연수', '주_이용_시간대', '선호_코치_스타일', '선호_레슨_방식', '경기_빈도', '최근_경기_성적', '선호_훈련_목표', '선호_테니스_센터_유형', '모바일_앱_사용_빈도', '소비_성향']
df = pd.DataFrame(data, columns=columns)
df.to_csv('member_profile_data_1000_adjusted_ages_60pct05.csv', index=False, encoding='utf-8-sig')
print("파일이 생성되었습니다: member_profile_data_1000_adjusted_ages_60pct05.csv")