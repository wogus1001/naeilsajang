# ai_build_ground_truth_set_v5.py
import pandas as pd
import os, math

INPUT_FILE = "raw.xlsx"
OUTPUT_FILE = "ground_truth_set.csv"

def safe(v, default=None):
    if v is None: return default
    if isinstance(v, float) and math.isnan(v): return default
    s = str(v).strip()
    if s.lower() in ["nan", "none", "null", ""]: return default
    return v

def pick_first(df, *cands):
    """후보 컬럼명들 중 존재하는 첫 컬럼의 Series 반환. 없으면 None"""
    cols_lower = {c.lower(): c for c in df.columns}
    for name in cands:
        if name is None: 
            continue
        key = str(name).lower()
        if key in cols_lower:
            return df[cols_lower[key]]
    return None

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"[ERROR] 입력 파일 없음: {INPUT_FILE}")
        return

    df = pd.read_excel(INPUT_FILE)
    print(f"[INFO] 원본 로우 수: {len(df)}")

    # 소문자 매핑용
    cols_lower = {c.lower(): c for c in df.columns}
    def col(name):
        return cols_lower.get(name.lower())

    # 각 컬럼 안전 선택
    sale_franchise_id = pick_first(df, col("sale_franchise_id"), col("id"))
    address            = pick_first(df, col("address"))
    sub_category_id    = pick_first(df, col("sub_category_id"))
    takeover_amount    = pick_first(df, col("takeover_amount"), col("totalAmount"))
    monthly_avg_sales  = pick_first(df, col("monthly_avg_sales"), col("sales"))
    exclusive_area     = pick_first(df, col("exclusive_area"))
    is_franchise       = pick_first(df, col("is_franchise"))
    is_non_premium     = pick_first(df, col("is_non_premium"))
    operation_period   = pick_first(df, col("operation_period"))
    worker_cnt         = pick_first(df, col("worker_cnt"))
    parking_cnt        = pick_first(df, col("parking_cnt"))
    is_employee_takeover = pick_first(df, col("is_employee_takeover"))
    store_type         = pick_first(df, col("store_type"))
    sales_time_type    = pick_first(df, col("sales_time_type"))
    premium            = pick_first(df, col("premium"))
    deposit            = pick_first(df, col("deposit"))
    is_premium_payment = pick_first(df, col("is_premium_payment"))

    extracted = pd.DataFrame({
        "sale_franchise_id": sale_franchise_id,
        "address": address if address is not None else "",
        "sub_category_id": sub_category_id,
        "takeover_amount": takeover_amount,
        "monthly_avg_sales": monthly_avg_sales,
        "exclusive_area": exclusive_area,
        "is_franchise": is_franchise,
        "is_non_premium": is_non_premium,
        "operation_period": operation_period,
        "worker_cnt": worker_cnt,
        "parking_cnt": parking_cnt,
        "is_employee_takeover": is_employee_takeover,
        "store_type": store_type,
        "sales_time_type": sales_time_type,
        "premium": premium,
        "deposit": deposit,
        "is_premium_payment": is_premium_payment,
    })

    # 결측 기본값
    extracted = extracted.fillna({
        "takeover_amount": 0,
        "monthly_avg_sales": "ANY",
        "exclusive_area": 0,
        "is_franchise": 0,
        "is_non_premium": 0,
        "operation_period": 0,
        "worker_cnt": 1,
        "parking_cnt": 0,
        "is_employee_takeover": 0,
        "store_type": 0,
        "sales_time_type": 4,   # 협의가능
        "premium": 0,
        "deposit": 0,
        "is_premium_payment": 0
    })

    # 합계금액 없으면 보증금+권리금으로 계산(만원)
    extracted["takeover_amount"] = extracted.apply(
        lambda r: r["takeover_amount"] if safe(r["takeover_amount"], 0) != 0
        else (safe(r["deposit"], 0) + safe(r["premium"], 0)) / 10_000,
        axis=1
    )

    # 타입 정리
    for c in ["takeover_amount", "operation_period", "sales_time_type",
              "worker_cnt", "parking_cnt", "is_employee_takeover",
              "store_type", "is_non_premium", "is_premium_payment",
              "is_franchise"]:
        if c in extracted.columns:
            extracted[c] = pd.to_numeric(extracted[c], errors="coerce").fillna(0).astype(int)

    # expected_id
    if sale_franchise_id is None or extracted["sale_franchise_id"].isna().all():
        extracted["expected_id"] = range(1000, 1000+len(extracted))
    else:
        extracted["expected_id"] = extracted["sale_franchise_id"]

    # 주소 분리
    def split_addr(a):
        if not isinstance(a, str) or not a.strip():
            return pd.Series(["", "", ""])
        parts = a.split()
        return pd.Series([
            parts[0] if len(parts)>0 else "",
            parts[1] if len(parts)>1 else "",
            parts[2] if len(parts)>2 else ""
        ])

    extracted[["sido_name", "gun_name", "dong_name"]] = extracted["address"].apply(split_addr)

    # 저장
    extracted.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")
    print(f"[OK] {OUTPUT_FILE} 저장 완료 ({len(extracted)}건)")

if __name__ == "__main__":
    main()
