# ai_metrics_full_pipeline.py  (debug full)
from __future__ import annotations
import os, sys, time, json, statistics
import pandas as pd
import requests
from ast import literal_eval

# ==============================
# 환경설정
# ==============================
API_URL = "http://sajang.opentest.kr/api/ai/search/sales"

# Headers 탭의 Authorization 값을 그대로 붙여넣으세요 (만료 시 갱신 필요)
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo"

HEADERS = {
    "Authorization": AUTH_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "http://sajang.opentest.kr",
    "Referer": "http://sajang.opentest.kr/ai/search",
}

# 요청에 항상 주입할 디버그용 옵션
FORCE_TOPK = 50          # recall 확인용
FORCE_INCLUDE_SELF = True  # 자기자신 제외 방지(서버가 지원할 때)
FORCE_EXCLUDE_SELF = False

# 고정 출력 파일명 (표준 산출물)
LOG_ALL_FIXED = "ai_metric_log_all.csv"
HIT_GT_FIXED  = "ground_truth_set_hits.csv"
LOG_HIT_FIXED = "ai_metric_log_hitset.csv"

# ==============================
# 유틸
# ==============================
def nowstamp() -> str:
    return time.strftime("%Y%m%d_%H%M%S")

def p95(values: list[float]) -> float:
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
    """CSV에 문자열로 저장된 리스트도 안전하게 int list로 변환"""
    if isinstance(maybe_list, list):
        return [to_int(v) for v in maybe_list if to_int(v) is not None]
    try:
        parsed = literal_eval(maybe_list)
        if isinstance(parsed, list):
            return [to_int(v) for v in parsed if to_int(v) is not None]
        return []
    except Exception:
        return []

def inject_debug_flags(payload: dict) -> dict:
    """요청 payload에 디버그 옵션 강제 주입(서버가 지원하는 경우에만 작동)"""
    p = dict(payload)  # shallow copy
    p["topK"] = FORCE_TOPK
    p["includeSelf"] = FORCE_INCLUDE_SELF
    p["excludeSelf"] = FORCE_EXCLUDE_SELF
    return p

def parse_args():
    """
    사용법:
      python ai_metrics_full_pipeline.py ground_truth_set.csv [listings_catalog.csv]
    """
    if len(sys.argv) < 2:
        print("USAGE: python ai_metrics_full_pipeline.py <ground_truth_csv> [catalog_csv]")
        sys.exit(1)
    gt = sys.argv[1]
    catalog = sys.argv[2] if len(sys.argv) >= 3 else None
    return gt, catalog

def load_catalog_ids(catalog_csv: str | None):
    """카탈로그 CSV에서 id 컬럼을 읽어 인덱스 존재여부를 판별하는 데 사용 (옵션)"""
    if not catalog_csv:
        return None
    if not os.path.exists(catalog_csv):
        print(f"!! 카탈로그 파일이 존재하지 않습니다: {catalog_csv}")
        return None
    try:
        cdf = pd.read_csv(catalog_csv)
        # 통상 'id' 또는 'saleFranchiseId' 등의 컬럼명. 우선순위로 탐색
        for col in ["id", "saleFranchiseId", "listing_id", "매물고유번호"]:
            if col in cdf.columns:
                s = set([to_int(v) for v in cdf[col].dropna().tolist() if to_int(v) is not None])
                print(f">> catalog ids loaded: {len(s)} from column '{col}'")
                return s
        print("!! 카탈로그에서 id 컬럼을 찾지 못했습니다. (id/saleFranchiseId/listing_id/매물고유번호)")
        return None
    except Exception as e:
        print(f"!! 카탈로그 로드 실패: {e}")
        return None

