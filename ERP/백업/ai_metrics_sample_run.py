import json, time, statistics, random
import pandas as pd
import requests

# ===== 환경 설정 =====
API_URL = "http://sajang.opentest.kr/api/ai/search/sales"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYzBjZGJkMDUwYjMyZjY3MTU1MjQ0M2Y0MTJiNjNkNGMyMjc2YzM4M2QyZGU1NDJjYmE1YjE4MGFkYjZkZTIxZDc3NDQ0Y2FkY2M5YmE1ZTllNjY3NTFjMzMwMTZlODgiLCJtZW1FbWFpbCI6ImF3bXZlQGtha2FvLmNvbSIsIm1lbVVzZXJpZCI6Ii1zb2NpYWxfMzU4Njg0MTE1MSIsIm1lbVVzZXJuYW1lIjoi6rmA7J6s7ZiEIiwic29jaWFsVHlwZSI6IktBS0FPIiwibWVtTGV2ZWwiOiJOT1JNQUwiLCJleHAiOjE3ODk2MjMyNDAsImlhdCI6MTc1ODA4NzI0MH0.6tcG1KxjnaV-RdycFDLaFgfmrXksNEcrQHTFqepYCRo"
SEED = 20251020

# 입력 파일들 (기존 파이프라인 산출물)
LOG_ALL = "ai_metric_log_all.csv"          # 전체 측정 로그(used_payload_json 포함)
HIT_GT  = "ground_truth_set_hits.csv"      # 히트셋(GT 형식: payload_json, expected_id, search_label)

# 샘플링 개수
SAMPLE_HIT = 100
SAMPLE_NONHIT = 10
FINAL_RUN = 100  # 120개 풀에서 최종 측정 100개

headers = {
    "Authorization": AUTH_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "http://sajang.opentest.kr",
    "Referer": "http://sajang.opentest.kr/ai/search",
}

def to_int_safe(v):
    try: return int(str(v).strip())
    except: return None

def p95(values):
    if not values: return 0.0
    if len(values) == 1: return values[0]
    return statistics.quantiles(values, n=20)[18]

def main():
    random.seed(SEED)

    # 1) 히트셋에서 100개 랜덤 샘플
    hit_gt = pd.read_csv(HIT_GT)
    if len(hit_gt) == 0:
        raise RuntimeError("ground_truth_set_hits.csv 가 비어있습니다. 먼저 전체 측정 → 히트셋 생성까지 완료하세요.")
    hit_sample = hit_gt.sample(min(SAMPLE_HIT, len(hit_gt)), random_state=SEED).copy()
    hit_sample["source"] = "hit"

    # 2) 전체 로그에서 미적중 20개 랜덤 샘플 (로그 기반 payload 사용)
    log_all = pd.read_csv(LOG_ALL)
    if "used_payload_json" not in log_all.columns:
        raise RuntimeError("ai_metric_log_all.csv 에 used_payload_json 컬럼이 없습니다. 최신 파이프라인으로 전체 측정을 다시 실행하세요.")
    nonhit = log_all[log_all["hit"] == 0][["expected_id","label","used_payload_json"]].copy()
    if len(nonhit) == 0:
        raise RuntimeError("전체 로그에 미적중 케이스가 없습니다.")
    nonhit_sample = nonhit.sample(min(SAMPLE_NONHIT, len(nonhit)), random_state=SEED)
    nonhit_sample = nonhit_sample.rename(columns={"label":"search_label", "used_payload_json":"payload_json"})
    nonhit_sample["source"] = "nonhit"

    # 3) 120개 풀 구성 → 섞어서 100개만 최종 실험
    pool_120 = pd.concat([
        hit_sample[["payload_json","expected_id","search_label","source"]],
        nonhit_sample[["payload_json","expected_id","search_label","source"]],
    ], ignore_index=True)

    pool_120 = pool_120.sample(frac=1.0, random_state=SEED).reset_index(drop=True)  # 셔플
    final_100 = pool_120.sample(min(FINAL_RUN, len(pool_120)), random_state=SEED).reset_index(drop=True)

    pool_120.to_csv("sample_pool_120.csv", index=False, encoding="utf-8-sig")
    final_100.to_csv("sample_final_100.csv", index=False, encoding="utf-8-sig")
    

    # 4) 최종 100개 실험 실행
    hits, latencies, rows = 0, [], []
    for i, r in final_100.iterrows():
        try:
            payload = json.loads(r["payload_json"])
        except Exception as e:
            rows.append({"idx": i, "status": "payload_error", "err": str(e), "hit": 0, "source": r.get("source")})
            continue

        expected_id = to_int_safe(r["expected_id"])
        label = r.get("search_label", f"case_{i}")

        t0 = time.perf_counter()
        resp = requests.post(API_URL, headers=headers, data=json.dumps(payload), timeout=20)
        t1 = time.perf_counter()
        lat_ms = (t1 - t0) * 1000
        latencies.append(lat_ms)

        if resp.status_code != 200:
            rows.append({
                "label": label, "status": resp.status_code, "hit": 0, "latency_ms": round(lat_ms,1),
                "expected_id": expected_id, "source": r.get("source"), "top5_ids": [], "top5_names": []
            })
            continue

        data = resp.json()
        top5 = data[:5] if isinstance(data, list) else data.get("results", [])[:5]
        top5_ids, top5_names = [], []
        for it in top5:
            if isinstance(it, dict):
                top5_ids.append(to_int_safe(it.get("saleFranchiseId")))
                top5_names.append(it.get("franchiseName"))

        hit = 1 if (expected_id is not None and expected_id in top5_ids) else 0
        hits += hit

        rows.append({
            "label": label, "status": resp.status_code, "hit": hit, "latency_ms": round(lat_ms,1),
            "expected_id": expected_id, "source": r.get("source"),
            "top5_ids": top5_ids, "top5_names": top5_names
        })

    total = len(rows)
    acc = (hits/total*100) if total else 0.0
    avg_ms = statistics.mean(latencies) if latencies else 0.0
    p95_ms = p95(latencies)

    # 5) 결과 출력 및 저장
    print("\n===== 샘플 100개 실험 결과 =====")
    print(f"- Top-5 Accuracy: {acc:.2f}%")
    print(f"- 응답시간: 평균 {avg_ms:.1f} ms, p95 {p95_ms:.1f} ms")
    print(f"- 총 시도: {total}건, 적중: {hits}건")

    out_log = "ai_metric_log_sample100.csv"
    pd.DataFrame(rows).to_csv(out_log, index=False, encoding="utf-8-sig")
    print(f"로그 저장: {out_log}")

    ## 출처별(히트/논히트) 분해 통계도 추가
    #df_rows = pd.DataFrame(rows)
    #by_src = df_rows.groupby("source")["hit"].mean().mul(100).round(2)
    #print("\n[출처별 정확도(%)]")
    #print(by_src.to_string())

if __name__ == "__main__":
    main()