import pandas as pd
import random

# 절대 경로 사용
file_path = "c:/Users/awmve/OneDrive/바탕 화면/my_project/공공체육시설현황(테니스).xlsx"
df = pd.read_excel(file_path, sheet_name="공공체육시설현황(테니스)")

# 나머지 함수 정의 (generate_operating_hours 등 동일)
def generate_operating_hours():
    return "평일 09:00~22:00, 주말 08:00~20:00"

def generate_pricing():
    lesson_price = random.choice([5, 6, 7, 8, 9, 10]) * 10000
    court_price = random.choice([1, 2, 3]) * 10000
    return f"레슨 {lesson_price:,}원/시간, 코트 대여 {court_price:,}원/시간"

def generate_coach_info():
    count = random.randint(2, 10)
    styles = ["친절 중심", "엄격 중심", "동기부여 중심"]
    style_dist = random.choices(styles, weights=[0.5, 0.3, 0.2], k=count)
    return f"{count}명 ({', '.join(style_dist)})"

def generate_amenities():
    options = ["샤워실", "라커룸", "주차장", "카페", "장비 대여"]
    return ", ".join(random.sample(options, random.randint(1, 4)))

def generate_rating():
    return round(random.uniform(3.5, 5.0), 1)

def generate_accessibility():
    return random.choice(["대중교통 좋음, 주차 편리", "접근성 우수, 지하철 5분", "주차 제한"])

def generate_competition():
    return f"주변 {random.randint(1, 5)}개 센터"

def generate_market_char():
    return random.choice(["인구 밀집, 소비 높음", "성장 가능성 높음", "중간 수준"])

# 컬럼 추가
df["운영 시간"] = [generate_operating_hours() for _ in range(len(df))]
df["이용 요금"] = [generate_pricing() for _ in range(len(df))]
df["코치 수 및 스타일"] = [generate_coach_info() for _ in range(len(df))]
df["시설 완비 수준"] = [generate_amenities() for _ in range(len(df))]
df["평가/평점"] = [generate_rating() for _ in range(len(df))]
df["접근성"] = [generate_accessibility() for _ in range(len(df))]
df["경쟁 시설 현황"] = [generate_competition() for _ in range(len(df))]
df["상권 특성"] = [generate_market_char() for _ in range(len(df))]

# 결과 저장
df.to_excel("c:/Users/awmve/OneDrive/바탕 화면/my_project/공공체육시설현황_추가컬럼.xlsx", index=False)
print("파일이 생성되었습니다: 공공체육시설현황_추가컬럼.xlsx")