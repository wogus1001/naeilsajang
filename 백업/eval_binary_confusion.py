# -*- coding: utf-8 -*-
"""
오프라인 이진 평가 + Confusion Matrix + 임계값 탐색
- 입력: offline_eval.jsonl (qid, profile, positives[])
- 모델 점수: /api/match 응답의 _score 사용 (top_k 풀에서)
- 방법:
  1) 각 질의(q) 별로 추천 top_pool(기본 50) 가져오기
  2) 추천 목록에서 positives에 포함되면 y=1, 아니면 y=0 라벨링
  3) _score를 [0,1]로 정규화해 이진 분류 점수로 사용
  4) threshold를 스윕하며 정확도/정밀도/재현율 및 Confusion Matrix 계산
  5) precision>=0.9 and recall>=0.9 and accuracy>=0.9 만족하는 최솟값 threshold를 찾거나,
     불가능하면 가장 가까운(세 지표의 최소값을 최대화) threshold를 리포팅
"""

import json
import math
import os
import sys
from typing import List, Dict, Tuple
import requests
import numpy as np

# ===== 설정 ===== #
API_BASE = "http://127.0.0.1:8000"
EVAL_FILE = "offline_eval.jsonl"
TOP_POOL = 50             # 각 질의 당 가져올 추천 개수 (이 중에서 positives 라벨링)
TIMEOUT = 20              # 요청 타임아웃(초)
TARGET = {"acc": 0.90, "prec": 0.90, "rec": 0.90}  # 목표치

def load_eval(path: str) -> List[Dict]:
    lines = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            lines.append(json.loads(line))
    return lines

def call_match_api(profile: Dict, top_k: int = TOP_POOL) -> List[Dict]:
    url = f"{API_BASE}/api/match"
    payload = {"top_k": top_k}
    payload.update(profile or {})
    headers = {"Content-Type": "application/json; charset=utf-8", "Accept-Charset": "utf-8"}
    r = requests.post(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    return data.get("items", [])

def minmax_normalize(x: np.ndarray) -> np.ndarray:
    if x.size == 0:
        return x
    lo = np.min(x)
    hi = np.max(x)
    if math.isclose(hi, lo):
        return np.ones_like(x) * 0.5
    return (x - lo) / (hi - lo)

def binarize(scores: np.ndarray, thr: float) -> np.ndarray:
    return (scores >= thr).astype(int)

def confusion(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[int, int, int, int]:
    # TN, TP, FN, FP (요청 순서대로 리턴)
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    return tn, tp, fn, fp

def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    tn, tp, fn, fp = confusion(y_true, y_pred)
    acc = (tp + tn) / max(1, (tp + tn + fp + fn))
    prec = tp / max(1, (tp + fp))
    rec = tp / max(1, (tp + fn))
    f1 = 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)
    return {"acc": acc, "prec": prec, "rec": rec, "f1": f1, "tn": tn, "tp": tp, "fn": fn, "fp": fp}

def find_best_threshold(y_true: np.ndarray, scores: np.ndarray, targets: Dict[str, float]) -> Dict:
    # 0~1 사이 1001개 지점 탐색 (0.000, 0.001, ..., 1.000)
    best = None
    goal_hit = None
    for i in range(1001):
        thr = i / 1000.0
        y_pred = binarize(scores, thr)
        m = metrics(y_true, y_pred)
        # 목표치 달성?
        if (m["acc"] >= targets["acc"] and m["prec"] >= targets["prec"] and m["rec"] >= targets["rec"]):
            goal_hit = {"thr": thr, **m}
            break
        # 아직 목표 미달이면, min(acc,prec,rec)가 최대인 지점을 베스트로
        score3 = min(m["acc"], m["prec"], m["rec"])
        if (best is None) or (score3 > best["score3"]):
            best = {"thr": thr, "score3": score3, **m}
    return {"goal": goal_hit, "best": best}

def main():
    if not os.path.exists(EVAL_FILE):
        print(f"[error] 파일 없음: {EVAL_FILE}")
        sys.exit(1)

    eval_items = load_eval(EVAL_FILE)
    if not eval_items:
        print("[error] offline_eval.jsonl 비어있습니다.")
        sys.exit(1)

    y_true_all = []
    score_all = []

    # 질의별로 topN 추천을 받아 labels/score 수집
    for ex in eval_items:
        profile = ex.get("profile", {})
        positives = set(ex.get("positives", []))
        # API 호출
        items = call_match_api(profile, top_k=TOP_POOL)

        # 점수/라벨 수집
        # (주의) items 중 positives에 포함인 것만 y=1, 나머지는 y=0으로 라벨링
        scores = []
        labels = []
        for it in items:
            rid = it.get("row_id")
            sc = float(it.get("_score", 0.0))
            scores.append(sc)
            labels.append(1 if rid in positives else 0)

        if not scores:
            # 추천이 하나도 안 오면 스킵
            continue

        scores = np.array(scores, dtype=float)
        labels = np.array(labels, dtype=int)

        # 질의 내 정규화(0~1)
        scores = minmax_normalize(scores)

        y_true_all.append(labels)
        score_all.append(scores)

    if not y_true_all:
        print("[error] 평가 샘플이 없습니다. API 응답을 확인하세요.")
        sys.exit(1)

    y_true = np.concatenate(y_true_all, axis=0)
    scores = np.concatenate(score_all, axis=0)

    # 임계값 탐색
    result = find_best_threshold(y_true, scores, TARGET)

    print("\n=== 데이터 요약 ===")
    print(f"총 샘플 수: {len(y_true)} (queries={len(y_true_all)}, pool_per_query≈{TOP_POOL})")
    print(f"양성 비율: {np.mean(y_true):.4f}")

    if result["goal"] is not None:
        g = result["goal"]
        print("\n✅ 목표치 달성 임계값(threshold) 발견!")
        print(f"- threshold = {g['thr']:.3f}")
        print(f"- Accuracy  = {g['acc']:.4f}")
        print(f"- Precision = {g['prec']:.4f}")
        print(f"- Recall    = {g['rec']:.4f}")
        print(f"- F1        = {g['f1']:.4f}")
        print(f"- Confusion Matrix: TN={g['tn']}, TP={g['tp']}, FN={g['fn']}, FP={g['fp']}")
    else:
        b = result["best"]
        print("\n⚠️  세 지표(정확도·정밀도·재현율) 0.90 동시 달성 불가. 가장 근접한 지점:")
        print(f"- threshold = {b['thr']:.3f}   (min(acc,prec,rec) 최대)")
        print(f"- Accuracy  = {b['acc']:.4f}")
        print(f"- Precision = {b['prec']:.4f}")
        print(f"- Recall    = {b['rec']:.4f}")
        print(f"- F1        = {b['f1']:.4f}")
        print(f"- Confusion Matrix: TN={b['tn']}, TP={b['tp']}, FN={b['fn']}, FP={b['fp']}")
        print("\n[개선 팁]")
        print("- TOP_POOL을 더 키워 positives가 풀에 잘 포함되도록 하거나,")
        print("- offline_eval.jsonl의 positives 선정 기준을 현재 스코어링 로직에 더 정합적으로 구성,")
        print("- 매칭 스코어(_score) 계산식/가중치를 튜닝(카테고리 일치 가중, 임대료/권리금 패널티 등)하면")
        print("  precision/recall 상향이 가능합니다.")

if __name__ == "__main__":
    main()
