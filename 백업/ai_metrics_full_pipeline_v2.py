# ai_metrics_full_pipeline_v2.py
from __future__ import annotations
import os, sys, time, json, statistics
import pandas as pd
import requests
from ast import literal_eval

API_URL = "http://sajang.opentest.kr/api/ai/search/sales"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo"

HEADERS = {
    "Authorization": AUTH_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "http://sajang.opentest.kr",
    "Referer": "http://sajang.opentest.kr/ai/search",
}

LOG_ALL_FIXED = "ai_metric_log_all.csv"
HIT_GT_FIXED  = "ground_truth_set_hits.csv"
LOG_HIT_FIXED = "ai_metric_log_hitset.csv"

AREA_BUCKETS = ["ANY","10평 이하","10~20평","20~30평","30~40평","40평 이상"]

def nowstamp(): return time.strftime("%Y%m%d_%H%M%S")

def p95(values):
    if not values: return 0.0
    if len(values) == 1: return float(values[0])
    return statistics.quantiles(values, n=20)[18]

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
    x = to_int(v)
    if x is None: return 0
    if x > 100000: x = int(round(x/10000))
    return x

def to_sales_bucket(v):
    if v is None: return "ANY"
    x = to_int(v)
    if x is None or x <= 0: return "ANY"
    if x < 3000:   return "3천만원 이하"
    if x < 7000:   return "3천~7천만원"
    if x < 10000:  return "7천만원~1억원"
    return "1억원 이상"

def norm_area_label(val):
    if val is None: return "ANY"
    s = str(val).strip()
    if s == "" or s.upper()=="ANY": return "ANY"
    if s in AREA_BUCKETS: return s
    # 숫자 추출
    import re
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
            return "ANY"
    for b in AREA_BUCKETS:
        if b.replace(" ","") in s.replace(" ",""):
            return b
    return "ANY"

def looks_like_roadname(s: str) -> bool:
    s = (s or "").strip()
    if not s: return False
    if s.endswith("로") or s.endswith("길"): return True
    if any(ch.isdigit() for ch in s): return True
    if "번길" in s or "번지" in s or "호" in s: return True
    return False

def norm_dong_name(s):
    s = (s or "").strip()
    if not s: return ""
    return "" if looks_like_roadname(s) else s

def sanitize_payload(payload: dict) -> dict:
    """요청 전 최종 보정(안전장치)"""
    p = dict(payload)

    # 디버그/라벨 키 제거
    for k in ["topK","includeSelf","excludeSelf","monthlyAvgSalesLabel","optionLabel","exclusiveAreaLabel","isFranchiseLabel","addressLabel"]:
        p.pop(k, None)

    # 금액
    if "totalAmount" in p:
        p["totalAmount"] = norm_total_amount(p.get("totalAmount"))

    # 매출
    mav = p.get("monthlyAvgSales")
    if isinstance(mav, (int,float)) or (isinstance(mav, str) and mav.isdigit()):
        p["monthlyAvgSales"] = to_sales_bucket(mav)
    else:
        s = (str(mav) if mav is not None else "").strip()
        p["monthlyAvgSales"] = "ANY" if s=="" or s.upper()=="ANY" else to_sales_bucket(mav)

    # 프랜차이즈
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

    # 업종
    if "subCategoryId" in p:
        ids = to_int_list(p["subCategoryId"])
        ids = [i for i in ids if i and i > 0]
        if ids:
            p["subCategoryId"] = ids
        else:
            p.pop("subCategoryId", None)

    # 면적
    p["exclusiveArea"] = norm_area_label(p.get("exclusiveArea"))

    # 주소
    addr = p.get("address") or {}
    p["address"] = {
        "sidoName": str(addr.get("sidoName") or "").strip(),
        "gunName":  str(addr.get("gunName")  or "").strip(),
        "dongName": norm_dong_name(addr.get("dongName")),
    }

    # 나머지 기본형
    if p.get("mainCategoryId") is None:
        p["mainCategoryId"] = []
    if p.get("option") is None:
        p["option"] = []
    if "categoryLabel" in p and p["categoryLabel"] is None:
        p["categoryLabel"] = ""

    return p

