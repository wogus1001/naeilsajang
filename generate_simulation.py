import pandas as pd
import random
import math
import matplotlib.pyplot as plt

# 데이터 로드 (가상 회원 데이터 생성 및 시설 데이터 로드)
members = pd.DataFrame({
    "name": [f"M{i:03d}" for i in range(1, 1001)],
    "lat": [random.uniform(33, 38) for _ in range(1000)],
    "lon": [random.uniform(126, 129) for _ in range(1000)],
    "pref_min": [random.randint(50000, 100000) for _ in range(1000)],
    "pref_max": [random.randint(100000, 150000) for _ in range(1000)],
    "coach_style": random.choices(["친절 중심", "엄격 중심", "동기부여 중심"], k=1000)
})
facilities = pd.read_excel("공공체육시설현황_추가컬럼.xlsx")
facilities = facilities[["시설명", "WGS84위도", "WGS84경도", "이용 요금", "코치 수 및 스타일", "소재지도로명주소"]].dropna()
facilities.columns = ["name", "lat", "lon", "price", "coaches", "address"]
facilities["price"] = facilities["price"].str.extract(r'(\d+),?(\d*)').apply(lambda x: int(x[0] + x[1]) if x[1] else int(x[0]), axis=1)

# 매칭 함수 정의
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # 지구 반지름 (km)
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    a = math.sin((lat2 - lat1)/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1)/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def scale_distance(distance):
    if distance <= 50:
        return 1.0
    elif distance <= 100:
        return max(0.5, 1 - (distance - 50) / 50)
    else:
        return 0.0

def calculate_price_score(pref_min, pref_max, facility_price):
    if pref_min <= facility_price <= pref_max:
        return 1.0
    diff = min(abs(facility_price - pref_min), abs(facility_price - pref_max))
    return max(0.0, 1 - diff / 50000)

def calculate_coach_score(pref_style, facility_coaches):
    styles = [s.strip() for s in facility_coaches.split("(")[1].split(")")[0].split(",")]
    if pref_style in styles:
        return 1.0
    elif any(s in ["친절 중심", "동기부여 중심", "엄격 중심"] for s in styles):
        return 0.5
    else:
        return 0.0

def get_top_facilities(members, facilities, sample_size=200):
    results = []
    sample_members = members.sample(n=sample_size)
    for _, member in sample_members.iterrows():
        scores = []
        for _, facility in facilities.iterrows():
            distance = haversine_distance(member["lat"], member["lon"], facility["lat"], facility["lon"])
            distance_score = scale_distance(distance)
            price_score = calculate_price_score(member["pref_min"], member["pref_max"], facility["price"])
            coach_score = calculate_coach_score(member["coach_style"], facility["coaches"])
            total_score = distance_score * 0.4 + price_score * 0.3 + coach_score * 0.3
            if total_score >= 0.5:
                scores.append({"시설명": facility["name"], "주소": facility["address"], "점수": total_score})
        top_3 = sorted(scores, key=lambda x: x["점수"], reverse=True)[:3]
        results.append({"회원ID": member["name"], "추천_시설": top_3})
    return results

# 200건 결과 생성
results = get_top_facilities(members, facilities, sample_size=200)

# 결과 저장
with open("simulation_results.txt", "w", encoding="utf-8") as f:
    for result in results:
        f.write(f"{result}\n")

# 매칭 점수 변화 시뮬레이션 (가상 레이팅 변화 그래프)
member_ids = [f"M{i:03d}" for i in range(1, 11)]  # 샘플 10명
rating_changes = {mid: [random.uniform(0.5, 1.0) for _ in range(5)] for mid in member_ids}  # 5회 매칭
plt.figure(figsize=(10, 6))
for mid, changes in rating_changes.items():
    plt.plot(range(1, 6), changes, marker='o', label=mid)
plt.title("회원별 매칭 점수 변화 (5회 시뮬레이션)")
plt.xlabel("매칭 횟수")
plt.ylabel("매칭 점수")
plt.legend()
plt.grid(True)
plt.savefig("rating_changes.png")
plt.close()

print("200건 결과가 simulation_results.txt에 저장되었고, rating_changes.png가 생성되었습니다.")