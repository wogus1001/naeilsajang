# ai_metrics_full_pipeline_v5.py
from __future__ import annotations
import os, sys, json, time, statistics, math
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import requests

API_URL = "http://sajang.opentest.kr/api/ai/search/sales"

# === 꼭 채워주세요 ===
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo"

HEADERS = {
    "Authorization": f"Bearer {JWT}",
    "Content-Type": "application/json; charset=utf-8",
}

# =========================================
# 매핑 유틸
# =========================================
def map_monthly_sales_enum(v: Optional[float|int|str]) -> str:
    """
    입력(원 단위 숫자 또는 NaN/빈값/문자)을 서버 Enum으로 매핑
    """
    if v is None or (isinstance(v, float) and math.isnan(v)) or v == "" or v == "ANY":
        return "ANY"
    try:
        x = float(v)
    except Exception:
        # "3천~5천만원" 같은 라벨이 들어오면 범위로 추정
        s = f"{v}"
        # 매우 단순 파서 (필요하면 강화)
        if "1억" in s: return "OVER_100M"
        if "50" in s and "100" in s: return "RANGE_50M_100M"
        if "30" in s and "50" in s: return "RANGE_30M_50M"
        if "20" in s and "30" in s: return "RANGE_20M_30M"
        if "10" in s and "20" in s: return "RANGE_10M_20M"
        return "ANY"
    # 숫자 기준 (원)
    if x < 10_000_000:   return "RANGE_0_10M"
    if x < 20_000_000:   return "RANGE_10M_20M"
    if x < 30_000_000:   return "RANGE_20M_30M"
    if x < 50_000_000:   return "RANGE_30M_50M"
    if x < 100_000_000:  return "RANGE_50M_100M"
    return "OVER_100M"

def map_exclusive_area_enum(m2: Optional[float|int|str]) -> str:
    """
    전용면적(m2) -> 평수 → 서버 Enum
    """
    if m2 is None or m2 == "" or (isinstance(m2, float) and math.isnan(m2)):
        return "ANY"
    try:
        pyeong = float(m2) / 3.3
    except Exception:
        return "ANY"
    # 가장 가까운 하한 구간으로 매핑
    if pyeong >= 40: return "OVER_40"
    if pyeong >= 30: return "OVER_30"
    if pyeong >= 20: return "OVER_20"
    if pyeong >= 10: return "OVER_10"
    return "ANY"

def split_address(addr: str) -> Tuple[str,str,str]:
    """
    '서울 광진구 화양동 ...' 형태에서 앞의 3토큰만 사용.
    부족하면 빈 문자열.
    """
    if not addr:
        return "","",""
    toks = str(addr).split()
    sido = toks[0] if len(toks) > 0 else ""
    gun  = toks[1] if len(toks) > 1 else ""
    dong = toks[2] if len(toks) > 2 else ""
    return sido, gun, dong

def build_options(row: pd.Series) -> Tuple[List[str], Optional[int]]:
    """
    옵션 Enum 목록과 salesTimeType(숫자)을 생성
    - is_non_premium == 1           -> NON_PREMIUM
    - operation_period >= 12개월     -> OPERATION_PERIOD
    - worker_cnt == 0               -> AUTO_OPERATE
    - parking_cnt in 1..5           -> PARKING
    - is_employee_takeover == 1     -> EMPLOYEE_TAKEOVER
    - store_type == 3               -> SPECIAL_COMMERCIAL
    - sales_time_type == 0          -> (salesTimeType=0) + SALE_TIME_TYPE
    """
    opts: List[str] = []
    stype: Optional[int] = None

    def get_int(name, default=None):
        try:
            v = row.get(name)
            if v is None: return default
            if isinstance(v, str) and v.strip()=="":
                return default
            return int(float(v))
        except Exception:
            return default

    is_non_premium = get_int("is_non_premium", 0)
    if is_non_premium == 1:
        opts.append("NON_PREMIUM")

    op_months = get_int("operation_period", 0)
    if op_months is not None and op_months >= 12:
        opts.append("OPERATION_PERIOD")

    worker_cnt = get_int("worker_cnt", None)
    if worker_cnt == 0:
        opts.append("AUTO_OPERATE")

    parking_cnt = get_int("parking_cnt", 0)
    if parking_cnt in (1,2,3,4,5):
        opts.append("PARKING")

    is_emp_tko = get_int("is_employee_takeover", 0)
    if is_emp_tko == 1:
        opts.append("EMPLOYEE_TAKEOVER")

    store_type = get_int("store_type", 0)
    if store_type == 3:
        opts.append("SPECIAL_COMMERCIAL")

    sales_time_type = get_int("sales_time_type", None)
    if sales_time_type is not None:
        stype = sales_time_type
        if sales_time_type == 0:
            opts.append("SALE_TIME_TYPE")

    return opts, stype

def p95(vals: List[float]) -> float:
    if not vals: return 0.0
    if len(vals) == 1: return vals[0]
    return statistics.quantiles(vals, n=20)[18]