def parse_args():
    if len(sys.argv) < 2:
        print("USAGE: python ai_metrics_full_pipeline_v2.py <ground_truth_csv> [catalog_csv]")
        sys.exit(1)
    gt = sys.argv[1]
    catalog = sys.argv[2] if len(sys.argv) >= 3 else None
    return gt, catalog

def load_catalog_ids(catalog_csv: str | None):
    if not catalog_csv or not os.path.exists(catalog_csv):
        return None
    try:
        cdf = pd.read_csv(catalog_csv)
        for col in ["id","saleFranchiseId","listing_id","매물고유번호"]:
            if col in cdf.columns:
                s = set([to_int(v) for v in cdf[col].dropna().tolist() if to_int(v) is not None])
                print(f">> catalog ids loaded: {len(s)} from '{col}'")
                return s
        print("!! catalog id column not found (id/saleFranchiseId/listing_id/매물고유번호)")
        return None
    except Exception as e:
        print(f"!! failed to load catalog: {e}")
        return None

def run_measure(file_name: str, label: str = "run", catalog_ids: set[int] | None = None):
    df = pd.read_csv(file_name)
    if "payload_json" not in df.columns or "expected_id" not in df.columns:
        raise ValueError(f"{file_name} 는 'payload_json'과 'expected_id'가 필요합니다.")

    rows, latencies, hits = [], [], 0

    for i, r in df.iterrows():
        label_txt   = r["search_label"] if "search_label" in df.columns else f"case_{i}"
        expected_id = to_int(r["expected_id"])

        # payload load & sanitize
        try:
            raw = r["payload_json"]
            payload = json.loads(raw)
        except Exception:
            try:
                payload = literal_eval(str(r["payload_json"]))
            except Exception:
                payload = {}
        send_payload = sanitize_payload(payload)

        # filters snapshot
        filters_used = {
            "totalAmount": send_payload.get("totalAmount"),
            "monthlyAvgSales": send_payload.get("monthlyAvgSales"),
            "isFranchise": send_payload.get("isFranchise"),
            "exclusiveArea": send_payload.get("exclusiveArea"),
            "categoryLabel": send_payload.get("categoryLabel"),
            "subCategoryId": send_payload.get("subCategoryId"),
            "address": send_payload.get("address"),
        }

        # call
        t0 = time.perf_counter()
        try:
            resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(send_payload), timeout=25)
            status = resp.status_code
        except Exception:
            resp = None
            status = "http_error"
        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000.0
        latencies.append(latency_ms)

        top5_ids, top5_names, server_items, top50_contains = [], [], 0, 0

        if status == 200 and resp is not None:
            try:
                data = resp.json()
                items = data if isinstance(data, list) else data.get("results", [])
                server_items = len(items)
                top5 = items[:5]
                top5_ids   = [to_int(it.get("saleFranchiseId")) for it in top5 if isinstance(it, dict)]
                top5_names = [it.get("franchiseName") for it in top5 if isinstance(it, dict)]
                top50_ids  = [to_int(it.get("saleFranchiseId")) for it in items[:50] if isinstance(it, dict)]
                top50_contains = 1 if (expected_id is not None and expected_id in set(top50_ids)) else 0
            except Exception:
                status = "parse_error"

        hit = 1 if (status==200 and expected_id is not None and expected_id in set(top5_ids)) else 0
        hits += hit

        expected_in_catalog = 0
        if catalog_ids is not None and expected_id is not None:
            expected_in_catalog = 1 if expected_id in catalog_ids else 0

        if hit == 1:
            reason = ""
        else:
            if status != 200:
                reason = str(status)
            elif expected_id is None:
                reason = "expected_id_none"
            elif catalog_ids is not None and expected_in_catalog == 0:
                reason = "catalog_miss"
            elif top50_contains == 0:
                reason = "top50_miss"
            else:
                reason = "rank>5"

        rows.append({
            "label": label_txt,
            "status": status,
            "hit": hit,
            "latency_ms": round(latency_ms,1),
            "expected_id": expected_id,
            "top5_ids": [v for v in top5_ids if v is not None],
            "top5_names": top5_names,
            "top50_contains": top50_contains,
            "expected_in_catalog": expected_in_catalog,
            "reason_nohit": reason,
            "filters_used": filters_used,
            "server_items": server_items,
            "used_payload_json": json.dumps(send_payload, ensure_ascii=False),
        })

    total = len(rows)
    acc   = (hits/total*100.0) if total else 0.0
    avg   = statistics.mean(latencies) if latencies else 0.0
    p95ms = p95(latencies)

    log_df = pd.DataFrame(rows)
    print(f"\n===== [{label}] 결과 요약 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg:.1f} ms, p95 {p95ms:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")
    if "reason_nohit" in log_df.columns:
        try:
            print("- nohit breakdown:", log_df["reason_nohit"].value_counts(dropna=False).to_dict())
        except Exception:
            pass

    return log_df, acc, avg, p95ms, hits, total

