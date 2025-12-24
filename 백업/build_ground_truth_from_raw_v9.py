from __future__ import annotations
import pandas as pd, json, math

RAW_XLSX = "raw.xlsx"               # 원천 데이터
MAP_JSON = "mapping_config.json"    # main/sub 카테고리 매핑 (기존 파일)
OUT_CSV  = "ground_truth_set_v9.csv"

# =========================
# ① enum 코드/라벨 규칙
# =========================

# 희망 월 매출 코드 (문의 주신 표 기준)
# 1: 0~1000만원, 2: 1000~2000, 3: 2000~3000, 4: 3000~5000, 5: 5000~1억, 6: 1억 이상, 7: 상관없음
def monthly_sales_code_and_label_from_won(v):
    if v is None or (isinstance(v,float) and math.isnan(v)):
        return "7", "상관없음"
    try:
        won = int(v)
    except Exception:
        return "7", "상관없음"
    man = won // 10000
    if man < 1000:   return "1", "1천만원 이하"
    if man < 2000:   return "2", "1천~2천만원"
    if man < 3000:   return "3", "2천~3천만원"
    if man < 5000:   return "4", "3천~5천만원"
    if man < 10000:  return "5", "5천만원~1억원"
    return "6", "1억원 이상"

# 전용면적(평수) 코드 (문의 표 기준)
# 1: 10평 미만, 2: 10평 이상, 3: 20평 이상, 4: 30평 이상, 5: 40평 이상, 6: 상관없음
def area_code_and_label_from_m2(exclusive_area):
    if exclusive_area is None or exclusive_area=="" or (isinstance(exclusive_area,float) and math.isnan(exclusive_area)):
        return "6", "상관없음"
    try:
        pyeong = float(exclusive_area) / 3.3
    except Exception:
        return "6", "상관없음"
    if pyeong < 10:  return "1", "10평 미만"
    if pyeong < 20:  return "2", "10~20평"
    if pyeong < 30:  return "3", "20~30평"
    if pyeong < 40:  return "4", "30~40평"
    return "5", "40평 이상"

# 매매 가능 일정 (0: 즉시가능, 1: 1~2개월, 2: 3~5개월, 3: 6~8개월, 4: 협의가능)
SALES_TIME_LABEL = {0:"즉시 가능",1:"1~2개월 이내",2:"3~5개월 이내",3:"6~8개월 이내",4:"협의가능"}

# 운영기간 코드(선택) – 필요 시 포함
OP_PERIOD_CODE_BY_LABEL = {"상관없음":"0","6개월 이상":"1","1년 이상":"2","2년 이상":"3"}

def op_period_code_and_label_from_months(m):
    try:
        months = int(m)
    except Exception:
        return "0", "상관없음"
    if months >= 24: return "3", "2년 이상"
    if months >= 12: return "2", "1년 이상"
    if months >= 6:  return "1", "6개월 이상"
    return "0", "상관없음"

# =========================
# ② 옵션 규칙 (문의 주신 로직 그대로)
# =========================
# option 코드: 1: 직원 승계 가능, 2: 주차장 보유매장, 3: 특수상권, 4: 오토 운영 가능매장,
#              5: 무권리, 6: 영업기간 1년 이상, 7: 양도 즉시가능, 8: 없음
OPTION_LABEL_BY_CODE = {
    "1":"직원 승계 가능",
    "2":"주차장 보유매장",
    "3":"특수상권",
    "4":"오토 운영 가능매장",
    "5":"무권리",
    "6":"영업기간 1년 이상",
    "7":"양도 즉시가능",
    "8":"없음",
}

