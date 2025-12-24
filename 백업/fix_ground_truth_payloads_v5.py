# fix_ground_truth_payloads_v5.py
from __future__ import annotations
import json, math, re
import pandas as pd
from ast import literal_eval

IN_CSV  = "ground_truth_set.csv"
OUT_CSV = "ground_truth_set_v5.csv"

# ---- helpers ---------------------------------------------------------------
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

AREA_BUCKETS = ["ANY","10평 이하","10~20평","20~30평","30~40평","40평 이상"]

def norm_area_label(val):
    """exclusiveArea → 허용 라벨로 정규화"""
    if val is None or str(val).strip() == "" or str(val).upper() == "ANY":
        return "ANY"
    s = str(val).strip()
    # '40평 이상', '30~40평'처럼 이미 라벨이면 통과(허용 세트로 맵)
    if s in AREA_BUCKETS:
        return s
    # '40.0평', '40평 이상' 등 숫자 포함 케이스 파싱
    num = None
    m = re.search(r"([\d\.]+)", s)
    if m:
        try:
            num = float(m.group(1))
        except Exception:
            num = None
    if num is not None:
        # num은 평수로 가정
        if num < 10:   return "10평 이하"
        if num < 20:   return "10~20평"
        if num < 30:   return "20~30평"
        if num < 40:   return "30~40평"
        return "40평 이상"
    # 숫자 파싱이 안 되면 보수적으로 ANY 처리
    return "ANY"

def to_sales_bucket(v):
    """monthlyAvgSales 숫자 → 구간 라벨.  단위는 '만원' 기준으로 가정."""
    if v is None: return "ANY"
    x = to_int(v)
    if x is None or x <= 0:
        return "ANY"
    # 구간 기준(필요 시 개발팀 규격에 맞게 조정)
    if x < 3000:   return "3천만원 이하"
    if x < 7000:   return "3천~7천만원"
    if x < 10000:  return "7천만원~1억원"
    return "1억원 이상"

def norm_total_amount(v):
    """totalAmount → 만원 단위 정수"""
    x = to_int(v)
    if x is None: return 0
    # 원 단위로 들어온 큰 값이면 만원으로 변환
    if x > 100000:  # 임계치는 현장 데이터 규모에 맞게 조정 가능
        x = int(round(x / 10000))
    return x

def clean_payload(pl):
    """payload_json dict를 스키마/타입에 맞게 교정"""
    p = dict(pl)  # shallow copy

    # 디버그 키 제거(서버가 모르면 400 가능)
    for k in ["topK","includeSelf","excludeSelf","monthlyAvgSalesLabel","optionLabel","exclusiveAreaLabel"]:
        if k in p: p.pop(k, None)

    # totalAmount
    if "totalAmount" in p:
        p["totalAmount"] = norm_total_amount(p.get("totalAmount"))

    # monthlyAvgSales: 숫자 -> 구간 라벨, 이미 문자열이면 허용 라벨만
    mav = p.get("monthlyAvgSales")
    if isinstance(mav, (int,float)) or (isinstance(mav, str) and mav.isdigit()):
        p["monthlyAvgSales"] = to_sales_bucket(mav)
    else:
        s = str(mav).strip().upper() if mav is not None else "ANY"
        if s == "" or s == "ANY":
            p["monthlyAvgSales"] = "ANY"
        else:
            # 사람이 쓴 임의 문자열이면 파싱 어려우므로 ANY 처리(필요 시 매핑 테이블 적용)
            p["monthlyAvgSales"] = to_sales_bucket(mav)

    # isFranchise: "1"/"0" → 1/0
    if "isFranchise" in p:
        iv = p["isFranchise"]
        if isinstance(iv, str):
            ivs = iv.strip()
            if ivs in ["1","0"]:
                p["isFranchise"] = int(ivs)
            elif ivs in ["TRUE","FALSE","true","false"]:
                p["isFranchise"] = 1 if ivs.lower()=="true" else 0
            else:
                # 알 수 없는 문자열이면 0으로 보정(보수적으로)
                p["isFranchise"] = 0
        elif isinstance(iv, bool):
            p["isFranchise"] = 1 if iv else 0
        elif isinstance(iv, (int,float)):
            p["isFranchise"] = 1 if int(iv)!=0 else 0
        else:
            p["isFranchise"] = 0

    # subCategoryId: int list로
    if "subCategoryId" in p:
        p["subCategoryId"] = to_int_list(p["subCategoryId"])

    # exclusiveArea: 허용 라벨로 규격화
    if "exclusiveArea" in p:
        p["exclusiveArea"] = norm_area_label(p["exclusiveArea"])
    else:
        p["exclusiveArea"] = "ANY"

    # address: 필수 키 존재/문자열화
    addr = p.get("address") or {}
    addr = {
        "sidoName": str(addr.get("sidoName") or "").strip(),
        "gunName":  str(addr.get("gunName")  or "").strip(),
        "dongName": str(addr.get("dongName") or "").strip(),
    }
    p["address"] = addr

    # categoryLabel: 문자열화
    if "categoryLabel" in p and p["categoryLabel"] is None:
        p["categoryLabel"] = ""

    # mainCategoryId: 없으면 빈 리스트 유지
    if "mainCategoryId" in p and p["mainCategoryId"] is None:
        p["mainCategoryId"] = []

    # option: 없으면 빈 리스트
    if "option" in p and p["option"] is None:
        p["option"] = []

    return p

# ---- run -------------------------------------------------------------------
def main():
    df = pd.read_csv(IN_CSV)
    if "payload_json" not in df.columns:
        raise ValueError(f"{IN_CSV} 에 'payload_json' 컬럼이 없습니다.")

    fixed_rows = []
    for i, r in df.iterrows():
        raw = r["payload_json"]
        try:
            pl = json.loads(raw)
        except Exception:
            # CSV에 따옴표-이중인용 등으로 문자열이 꼬였을 때 복구 시도
            try:
                pl = json.loads(str(raw).encode("utf-8","ignore").decode("utf-8","ignore"))
            except Exception:
                # 마지막으로 literal_eval 시도
                try:
                    pl = literal_eval(str(raw))
                except Exception:
                    pl = {}

        fixed = clean_payload(pl)
        r2 = r.copy()
        r2["payload_json"] = json.dumps(fixed, ensure_ascii=False)
        fixed_rows.append(r2)

    out = pd.DataFrame(fixed_rows)
    out.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"✅ 변환 완료: {OUT_CSV} (rows={len(out)})")

    # 샘플 3개만 눈으로 확인
    for j in range(min(3, len(out))):
        print(f"\n--- sample {j} ---")
        print(out.iloc[j]["payload_json"])

if __name__ == "__main__":
    main()