# =========================================
# 메인 로직
# =========================================
def row_to_payload(row: pd.Series) -> Dict[str, Any]:
    # 필수값 매핑
    totalAmount = row.get("takeover_amount", None)
    if totalAmount is None or (isinstance(totalAmount, float) and math.isnan(totalAmount)):
        # 예비: premium+deposit 합산으로 대체 가능
        premium = row.get("premium", 0) or 0
        deposit = row.get("deposit", 0) or 0
        try:
            totalAmount = int(round((float(premium)+float(deposit)) / 10_000))  # 원→만원 (대략)
        except Exception:
            totalAmount = 0

    monthly_enum = map_monthly_sales_enum(row.get("monthly_avg_sales", "ANY"))
    area_enum    = map_exclusive_area_enum(row.get("exclusive_area", None))

    is_fr_raw = row.get("is_franchise", None)
    # 규칙: 0=프랜차이즈, 1=개인 (모름이면 0/1 외 값은 ANY로 보내지 않고 키 자체를 생략해도 됨)
    is_franchise = None
    try:
        iv = int(float(is_fr_raw))
        if iv in (0,1): is_franchise = iv
    except Exception:
        pass

    subcat = row.get("sub_category_id", None)
    subcat_ids = []
    try:
        if subcat not in (None, "", "nan"):
            subcat_ids = [int(float(subcat))]
    except Exception:
        subcat_ids = []

    # 주소
    addr = str(row.get("address","") or "")
    sido, gun, dong = split_address(addr)

    # 옵션 & 매매일정
    options, sales_time_type = build_options(row)

    payload: Dict[str, Any] = {
        "totalAmount": int(float(totalAmount)) if totalAmount not in (None, "", "nan") else 0,
        "monthlyAvgSales": monthly_enum,
        "mainCategoryId": [],            # 필요시 매핑 추가
        "subCategoryId": subcat_ids,
        # isFranchise는 알 때만 세팅 (불확실하면 생략)
        "address": {"sidoName": sido, "gunName": gun, "dongName": dong},
        "exclusiveArea": area_enum,
        "option": options,
        "includeSelf": True,
        "excludeSelf": False,
        "topK": 50,
    }
    if is_franchise is not None:
        payload["isFranchise"] = is_franchise
    if sales_time_type is not None:
        payload["salesTimeType"] = sales_time_type
    return payload

def measure_from_csv(csv_path: str) -> Tuple[pd.DataFrame, float, float, float, int, int, Dict[str,int]]:
    df = pd.read_csv(csv_path)
    rows: List[Dict[str, Any]] = []
    hits = 0
    latencies: List[float] = []
    status_count: Dict[str,int] = {}

    for i, r in df.iterrows():
        expected_id = r.get("sale_franchise_id") or r.get("expected_id") or r.get("saleFranchiseId")
        # payload 생성
        payload = row_to_payload(r)

        t0 = time.perf_counter()
        try:
            resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(payload), timeout=20)
            elapsed = (time.perf_counter()-t0)*1000
            latencies.append(elapsed)
            status = str(resp.status_code)
            status_count[status] = status_count.get(status,0)+1

            if resp.status_code != 200:
                rows.append({
                    "label": f"{r.get('address','')} {r.get('sub_category_id','')} {r.get('takeover_amount','')}만원",
                    "status": resp.status_code,
                    "hit": 0,
                    "latency_ms": round(elapsed,1),
                    "expected_id": expected_id,
                    "top5_ids": [],
                    "top5_names": [],
                    "used_payload_json": json.dumps(payload, ensure_ascii=False)
                })
                continue

            data = resp.json()
            top5 = data[:5] if isinstance(data, list) else data.get("results", [])[:5]
            top5_ids = [it.get("saleFranchiseId") for it in top5 if isinstance(it, dict)]
            top5_names = [it.get("franchiseName") for it in top5 if isinstance(it, dict)]

            is_hit = 1 if (expected_id in top5_ids) else 0
            hits += is_hit
            rows.append({
                "label": f"{r.get('address','')} {r.get('sub_category_id','')} {r.get('takeover_amount','')}만원",
                "status": resp.status_code,
                "hit": is_hit,
                "latency_ms": round(elapsed,1),
                "expected_id": expected_id,
                "top5_ids": top5_ids,
                "top5_names": top5_names,
                "used_payload_json": json.dumps(payload, ensure_ascii=False)
            })

        except requests.exceptions.RequestException as e:
            elapsed = (time.perf_counter()-t0)*1000
            latencies.append(elapsed)
            status_count["REQ_ERR"] = status_count.get("REQ_ERR",0)+1
            rows.append({
                "label": f"{r.get('address','')} {r.get('sub_category_id','')} {r.get('takeover_amount','')}만원",
                "status": "REQ_ERR",
                "hit": 0,
                "latency_ms": round(elapsed,1),
                "expected_id": expected_id,
                "top5_ids": [],
                "top5_names": [],
                "used_payload_json": json.dumps(payload, ensure_ascii=False),
                "error": str(e)
            })

    total = len(rows)
    acc = (hits/total*100) if total else 0.0
    avg = statistics.mean(latencies) if latencies else 0.0
    p95v = p95(latencies)

    log_df = pd.DataFrame(rows)
    log_df.to_csv("ai_metric_log_all.csv", index=False, encoding="utf-8-sig")

    return log_df, acc, avg, p95v, hits, total, status_count

def main():
    if len(sys.argv) < 2:
        print("USAGE: python ai_metrics_full_pipeline_v5.py <ground_truth_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"파일 없음: {csv_path}")
        sys.exit(1)

    log, acc, avg, p95v, hits, total, st = measure_from_csv(csv_path)
    print("\n===== [all] 결과 요약 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg:.1f} ms, p95 {p95v:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")
    print(f"- status breakdown: {st}")
    print(">> 저장: ai_metric_log_all.csv")

if __name__ == "__main__":
    main()
