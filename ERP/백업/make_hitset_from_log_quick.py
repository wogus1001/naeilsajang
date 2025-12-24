# make_hitset_from_log_quick.py
import pandas as pd
log = pd.read_csv("ai_metric_log_all.csv")
hit = log[log["hit"] == 1][["used_payload_json","expected_id","label"]].copy()
hit.rename(columns={
    "used_payload_json":"payload_json",
    "label":"search_label"
}, inplace=True)
hit.to_csv("ground_truth_set_hits.csv", index=False, encoding="utf-8-sig")
print("✅ ground_truth_set_hits.csv 생성:", len(hit))