# build_ground_truth_from_raw_v4.py
import pandas as pd
import json, math

RAW_XLSX = "양도양수매물리스트 다운로드.xlsx"
OUT_CSV  = "ground_truth_set_v4.csv"

# =========================
# 구성 옵션
# =========================
# (중요) 지점명이 있으면 1=프랜차이즈 규칙 사용 여부
FRANCHISE_ONE_MEANS_FRANCHISE = True

# 업종 → subCategoryId 매핑표 (실제 ID로 교체 권장)
CATEGORY_MAP = {
    "한식": 1, "중식": 2, "일식": 3, "서양식": 4,
    "분식": 5, "카페": 6
}

def area_bucket_pyung(pyung):
    if pyung is None or not math.isfinite(pyung): return "상관없음"
    if pyung < 10:  return "10평 미만"
    if pyung < 20:  return "10~20평"
    if pyung < 30:  return "20~30평"
    if pyung < 40:  return "30~40평"
    return "40평 이상"

def s_int(x):
    try:
        if pd.isna(x): return None
        return int(x)
    except:
        try: return int(float(x))
        except: return None

def s_float(x):
    try:
        if pd.isna(x): return None
        return float(x)
    except:
        return None

def build_option_label(row):
    opts = []
    if str(row.get("직원 승계 가능 여부","")).strip() in ("Y","y","예","가능","True","true","1"):
        opts.append("직원 승계 가능")
    months = s_int(row.get("운영기간"))
    if months is not None and months >= 12:
        opts.append("영업기간 1년 이상")
    if "즉시" in str(row.get("매매 가능 일정","")).strip():
        opts.append("양도 즉시가능")
    return ", ".join(opts) if opts else "없음"

def build_payload(row):
    # 합계금액
    total_amount = s_int(row.get("인수금"))
    if total_amount is None:
        dep, prem = s_int(row.get("보증금")), s_int(row.get("권리금"))
        if dep is not None and prem is not None:
            total_amount = dep + prem
    if total_amount is None: total_amount = 0

    # 월평균 매출액 → monthlyAvgSales
    monthly = s_int(row.get("월평균 매출액"))
    monthlyAvgSales = monthly if monthly is not None else "ANY"

    # 업종 → subCategoryId / categoryLabel
    cat_text = str(row.get("업종","")).strip()
    subcat_id = CATEGORY_MAP.get(cat_text, 0)
    category_label = cat_text if cat_text else "상관없음"

    # 프랜차이즈 여부 (지점명 유무)
    has_branch = str(row.get("지점명","")).strip() != ""
    if FRANCHISE_ONE_MEANS_FRANCHISE:
        is_franchise = "1" if has_branch else "0"   # 1=프차, 0=개인 (대표님 규칙)
    else:
        is_franchise = "0" if has_branch else "1"   # (과거 API 관행 반전)
    is_franchise_label = "프랜차이즈" if has_branch else "개인"

    # 평수: ㎡ → 평
    area_m2 = s_float(row.get("전용면적"))
    pyung = (area_m2/3.3) if (area_m2 and area_m2>0) else None
    area_bucket = area_bucket_pyung(pyung)

    # 옵션
    option_label = build_option_label(row)

    # 주소
    addr = str(row.get("주소","")).strip()
    parts = addr.split()
    sido = parts[0] if len(parts)>0 else ""
    gun  = parts[1] if len(parts)>1 else ""
    dong = parts[2] if len(parts)>2 else ""

    return {
        "totalAmount": total_amount,
        "monthlyAvgSales": monthlyAvgSales,
        "monthlyAvgSalesLabel": "" if monthly is not None else "상관없음",
        "mainCategoryId": [],
        "subCategoryId": [subcat_id],
        "isFranchise": is_franchise,
        "isFranchiseLabel": is_franchise_label,
        "address": {"sidoName": sido, "gunName": gun, "dongName": dong},
        "addressLabel": addr,
        "exclusiveArea": area_bucket,
        "exclusiveAreaLabel": area_bucket,
        "option": [],
        "optionLabel": option_label,
        "categoryLabel": category_label
    }

def main():
    df = pd.read_excel(RAW_XLSX)
    rows = []
    for _, r in df.iterrows():
        addr = str(r.get("주소","")).strip()
        cat  = str(r.get("업종","")).strip()
        inc  = s_int(r.get("인수금"))
        area = s_float(r.get("전용면적"))
        py   = (area/3.3) if (area and area>0) else None
        label = f"{addr} {cat} {inc if inc is not None else ''}만원 {f'{py:.1f}평' if py else ''}".strip()

        payload = build_payload(r)
        expected_id = r.get("매물고유번호")

        rows.append({
            "search_label": label,
            "expected_id": expected_id,
            "payload_json": json.dumps(payload, ensure_ascii=False)
        })

    out = pd.DataFrame(rows)
    out.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"✅ 생성 완료: {OUT_CSV} (총 {len(out)}건)")
    print(out.head(3).to_string(index=False))

if __name__ == "__main__":
    main()
