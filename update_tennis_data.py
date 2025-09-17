import pandas as pd
import random

# Excel 파일 경로
file_path = "c:/Users/awmve/OneDrive/바탕 화면/my_project/12. 지역별 테니스 시설 데이터 DB.xlsx"
output_path = "c:/Users/awmve/OneDrive/바탕 화면/my_project/12. 지역별 테니스 시설 데이터 DB_추가.xlsx"

# 데이터 불러오기
df = pd.read_excel(file_path, sheet_name="Sheet1")

# K 열(관람석좌석수, 인덱스 10)에 빈 값 확인 및 랜덤 숫자 채우기 (0~150)
df["관람석좌석수"] = df["관람석좌석수"].apply(lambda x: random.randint(20, 150) if pd.isna(x) else x)

# 결과 저장
df.to_excel(output_path, index=False)
print(f"파일이 생성되었습니다: {output_path}")