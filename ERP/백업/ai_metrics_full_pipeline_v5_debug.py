import sys, os, json, time, statistics, requests, pandas as pd

API_URL = "http://sajang.opentest.kr/api/ai/search/sales"
AUTH_TOKEN = os.environ.get("AI_SAJANG_JWT","eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo").strip()

HEADERS = {
    "Authorization": AUTH_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "http://sajang.opentest.kr",
    "Referer": "http://sajang.opentest.kr/ai/search",
}

def p95(values):
    if not values: return 0.0
    if len(values)==1: return values[0]
    return statistics.quantiles(values, n=20)[18]

def run_measure(gt_csv, out_log):
    df = pd.read_csv(gt_csv)
    rows, lats, hits = [], [], 0
    status_counts = {}

    for _, r in df.iterrows():
        payload = json.loads(r["payload_json"])
        expected_id = int(r["expected_id"])
        label = str(r.get("search_label",""))

        t0 = time.perf_counter()
        resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(payload), timeout=20)
        t1 = time.perf_counter()
        lat = (t1 - t0)*1000
        lats.append(lat)
        st = resp.status_code
        status_counts[str(st)] = status_counts.get(str(st),0)+1

        if st != 200:
            rows.append({
                "label": label,
                "status": st,
                "error_body": resp.text[:2000],  # 백엔드 에러 메시지 캡쳐
                "hit": 0,
                "latency_ms": round(lat,1),
                "expected_id": expected_id,
                "top5_ids": [],
                "top5_names": [],
                "used_payload_json": json.dumps(payload, ensure_ascii=False),
            })
            continue

        data = resp.json()
        top5 = data[:5] if isinstance(data, list) else data.get("results",[])[:5]
        top5_ids = [int(it.get("saleFranchiseId")) for it in top5 if isinstance(it, dict) and it.get("saleFranchiseId") is not None]
        top5_names = [str(it.get("franchiseName","")) for it in top5 if isinstance(it, dict)]
        hit = 1 if expected_id in top5_ids else 0
        hits += hit

        rows.append({
            "label": label, "status": st, "hit": hit, "latency_ms": round(lat,1),
            "expected_id": expected_id, "top5_ids": top5_ids, "top5_names": top5_names,
            "used_payload_json": json.dumps(payload, ensure_ascii=False),
        })

    total = len(rows)
    acc = (hits/total*100) if total else 0.0
    avg = statistics.mean(lats) if lats else 0.0
    p95v = p95(lats)
    log = pd.DataFrame(rows)
    log.to_csv(out_log, index=False, encoding="utf-8-sig")
    return log, acc, avg, p95v, hits, total, status_counts

def main():
    if len(sys.argv)<2:
        print("USAGE: python ai_metrics_full_pipeline_v5_debug.py <ground_truth_csv>")
        sys.exit(1)
    if not AUTH_TOKEN:
        print('ERROR: setx AI_SAJANG_JWT "<JWT>" 후 새 PowerShell 창에서 실행해주세요.')
        sys.exit(1)

    gt = sys.argv[1]
    out_log = "ai_metric_log_all.csv"
    print(f">> USING GT FILE: {gt}")
    log, acc, avg, p95v, hits, total, st = run_measure(gt, out_log)
    print("\n===== [all] 결과 요약 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg:.1f} ms, p95 {p95v:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")
    print(f"- status breakdown: {st}")
    print(f">> 저장: {out_log}")

if __name__ == "__main__":
    main()