# ==============================
# 측정 함수
# ==============================
def run_measure(file_name: str,
                label: str = "run",
                catalog_ids: set[int] | None = None) -> tuple[pd.DataFrame, float, float, float, int, int]:
    """
    입력 CSV(file_name)를 읽어 API를 호출/측정한다.
    CSV는 다음 컬럼을 포함:
      - payload_json (필수)
      - expected_id  (필수)
      - search_label (선택)
    반환: (로그 DataFrame, acc%, avg_ms, p95_ms, hits, total)
    """
    df = pd.read_csv(file_name)
    if "payload_json" not in df.columns or "expected_id" not in df.columns:
        raise ValueError(f"입력 파일({file_name})은 'payload_json'과 'expected_id' 컬럼을 포함해야 합니다.")

    rows, latencies = [], []
    hits = 0

    for i, r in df.iterrows():
        label_txt = r["search_label"] if "search_label" in df.columns else f"case_{i}"
        expected_id = to_int(r["expected_id"])

        # payload 로드
        try:
            payload = json.loads(r["payload_json"])
        except Exception as e:
            rows.append({
                "label": label_txt, "status": "payload_error", "hit": 0,
                "latency_ms": 0.0, "expected_id": expected_id,
                "top5_ids": [], "top5_names": [],
                "top50_contains": 0, "expected_in_catalog": 0,
                "reason_nohit": "payload_error",
                "filters_used": {}, "server_items": 0,
                "used_payload_json": r["payload_json"],
            })
            continue

        # 디버그 플래그 주입
        send_payload = inject_debug_flags(payload)

        # 의도한 필터 스냅샷(로깅용)
        filters_used = {
            "totalAmount": send_payload.get("totalAmount"),
            "monthlyAvgSales": send_payload.get("monthlyAvgSales"),
            "isFranchise": send_payload.get("isFranchise"),
            "exclusiveArea": send_payload.get("exclusiveArea"),
            "categoryLabel": send_payload.get("categoryLabel"),
            "subCategoryId": send_payload.get("subCategoryId"),
            "addressLabel": send_payload.get("addressLabel"),
        }

        # API 호출

        print(f"\n[DEBUG] sending payload for {label_txt}:\n{json.dumps(send_payload, ensure_ascii=False)}\n")

        t0 = time.perf_counter()
        try:
            resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(send_payload), timeout=25)
            status = resp.status_code
        except Exception as e:
            status = "http_error"
            resp = None
        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000.0
        latencies.append(latency_ms)

        # 응답 파싱
        top5_ids, top5_names, server_items = [], [], 0
        top50_contains = 0
        if status == 200 and resp is not None:
            try:
                data = resp.json()
                # 서버가 list로 돌려주는 형태(권장) 또는 {"results":[...]} 형태 모두 대응
                items = data if isinstance(data, list) else data.get("results", [])
                server_items = len(items)
                top5 = items[:5]
                top5_ids   = [to_int(it.get("saleFranchiseId")) for it in top5 if isinstance(it, dict)]
                top5_names = [it.get("franchiseName") for it in top5 if isinstance(it, dict)]
                # Top-50 포함여부도 계산(리콜/랭크 문제 분리)
                more = items[:50]
                top50_ids = [to_int(it.get("saleFranchiseId")) for it in more if isinstance(it, dict)]
                top50_contains = 1 if (expected_id is not None and expected_id in set(top50_ids)) else 0
            except Exception:
                status = "parse_error"

        # hit 계산
        hit = 0
        if status == 200 and expected_id is not None:
            hit = 1 if expected_id in set(top5_ids) else 0
        hits += hit

        # catalog 존재여부
        expected_in_catalog = 0
        if catalog_ids is not None and expected_id is not None:
            expected_in_catalog = 1 if expected_id in catalog_ids else 0

        # 미적중 사유 태깅
        if hit == 1:
            reason = ""
        else:
            if status != 200:
                reason = "http_error" if status == "http_error" else str(status)
            elif expected_id is None:
                reason = "expected_id_none"
            elif catalog_ids is not None and expected_in_catalog == 0:
                reason = "catalog_miss"
            elif top50_contains == 0:
                reason = "top50_miss"  # 완전 미노출(필터/카테고리/면적/프랜차이즈/주소 매핑 의심)
            else:
                reason = "rank>5"      # 50 안엔 있지만 5 안엔 없음(랭킹 튜닝 이슈)

        rows.append({
            "label": label_txt,
            "status": status,
            "hit": hit,
            "latency_ms": round(latency_ms, 1),
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
    acc   = (hits / total * 100.0) if total else 0.0
    avg   = statistics.mean(latencies) if latencies else 0.0
    p95ms = p95(latencies)

    log_df = pd.DataFrame(rows)
    print(f"\n===== [{label}] 결과 요약 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg:.1f} ms, p95 {p95ms:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")

    # 미적중 사유 분포도 간단 출력
    if "reason_nohit" in log_df.columns:
        try:
            dist = log_df["reason_nohit"].value_counts(dropna=False).to_dict()
            print(f"- nohit breakdown: {dist}")
        except Exception:
            pass

    return log_df, acc, avg, p95ms, hits, total

# ==============================
# 메인 플로우
# ==============================
def main():
    gt_file, catalog_file = parse_args()
    if not os.path.exists(gt_file):
        raise FileNotFoundError(f"입력 Ground Truth 파일 없음: {gt_file}")

    catalog_ids = load_catalog_ids(catalog_file) if catalog_file else None

    # ① 전체셋 측정
    log_all, acc_all, avg_all, p95_all, hits_all, total_all = run_measure(gt_file, label="all", catalog_ids=catalog_ids)

    ts = nowstamp()
    log_all.to_csv(LOG_ALL_FIXED, index=False, encoding="utf-8-sig")
    log_all.to_csv(f"ai_metric_log_all_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {LOG_ALL_FIXED}")

    # ② 히트셋 생성
    hit_rows = log_all[log_all["hit"] == 1]
    if hit_rows.empty:
        print("!! 경고: hit==1 케이스가 없어 히트셋을 생성/측정하지 않습니다.")
        # 힌트: 카운터/분포 요약
        if "reason_nohit" in log_all.columns:
            print("   nohit breakdown:", log_all["reason_nohit"].value_counts(dropna=False).to_dict())
        print("\n===== 최종 요약 =====")
        print(f"[ALL]  Acc {acc_all:.2f}%, Avg {avg_all:.1f}ms, p95 {p95_all:.1f}ms, {hits_all}/{total_all}")
        return

    gt_hit = hit_rows[["used_payload_json", "expected_id", "label"]].copy()
    gt_hit.rename(columns={
        "used_payload_json": "payload_json",
        "label": "search_label",
    }, inplace=True)

    gt_hit.to_csv(HIT_GT_FIXED, index=False, encoding="utf-8-sig")
    gt_hit.to_csv(f"ground_truth_set_hits_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {HIT_GT_FIXED} (rows={len(gt_hit)})")

    # ③ 히트셋 재측정
    log_hit, acc_hit, avg_hit, p95_hit, hits_hit, total_hit = run_measure(HIT_GT_FIXED, label="hitset", catalog_ids=catalog_ids)
    log_hit.to_csv(LOG_HIT_FIXED, index=False, encoding="utf-8-sig")
    log_hit.to_csv(f"ai_metric_log_hitset_{ts}.csv", index=False, encoding="utf-8-sig")
    print(f">> 저장: {LOG_HIT_FIXED}")

    # ④ 요약
    print("\n===== 최종 요약 =====")
    print(f"[ALL]  Acc {acc_all:.2f}%, Avg {avg_all:.1f}ms, p95 {p95_all:.1f}ms, {hits_all}/{total_all}")
    print(f"[HIT]  Acc {acc_hit:.2f}%, Avg {avg_hit:.1f}ms, p95 {p95_hit:.1f}ms, {hits_hit}/{total_hit}")

if __name__ == "__main__":
    main()
