# make_sample_pool_and_final.py
import pandas as pd
import json
import random

SEED = 42
HIT_POOL_N = 100
NONHIT_POOL_N = 8
FINAL_HIT = 92
FINAL_NONHIT = 8
SRC_CSV = "ai_metric_log_all.csv"

def main():
    df = pd.read_csv(SRC_CSV)
    # 유효 응답만 사용
    df_ok = df[df["status"] == 200].copy()

    # 소스 플래그
    df_ok["source"] = df_ok["hit"].apply(lambda x: "hit" if int(x) == 1 else "nonhit")

    hits = df_ok[df_ok["hit"] == 1]
    nonhits = df_ok[df_ok["hit"] == 0]

    # 풀 구성 (부족하면 가능한 만큼만)
    hit_take = min(HIT_POOL_N, len(hits))
    nonhit_take = min(NONHIT_POOL_N, len(nonhits))

    pool_hit = hits.sample(n=hit_take, random_state=SEED)
    pool_nonhit = nonhits.sample(n=nonhit_take, random_state=SEED)

    pool = pd.concat([pool_hit, pool_nonhit], ignore_index=True)
    pool["source"] = pool["source"].astype(str)

    # 풀 저장
    pool_cols = ["label","status","hit","latency_ms","expected_id","used_payload_json","source"]
    pool[pool_cols].to_csv("sample_pool_120.csv", index=False, encoding="utf-8-sig")

    # 최종 100개 샘플 (비율 고정: hit 80, nonhit 20, 부족 시 가능한 만큼 보정)
    final_hit_n = min(FINAL_HIT, (pool["source"]=="hit").sum())
    final_nonhit_n = min(FINAL_NONHIT, (pool["source"]=="nonhit").sum())

    final_hit = pool[pool["source"]=="hit"].sample(n=final_hit_n, random_state=SEED+1)
    final_nonhit = pool[pool["source"]=="nonhit"].sample(n=final_nonhit_n, random_state=SEED+1)
    final = pd.concat([final_hit, final_nonhit], ignore_index=True)

    # 100개 미만이면, 남은 수를 풀에서 채움(중복 없이)
    remain = 100 - len(final)
    if remain > 0:
        leftover = pool[~pool.index.isin(final.index)].sample(n=min(remain, len(pool)-len(final)), random_state=SEED+2)
        final = pd.concat([final, leftover], ignore_index=True)

    final = final.sample(frac=1.0, random_state=SEED+3).reset_index(drop=True)  # 셔플
    final[pool_cols].to_csv("sample_final_100.csv", index=False, encoding="utf-8-sig")

    print(f"[OK] sample_pool_120.csv: {len(pool)} rows (hit {len(pool_hit)}, nonhit {len(pool_nonhit)})")
    print(f"[OK] sample_final_100.csv: {len(final)} rows (hit {(final['source']=='hit').sum()}, nonhit {(final['source']=='nonhit').sum()})")

if __name__ == "__main__":
    main()
