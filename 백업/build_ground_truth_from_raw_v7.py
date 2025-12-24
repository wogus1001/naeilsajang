from __future__ import annotations
import pandas as pd, json, re, math
from ast import literal_eval

RAW_XLSX = "raw.xlsx"
MAP_JSON = "mapping_config.json"
OUT_CSV  = "ground_truth_set_v7.csv"

AREA_BUCKETS = ["ANY","10평 이하","10~20평","20~30평","30~40평","40평 이상"]

def to_int(x):
    try:
        return int(x)
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return None

def to_sales_label_from_won(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    iv = to_int(v)
    if iv is None: return ""
    man = iv // 10000
    if man <= 0: return ""
    if man < 3000:   return "3천만원 이하"
    if man < 7000:   return "3천~7천만원"
    if man < 10000:  return "7천만원~1억원"
    return "1억원 이상"

def norm_total_amount_from_raw(takeover_amount, premium, deposit):
    # takeover_amount 우선, 없으면 premium+deposit
    iv = to_int(takeover_amount)
    if iv and iv>0:
        base = iv
    else:
        p = to_int(premium) or 0
        d = to_int(deposit) or 0
        base = p + d
    # 원 → 만원 보정
    if base and base > 100000:
        base = int(round(base/10000))
    return base or 0

def area_label_from_m2(exclusive_area):
    if exclusive_area is None or exclusive_area=="" or (isinstance(exclusive_area,float) and math.isnan(exclusive_area)):
        return "상관없음"
    try:
        m2 = float(exclusive_area)
        p = m2 / 3.3
        if p < 10:  return "10평 이하"
        if p < 20:  return "10~20평"
        if p < 30:  return "20~30평"
        if p < 40:  return "30~40평"
        return "40평 이상"
    except Exception:
        return "상관없음"

def build_category_maps(mp):
    main_map = { int(r["main_category_id"]): str(r["name"]) for r in mp.get("main_category",[]) if pd.notna(r.get("main_category_id")) }
    sub_map  = { int(r["sub_category_id"]) : {"name": str(r["name"]), "main_category_id": int(r["main_category_id"])}
                 for r in mp.get("sub_category",[]) if pd.notna(r.get("sub_category_id")) }
    return main_map, sub_map

def split_address(addr: str):
    s = (addr or "").strip()
    if not s: return {"sidoName":"", "gunName":"", "dongName":""}, ""
    parts = s.split()
    sido = parts[0] if parts else ""
    gun  = parts[1] if len(parts)>1 else ""
    # dong은 남은 문자열에서 첫 어절 정도까지(서버가 label 참고)
    dong = parts[2] if len(parts)>2 else ""
    return {"sidoName":sido, "gunName":gun, "dongName":dong}, s

def main():
    raw = pd.read_excel(RAW_XLSX, sheet_name=0)
    with open(MAP_JSON, "r", encoding="utf-8") as f:
        mp = json.load(f)
    _, sub_map = build_category_maps(mp)

    rows = []
    for _, r in raw.iterrows():
        sale_id = r.get("sale_franchise_id")

        totalAmount = norm_total_amount_from_raw(r.get("takeover_amount"), r.get("premium"), r.get("deposit"))
        sales_label = to_sales_label_from_won(r.get("monthly_avg_sales"))  # 라벨
        isFr = "1" if str(int(r.get("is_franchise") or 0)) == "1" else "0"  # 문자열!
        isFr_label = "프랜차이즈" if isFr=="1" else "개인"
        area_label = area_label_from_m2(r.get("exclusive_area"))            # 라벨
        sub_id = int(r["sub_category_id"]) if pd.notna(r.get("sub_category_id")) else 0
        sub_ids = [sub_id] if sub_id>0 else [0]
        categoryLabel = sub_map.get(sub_id,{}).get("name","상관없음")

        addr_obj, addr_label = split_address(r.get("address"))

        options = []
        ie = r.get("is_employee_takeover")
        ie = 0 if (ie is None or (isinstance(ie,float) and math.isnan(ie))) else int(ie)
        if ie == 1: options.append("직원 승계 가능")

        st = r.get("sales_time_type")
        st = 0 if (st is None or (isinstance(st,float) and math.isnan(st))) else int(st)
        if st == 0: options.append("양도 즉시가능")

        try:
            op = int(r.get("operation_period") or 0)
            if op >= 24: options.append("영업기간 2년 이상")
            elif op >= 12: options.append("영업기간 1년 이상")
            elif op >= 6: options.append("영업기간 6개월 이상")
        except Exception:
            pass

        ipp = r.get("is_premium_payment")
        isPremiumPayment = 0 if (ipp is None or (isinstance(ipp,float) and math.isnan(ipp))) else int(ipp)

        # ✅ 서버가 기대하는 UI 포맷(브라우저 동일)
        payload = {
            "totalAmount": totalAmount,                # 만원 단위 정수
            "monthlyAvgSales": "ANY",                  # 코드값은 ANY 유지
            "monthlyAvgSalesLabel": sales_label,       # 라벨은 여기
            "mainCategoryId": [],
            "subCategoryId": sub_ids,                  # 정수 배열 (없으면 [0])
            "isFranchise": isFr,                       # 문자열 "0"/"1"
            "isFranchiseLabel": isFr_label,            # 라벨
            "address": addr_obj,
            "addressLabel": addr_label,                # 라벨
            "exclusiveArea": "ANY",                    # 코드값은 ANY 유지
            "exclusiveAreaLabel": area_label,          # 라벨은 여기
            "option": [],                              
            "optionLabel": ", ".join(options) if options else "없음",
            "categoryLabel": categoryLabel,
            "isPremiumPayment": isPremiumPayment
        }

        label = f'{addr_label} {categoryLabel} {totalAmount}만원 {area_label}'
        rows.append({
            "sale_franchise_id": sale_id,
            "expected_id": sale_id,
            "search_label": label,
            "payload_json": json.dumps(payload, ensure_ascii=False)
        })

    out = pd.DataFrame(rows)
    out.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"✅ ground truth 생성 완료: {OUT_CSV} (rows={len(out)})")

if __name__ == "__main__":
    main()
