from __future__ import annotations
import pandas as pd, json, math

RAW_XLSX = "raw.xlsx"
MAP_JSON = "mapping_config.json"
OUT_CSV  = "ground_truth_set_v10_min.csv"

# 월매출 라벨(서버 프론트 기준)
def monthly_sales_label_from_won(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "상관없음"
    try:
        won = int(v)
    except Exception:
        return "상관없음"
    man = won // 10000
    if man < 3000:   return "3천만원 이하"
    if man < 7000:   return "3천~7천만원"
    if man < 10000:  return "7천~1억원"
    return "1억원 이상"

def safe_int(x, default=0):
    try: return int(x)
    except: 
        try: return int(float(x))
        except: return default

def norm_total_amount_from_raw(takeover_amount, premium, deposit):
    iv = safe_int(takeover_amount, 0)
    base = iv if iv>0 else safe_int(premium,0) + safe_int(deposit,0)
    if base > 100000:
        base = round(base/10000)
    return int(base)

def build_category_maps(mp):
    sub_map  = { int(r["sub_category_id"]) : str(r["name"])
                 for r in mp.get("sub_category",[]) if pd.notna(r.get("sub_category_id")) }
    return sub_map

def split_address(addr: str):
    s = (addr or "").strip()
    if not s: return {"sidoName":"", "gunName":"", "dongName":""}, ""
    parts = s.split()
    sido = parts[0] if parts else ""
    gun  = parts[1] if len(parts)>1 else ""
    # 동/읍/면/리만 dongName, 아니면 비움
    dong = ""
    for p in parts[2:]:
        if p.endswith(("동","읍","면","리")):
            dong = p
            break
    return {"sidoName":sido, "gunName":gun, "dongName":dong}, s

def main():
    raw = pd.read_excel(RAW_XLSX, sheet_name=0)
    with open(MAP_JSON, "r", encoding="utf-8") as f:
        mp = json.load(f)
    sub_map = build_category_maps(mp)

    rows = []
    for _, r in raw.iterrows():
        sale_id = r.get("sale_franchise_id")

        totalAmount = norm_total_amount_from_raw(r.get("takeover_amount"), r.get("premium"), r.get("deposit"))

        # isFranchise: 서버 스펙 0=프차, 1=개인
        raw_is_fr = safe_int(r.get("is_franchise"),0)  # 원천: 지점명 있으면 1(프차), 없으면 0(개인)
        isFr = "0" if raw_is_fr==1 else "1"           # 프차(1) → "0", 개인(0) → "1"
        isFrLabel = "프랜차이즈" if isFr=="0" else "개인"

        # 주소
        addr_obj, addr_label = split_address(r.get("address"))

        # 업종
        sub_id = safe_int(r.get("sub_category_id"), 0)
        sub_ids = [sub_id] if sub_id>0 else [0]
        categoryLabel = sub_map.get(sub_id, "상관없음")

        # 월매출/평형: 우선 ANY로 보내 200 확보
        monthly_label = "ANY"  # 또는 monthly_sales_label_from_won(...)
        exclusive_label = "ANY"

        payload = {
            "totalAmount": totalAmount,
            "monthlyAvgSales": monthly_label,
            "monthlyAvgSalesLabel": "" if monthly_label=="ANY" else monthly_label,
            "mainCategoryId": [],
            "subCategoryId": sub_ids,

            # ✅ 서버 스펙 0=프랜차이즈, 1=개인
            "isFranchise": isFr,
            "isFranchiseLabel": isFrLabel,

            "address": addr_obj,
            "addressLabel": addr_label,

            "exclusiveArea": exclusive_label,
            "exclusiveAreaLabel": "상관없음" if exclusive_label=="ANY" else exclusive_label,

            # ✅ 결과에 자기 자신이 포함되도록 강제
            "includeSelf": True,
            "excludeSelf": False,
            "topK": 50,

            # 우선 옵션 비움(200 확보 후 단계적으로 추가)
            "option": [],
            "optionLabel": "없음",

            "categoryLabel": categoryLabel
        }

        label = f'{addr_label} {categoryLabel} {totalAmount}만원'
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
