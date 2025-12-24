# fix_ground_truth_payloads_v6.py
from __future__ import annotations
import json, re
import pandas as pd
from ast import literal_eval

IN_CSV  = "ground_truth_set.csv"
OUT_CSV = "ground_truth_set_v6.csv"

AREA_BUCKETS = ["ANY","10평 이하","10~20평","20~30평","30~40평","40평 이상"]

def to_int(x):
    try:
        return int(x)
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return None

def to_int_list(maybe_list):
    if isinstance(maybe_list, list):
        return [to_int(v) for v in maybe_list if to_int(v) is not None]
    try:
        parsed = literal_eval(str(maybe_list))
        if isinstance(parsed, list):
            return [to_int(v) for v in parsed if to_int(v) is not None]
    except Exception:
        pass
    return []

def norm_total_amount(v):
    """totalAmount → 만원 단위 정수"""
    x = to_int(v)
    if x is None:
        return 0
    # 원 단위로 보이는 큰 값은 만원 환산
    if x > 100000:  # 현장 기준에 맞게 필요시 조정
        x = int(round(x / 10000))
    return x

def to_sales_bucket(v):
    """monthlyAvgSales 숫자(만원) → 구간 라벨"""
    if v is None:
        return "ANY"
    x = to_int(v)
    if x is None or x <= 0:
        return "ANY"
    if x < 3000:   return "3천만원 이하"
    if x < 7000:   return "3천~7천만원"
    if x < 10000:  return "7천만원~1억원"
    return "1억원 이상"

def norm_area_label(val):
    """exclusiveArea → 허용 라벨로 정규화"""
    if val is None:
        return "ANY"
    s = str(val).strip()
    if s == "" or s.upper() == "ANY":
        return "ANY"
    if s in AREA_BUCKETS:
        return s
    # '40.0평', '40평 이상', '10~20평' 등 숫자 추출
    m = re.search(r"([\d\.]+)", s)
    if m:
        try:
            num = float(m.group(1))
            if num < 10:  return "10평 이하"
            if num < 20:  return "10~20평"
            if num < 30:  return "20~30평"
            if num < 40:  return "30~40평"
            return "40평 이상"
        except Exception:
            pass
    # 라벨로 추정되는 문자열을 일부 허용
    for b in AREA_BUCKETS:
        if b.replace(" ", "") in s.replace(" ", ""):
            return b
    return "ANY"

def looks_like_roadname(s: str) -> bool:
    """'...로', '...길', 숫자/호/번 포함 → 도로명/지번 가능성"""
    s = (s or "").strip()
    if not s: return False
    if s.endswith("로") or s.endswith("길"):
        return True
    if any(ch.isdigit() for ch in s):
        return True
    if "번길" in s or "번지" in s or "호" in s:
        return True
    return False

def norm_dong_name(s):
    s = (s or "").strip()
    if not s: return ""
    return "" if looks_like_roadname(s) else s

def clean_payload(pl: dict) -> dict:
    p = dict(pl)

    # 디버그 키 제거
    for k in ["topK","includeSelf","excludeSelf","monthlyAvgSalesLabel","optionLabel","exclusiveAreaLabel","isFranchiseLabel","addressLabel"]:
        p.pop(k, None)

    # totalAmount
    if "totalAmount" in p:
        p["totalAmount"] = norm_total_amount(p.get("totalAmount"))

    # monthlyAvgSales
    mav = p.get("monthlyAvgSales")
    if isinstance(mav, (int, float)) or (isinstance(mav, str) and mav.isdigit()):
        p["monthlyAvgSales"] = to_sales_bucket(mav)
    else:
        s = (str(mav) if mav is not None else "").strip()
        p["monthlyAvgSales"] = "ANY" if s == "" or s.upper()=="ANY" else to_sales_bucket(mav)

    # isFranchise
    if "isFranchise" in p:
        iv = p["isFranchise"]
        if isinstance(iv, str):
            ivs = iv.strip().lower()
            if ivs in ["1","true","yes","y"]:
                p["isFranchise"] = 1
            elif ivs in ["0","false","no","n"]:
                p["isFranchise"] = 0
            else:
                p["isFranchise"] = 0
        elif isinstance(iv, bool):
            p["isFranchise"] = 1 if iv else 0
        elif isinstance(iv, (int,float)):
            p["isFranchise"] = 1 if int(iv)!=0 else 0
        else:
            p["isFranchise"] = 0

    # subCategoryId
    if "subCategoryId" in p:
        ids = to_int_list(p["subCategoryId"])
        ids = [i for i in ids if i and i > 0]
        if ids:
            p["subCategoryId"] = ids
        else:
            p.pop("subCategoryId", None)  # [0] 또는 잘못된 값이면 아예 제거

    # exclusiveArea
    p["exclusiveArea"] = norm_area_label(p.get("exclusiveArea"))

    # address
    addr = p.get("address") or {}
    p["address"] = {
        "sidoName": str(addr.get("sidoName") or "").strip(),
        "gunName":  str(addr.get("gunName")  or "").strip(),
        "dongName": norm_dong_name(addr.get("dongName")),
    }

    # categoryLabel 정상화
    if "categoryLabel" in p and p["categoryLabel"] is None:
        p["categoryLabel"] = ""

    # mainCategoryId, option 기본형
    if p.get("mainCategoryId") is None:
        p["mainCategoryId"] = []
    if p.get("option") is None:
        p["option"] = []

    return p

def main():
    df = pd.read_csv(IN_CSV)
    if "payload_json" not in df.columns:
        raise ValueError(f"{IN_CSV} 에 'payload_json' 컬럼이 없습니다.")

    fixed = []
    for _, r in df.iterrows():
        raw = r["payload_json"]
        try:
            pl = json.loads(raw)
        except Exception:
            try:
                pl = literal_eval(str(raw))
            except Exception:
                pl = {}
        cleaned = clean_payload(pl)
        r2 = r.copy()
        r2["payload_json"] = json.dumps(cleaned, ensure_ascii=False)
        fixed.append(r2)

    out = pd.DataFrame(fixed)
    out.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"✅ 변환 완료: {OUT_CSV} (rows={len(out)})")

    # 샘플 출력
    for j in range(min(3, len(out))):
        print(f"\n--- sample {j} ---")
        print(out.iloc[j]["payload_json"])

if __name__ == "__main__":
    main()
