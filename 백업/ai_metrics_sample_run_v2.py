# ai_metrics_sample_run_v2.py
import time, json, statistics, pandas as pd, requests, sys

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "sample_final_100.csv"
API_URL = "http://sajang.opentest.kr/api/ai/search/sales"

# 🔐 JWT 넣어주세요
JWT = "YOUR_JWT_HERE"

HEADERS = {
    "Authorization": f"Bearer {JWT}",
    "Content-Type": "application/json; charset=utf-8",
}

def p95(vals):
    if not vals: return 0.0
    if len(vals) == 1: return vals[0]
    return statistics.quantiles(vals, n=20)[18]

def main():
    df = pd.read_csv(CSV_PATH)
    rows, lat, hits = [], [], 0

    for i, r in df.iterrows():
        label = r.get("label","")
        expected_id = r.get("expected_id", None)
        payload_json = r.get("used_payload_json","{}")
        source = r.get("source","")

        try:
            payload = json.loads(payload_json)
        except Exception:
            payload = {}

        t0 = time.perf_counter()
        resp = requests.post(API_URL, headers=HEADERS, data=json.dumps(payload), timeout=30)
        t1 = time.perf_counter()
        ms = round((t1 - t0)*1000, 1)
        lat.append(ms)

        status = resp.status_code
        top5_ids, top5_names = [], []

        if status == 200:
            data = resp.json()
            top5 = data[:5] if isinstance(data, list) else data.get("results", [])[:5]
            for it in top5:
                if isinstance(it, dict):
                    top5_ids.append(it.get("saleFranchiseId"))
                    top5_names.append(it.get("franchiseName"))
        else:
            # 비정상 응답
            pass

        hit = 1 if expected_id in top5_ids else 0
        hits += hit

        rows.append({
            "label": label,
            "status": status,
            "hit": hit,
            "latency_ms": ms,
            "expected_id": expected_id,
            "source": source,
            "top5_ids": top5_ids,
            "top5_names": top5_names,
            "used_payload_json": json.dumps(payload, ensure_ascii=False)
        })

    total = len(rows)
    acc = (hits/total*100) if total else 0.0
    avg = statistics.mean(lat) if lat else 0.0
    p95v = p95(lat)

    # 저장
    out_log = "ai_metric_log_sample100.csv"
    pd.DataFrame(rows).to_csv(out_log, index=False, encoding="utf-8-sig")

    print("===== 샘플 100개 실험 결과 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg:.1f} ms, p95 {p95v:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")
    print(f"로그 저장: {out_log}")

    # 소스별 정확도
    #by_src = pd.DataFrame(rows).groupby("source")["hit"].mean().mul(100).round(2)
    #print("\n[출처별 정확도(%)]")
    #print(by_src.to_string())

if __name__ == "__main__":
    main()