def build_option_codes_and_label(row, op_code, st_code):
    codes = []

    # is_non_premium: 1이면 무권리 → code "5"
    try:
        if int(row.get("is_non_premium") or 0) == 1:
            codes.append("5")
    except Exception:
        pass

    # operation_period: 1년 이상이면 → code "6"
    try:
        if int(row.get("operation_period") or 0) >= 12:
            codes.append("6")
    except Exception:
        pass

    # worker_cnt: 0(무인) 이면 → 오토 운영 가능 → code "4"
    try:
        if int(row.get("worker_cnt") or -1) == 0:
            codes.append("4")
    except Exception:
        pass

    # parking_cnt: 1~5 이면 → 주차장 보유 → code "2"
    try:
        pc = int(row.get("parking_cnt") or 0)
        if pc in [1,2,3,4,5]:
            codes.append("2")
    except Exception:
        pass

    # sales_time_type: 0(즉시) 이면 → 양도 즉시가능 → code "7"
    if st_code == "0":
        codes.append("7")

    # is_employee_takeover: 1이면 → code "1"
    try:
        if int(row.get("is_employee_takeover") or 0) == 1:
            codes.append("1")
    except Exception:
        pass

    # store_type: 3(특수상권) 이면 → code "3"
    try:
        if int(row.get("store_type") or 0) == 3:
            codes.append("3")
    except Exception:
        pass

    # 중복 제거 & 정렬
    codes = sorted(set(codes), key=lambda x: int(x))
    label = ", ".join(OPTION_LABEL_BY_CODE[c] for c in codes) if codes else "없음"
    if not codes: codes = ["8"]  # 선택 없음 → 8
    return codes, label

# =========================
# ③ 유틸/매핑
# =========================
def safe_int(x, default=0):
    try:
        return int(x)
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return default

def norm_total_amount_from_raw(takeover_amount, premium, deposit):
    iv = safe_int(takeover_amount, 0)
    base = iv if iv>0 else safe_int(premium,0) + safe_int(deposit,0)
    # 원 → 만원 보정 (10만 이상이면 만원단위로 보기)
    if base > 100000:
        base = round(base/10000)
    return int(base)

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
    dong = parts[2] if len(parts)>2 else ""
    return {"sidoName":sido, "gunName":gun, "dongName":dong}, s

# =========================
# ④ 메인 변환
# =========================
def main():
    raw = pd.read_excel(RAW_XLSX, sheet_name=0)
    with open(MAP_JSON, "r", encoding="utf-8") as f:
        mp = json.load(f)
    _, sub_map = build_category_maps(mp)

    rows = []
    for _, r in raw.iterrows():
        sale_id = r.get("sale_franchise_id")

        # totalAmount (만원 단위)
        totalAmount = norm_total_amount_from_raw(
            r.get("takeover_amount"), r.get("premium"), r.get("deposit")
        )

        # monthly sales (code + label)
        ms_code, ms_label = monthly_sales_code_and_label_from_won(r.get("monthly_avg_sales"))

        # isFranchise (문자열 "0"/"1") + 라벨
        isFr = "1" if safe_int(r.get("is_franchise"),0) == 1 else "0"
        isFr_label = "프랜차이즈" if isFr=="1" else "개인"

        # exclusiveArea (code + label)
        area_code, area_label = area_code_and_label_from_m2(r.get("exclusive_area"))

        # category/subcategory
        sub_id = safe_int(r.get("sub_category_id"), 0)
        sub_ids = [sub_id] if sub_id>0 else [0]
        categoryLabel = sub_map.get(sub_id,{}).get("name","상관없음")

        # address + label
        addr_obj, addr_label = split_address(r.get("address"))

        # salesTimeType (code + label)
        st_raw = safe_int(r.get("sales_time_type"), 4)
        st_code = str(st_raw) if st_raw in [0,1,2,3,4] else "4"
        st_label = SALES_TIME_LABEL.get(int(st_code), "협의가능")

        # operationPeriod (code + label) – raw: 개월
        op_code, op_label = op_period_code_and_label_from_months(r.get("operation_period"))

        # options (코드 리스트 + 라벨) – 문의하신 규칙 반영
        opt_codes, opt_label = build_option_codes_and_label(r, op_code, st_code)

        # isPremiumPayment
        isPremiumPayment = safe_int(r.get("is_premium_payment"), 0)

        payload = {
            # 핵심 키
            "totalAmount": totalAmount,
            "monthlyAvgSales": ms_code,
            "monthlyAvgSalesLabel": ms_label,

            "mainCategoryId": [],
            "subCategoryId": sub_ids,

            "isFranchise": isFr,                 # "0" / "1"
            "isFranchiseLabel": isFr_label,

            "address": addr_obj,
            "addressLabel": addr_label,

            "exclusiveArea": area_code,          # "1"~"6"
            "exclusiveAreaLabel": area_label,

            "option": opt_codes,                 # ["1","7",...]
            "optionLabel": opt_label,

            "categoryLabel": categoryLabel,

            # 선택/부가
            "operationPeriod": op_code,
            "operationPeriodLabel": op_label,

            "salesTimeType": st_code,
            "salesTimeTypeLabel": st_label,

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
