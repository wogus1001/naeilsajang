import math
def haversine_distance(lat1, lon1, lat2, lon2):
R = 6371  # 지구 반지름 (km)
lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
dlat = lat2 - lat1
dlon = lon2 - lon1
a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
c = 2 * math.asin(math.sqrt(a))
distance = R * c
return distance
def scale_distance(distance):
if distance <= 50:
return 1.0
elif distance <= 100:
return max(0.5, 1 - (distance - 50) / 50)
else:
return 0.0

예시 사용
dist = haversine_distance(37.5665, 126.9780, 37.6764, 126.7431)
score = scale_distance(dist)
print(f"거리: {dist:.2f}km, 점수: {score:.2f}")