# -*- coding: utf-8 -*-
"""
HAR 파일 → 전체 요청 엑셀 변환기
--------------------------------
사용법:
  1) 크롬 DevTools → Network → Save all as HAR with content
  2) 생성된 .har 파일을 이 스크립트와 같은 폴더에 둔다.
  3) python HAR_to_Excel.py 실행
결과:
  - auto_match.har → auto_match_all_requests.xlsx
"""

import json
import pandas as pd
from pathlib import Path

# ===============================
# ① 기본 설정
# ===============================
# 변환할 HAR 파일 이름 (확장자 포함)
har_filename = "auto_match.har"

# 출력 파일명 자동 생성
har_path = Path(har_filename)
excel_path = har_path.with_name(har_path.stem + "_all_requests.xlsx")

# ===============================
# ② HAR 로드 및 파싱
# ===============================
try:
    with open(har_path, "r", encoding="utf-8") as f:
        har_data = json.load(f)
except FileNotFoundError:
    print(f"❌ HAR 파일을 찾을 수 없습니다: {har_path}")
    print("파일을 스크립트와 같은 폴더에 두었는지 확인하세요.")
    exit(1)

entries = har_data["log"]["entries"]
rows = []

for e in entries:
    req = e.get("request", {})
    res = e.get("response", {})
    tm = e.get("timings", {})

    # 총 응답시간 계산
    total_time = sum(v for v in tm.values() if isinstance(v, (int, float)))

    rows.append({
        "URL": req.get("url"),
        "Method": req.get("method"),
        "Status": res.get("status"),
        "MimeType": res.get("content", {}).get("mimeType"),
        "Wait(ms)": tm.get("wait"),
        "Receive(ms)": tm.get("receive"),
        "Send(ms)": tm.get("send"),
        "DNS(ms)": tm.get("dns"),
        "Connect(ms)": tm.get("connect"),
        "Blocked(ms)": tm.get("blocked"),
        "Total(ms)": total_time,
        "StartedDateTime": e.get("startedDateTime"),
        "ResponseSize(Bytes)": res.get("_transferSize"),
    })

# ===============================
# ③ 엑셀 저장
# ===============================
df = pd.DataFrame(rows)
df.to_excel(excel_path, index=False, engine="openpyxl")

print("✅ 변환 완료!")
print(f"→ 결과 파일: {excel_path.resolve()}")
print(f"총 요청 수: {len(df)}")
print("엑셀에서 URL 열로 필터링하면 /sales, /search 등의 요청만 따로 볼 수 있습니다.")