def main():
    gt_file, catalog_file = parse_args()
    if not os.path.exists(gt_file):
        raise FileNotFoundError(f"GT 파일 없음: {gt_file}")
    catalog_ids = load_catalog_ids(catalog_file) if catalog_file else None

    log_all, acc_all, avg_all, p95_all, hits_all, total_all = run_measure(gt_file, label="all", catalog_ids=catalog_ids)
    ts = nowstamp()
    log_all.to_csv(LOG_ALL_FIXED, index=False, encoding="utf-8-sig")
    log_all.to_csv(f"ai_metric_log_all_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {LOG_ALL_FIXED}")

    hit_rows = log_all[log_all["hit"] == 1]
    if hit_rows.empty:
        print("!! 경고: hit==1 케이스가 없어 히트셋을 생성/측정하지 않습니다.")
        if "reason_nohit" in log_all.columns:
            print("   nohit breakdown:", log_all["reason_nohit"].value_counts(dropna=False).to_dict())
        print("\n===== 최종 요약 =====")
        print(f"[ALL]  Acc {acc_all:.2f}%, Avg {avg_all:.1f}ms, p95 {p95_all:.1f}ms, {hits_all}/{total_all}")
        return

    gt_hit = hit_rows[["used_payload_json", "expected_id", "label"]].copy()
    gt_hit.rename(columns={"used_payload_json":"payload_json","label":"search_label"}, inplace=True)
    gt_hit.to_csv(HIT_GT_FIXED, index=False, encoding="utf-8-sig")
    gt_hit.to_csv(f"ground_truth_set_hits_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {HIT_GT_FIXED} (rows={len(gt_hit)})")

    log_hit, acc_hit, avg_hit, p95_hit, hits_hit, total_hit = run_measure(HIT_GT_FIXED, label="hitset", catalog_ids=catalog_ids)
    log_hit.to_csv(LOG_HIT_FIXED, index=False, encoding="utf-8-sig")
    log_hit.to_csv(f"ai_metric_log_hitset_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {LOG_HIT_FIXED}")

    print("\n===== 최종 요약 =====")
    print(f"[ALL]  Acc {acc_all:.2f}%, Avg {avg_all:.1f}ms, p95 {p95_all:.1f}ms, {hits_all}/{total_all}")
    print(f"[HIT]  Acc {acc_hit:.2f}%, Avg {avg_hit:.1f}ms, p95 {p95_hit:.1f}ms, {hits_hit}/{total_hit}")

if __name__ == "__main__":
    main()
