# ai_metrics_full_pipeline_v4.py
import sys
import os
import json
import time
import statistics
import requests
import pandas as pd

API_URL = "http://sajang.opentest.kr/api/ai/search/sales"
AUTH_TOKEN = os.environ.get("AI_SAJANG_JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo").strip()

HEADERS = {
    "Authorization": AUTH_TOKEN,  # 반드시 브라우저 Network 탭의 Authorization(JWT) 값
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "http://sajang.opentest.kr",
    "Referer": "http://sajang.opentest.kr/ai/search",
}

def p95(values):
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    # 95th percentile
    return statistics.quantiles(values, n=20)[18]

def run_measure(gt_csv: str, out_log: str):
    df = pd.read_csv(gt_csv)
    rows, latencies, hits = [], [], 0
    status_counts = {}

    for _, r in df.iterrows():
        payload = json.loads(r["payload_json"])

        # salesTimeType / operationPeriod가 dict 형태(코드+라벨)면 서버 호환을 위해 code로 평탄화
        if isinstance(payload.get("salesTimeType"), dict) and "code" in payload["salesTimeType"]:
            payload["salesTimeTypeLabel"] = payload["salesTimeType"].get("label", "")
            payload["salesTimeType"] = payload["salesTimeType"].get("code", "4")

        if isinstance(payload.get("operationPeriod"), dict) and "code" in payload["operationPeriod"]:
            payload["operationPeriodLabel"] = payload["operationPeriod"].get("label", "")
            payload["operationPeriod"] = payload["operationPeriod"].get("code", "0")

        expected_id = int(r["expected_id"])
        label = str(r.get("search_label", ""))

        t0 = time.perf_counter()
        resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(payload), timeout=20)
        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000
        latencies.append(latency_ms)

        status = resp.status_code
        status_counts[str(status)] = status_counts.get(str(status), 0) + 1

        if status != 200:
            rows.append({
                "label": label,
                "status": status,
                "hit": 0,
                "latency_ms": round(latency_ms, 1),
                "expected_id": expected_id,
                "top5_ids": [],
                "top5_names": [],
                "used_payload_json": json.dumps(payload, ensure_ascii=False)
            })
            continue

        data = resp.json()
        top5 = data[:5] if isinstance(data, list) else data.get("results", [])[:5]
        top5_ids = [int(it.get("saleFranchiseId")) for it in top5 if isinstance(it, dict) and it.get("saleFranchiseId") is not None]
        top5_names = [str(it.get("franchiseName", "")) for it in top5 if isinstance(it, dict)]

        hit = 1 if expected_id in top5_ids else 0
        hits += hit

        rows.append({
            "label": label,
            "status": status,
            "hit": hit,
            "latency_ms": round(latency_ms, 1),
            "expected_id": expected_id,
            "top5_ids": top5_ids,
            "top5_names": top5_names,
            "used_payload_json": json.dumps(payload, ensure_ascii=False)
        })

    total = len(rows)
    acc = (hits / total * 100) if total else 0.0
    avg_ms = statistics.mean(latencies) if latencies else 0.0
    p95_ms = p95(latencies)

    log_df = pd.DataFrame(rows)
    log_df.to_csv(out_log, index=False, encoding="utf-8-sig")
    return log_df, acc, avg_ms, p95_ms, hits, total, status_counts

def main():
    if len(sys.argv) < 2:
        print("USAGE: python ai_metrics_full_pipeline_v4.py <ground_truth_csv>")
        sys.exit(1)

    gt_csv = sys.argv[1]
    out_log = "ai_metric_log_all.csv"

    if not AUTH_TOKEN:
        print("ERROR: 환경변수 AI_SAJANG_JWT 가 설정되어 있지 않습니다. PowerShell에서 다음을 실행하세요:")
        print('  setx AI_SAJANG_JWT "<브라우저 Headers.Authorization 값>"')
        sys.exit(1)

    print(f">> USING GT FILE: {gt_csv}")
    log, acc, avg_ms, p95_ms, hits, total, stc = run_measure(gt_csv, out_log)

    print("\n===== [all] 결과 요약 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg_ms:.1f} ms, p95 {p95_ms:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")
    print(f"- status breakdown: {stc}")
    print(f">> 저장: {out_log}")

if __name__ == "__main__":
    main()
