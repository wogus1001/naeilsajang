# final_evaluation.py
import os
import re
import json
import random
import numpy as np
import pandas as pd
from typing import Dict, Any, List

# --- 설정값 ---
# 이 값을 조정하여 성능을 튜닝할 수 있습니다.
WEIGHTS = {
    "category": 3.0,  # 카테고리 일치 가중치
    "area": 1.5,      # 면적 근접도 가중치
    "rent": 1.2,      # 월세 적합도 가중치
    "budget": 1.0,    # 총예산 적합도 가중치
    "basement": 0.8,  # 지상층 선호 가중치
}
TARGET_METRICS = {"acc": 0.90, "prec": 0.90, "rec": 0.90}
random.seed(42)

# --- 데이터 로딩 및 정규화 ---
def load_and_normalize_data(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"데이터 파일을 찾을 수 없습니다: {path}")
    
    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="cp949")

    df = df.rename(columns={c: str(c).strip().lower() for c in df.columns})
    
    col_aliases = {
        "title": ["매물명", "상호", "name"], "category": ["category", "업종"],
        "area_m2": ["area_m2", "면적(㎡)", "전용면적"], "rent": ["rent", "월세"],
        "premium": ["premium", "권리금"], "deposit": ["deposit", "보증금"],
        "takeover_price": ["takeover_price", "총인수금", "인수금"],
        "is_basement": ["is_basement", "지하여부"],
    }
    rename_map = {}
    for std, aliases in col_aliases.items():
        for alias in aliases:
            if alias in df.columns:
                rename_map[alias] = std
                break
    df = df.rename(columns=rename_map)

    for col in ["title", "category", "area_m2", "rent", "premium", "deposit", "takeover_price", "is_basement"]:
        if col not in df.columns:
            df[col] = "" if col in ["title", "category"] else 0

    for col in ["area_m2", "rent", "premium", "deposit", "takeover_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["is_basement"] = df["is_basement"].apply(lambda x: 1 if '지하' in str(x) else 0)
    df["category"] = df["category"].astype(str).fillna("")
    
    if "row_id" not in df.columns:
        df["row_id"] = np.arange(1, len(df) + 1)
        
    return df

# --- 매칭 엔진 클래스 ---
class Matcher:
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def match(self, profile: Dict[str, Any], top_k: int = 100) -> pd.DataFrame:
        df = self.df.copy()
        
        # --- 피처 엔지니어링: 각 조건을 0~1 점수로 변환 ---
        cat = profile.get("category", "")
        area = float(profile.get("area_m2", 0) or 0)
        max_rent = float(profile.get("max_rent", 0) or 0)
        budget = float(profile.get("budget", 0) or 0)

        # 1. 카테고리 점수
        f_cat = (df["category"] == cat).astype(float)

        # 2. 면적 점수 (목표치와의 차이가 적을수록 1)
        f_area = np.exp(-abs(df["area_m2"] - area) / (area + 1e-6)) if area > 0 else pd.Series(0.5, index=df.index)

        # 3. 임대료 점수 (상한보다 낮을수록 1)
        f_rent = np.exp(-df["rent"].clip(lower=0) / (max_rent + 1e-6)) if max_rent > 0 else pd.Series(0.5, index=df.index)
            
        # 4. 예산 점수 (총인수금이 예산보다 낮을수록 1)
        if budget > 0:
            total_price = df['deposit'] + df['premium']
            f_budget = np.exp(-total_price.clip(lower=0) / (budget + 1e-6))
        else:
            f_budget = pd.Series(0.5, index=df.index)

        # 5. 지하 페널티
        f_basement = (1 - df["is_basement"]) if profile.get("prefer_ground") else pd.Series(1.0, index=df.index)

        # --- 가중합으로 최종 점수 계산 ---
        df["_score"] = (
            WEIGHTS["category"] * f_cat + WEIGHTS["area"] * f_area +
            WEIGHTS["rent"] * f_rent + WEIGHTS["budget"] * f_budget +
            WEIGHTS["basement"] * f_basement
        )
        
        return df.sort_values("_score", ascending=False).head(top_k)

# --- 평가 로직 ---
def generate_test_set(df: pd.DataFrame, num_queries: int = 100) -> List[Dict[str, Any]]:
    test_set = []
    top_categories = df['category'].value_counts().head(10).index.tolist()
    
    for _ in range(num_queries):
        cat = random.choice(top_categories)
        sub_df = df[df['category'] == cat].copy()
        if sub_df.empty: continue
        
        area = sub_df['area_m2'].quantile(0.5) * random.uniform(0.8, 1.2)
        rent = sub_df['rent'].quantile(0.5) * random.uniform(0.8, 1.2)
        budget = (sub_df['deposit'] + sub_df['premium']).quantile(0.5) * random.uniform(0.8, 1.2)

        profile = {
            "category": cat, "area_m2": area, "max_rent": rent,
            "budget": budget, "prefer_ground": random.choice([True, False]),
        }
        
        sub_df['dist'] = abs(sub_df['area_m2'] - area) + abs(sub_df['rent'] - rent) * 100
        positives = sub_df.sort_values('dist').head(3)['row_id'].tolist()
        test_set.append({"profile": profile, "positives": positives})
    return test_set

def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    
    acc = (tp + tn) / max(1, len(y_true))
    prec = tp / max(1, tp + fp)
    rec = tp / max(1, tp + fn)
    f1 = 2 * prec * rec / max(1e-9, prec + rec)
    
    return {"acc": acc, "prec": prec, "rec": rec, "f1": f1, "tn": tn, "tp": tp, "fn": fn, "fp": fp}

def find_best_threshold(y_true: np.ndarray, scores: np.ndarray) -> Dict:
    best_result = {"thr": 0.5, **calculate_metrics(y_true, (scores >= 0.5).astype(int))}
    best_score = -1.0
    
    for thr in np.arange(0.0, 1.0, 0.01):
        y_pred = (scores >= thr).astype(int)
        metrics = calculate_metrics(y_true, y_pred)
        
        # 목표: 세 지표의 '최소값'을 가장 크게 만드는 지점 찾기
        current_score = min(metrics['acc'], metrics['prec'], metrics['rec'])
        
        if current_score > best_score:
            best_score = current_score
            best_result = {"thr": thr, **metrics}
    return best_result

def main():
    try:
        df = load_and_normalize_data("data/listings.csv")
        print(f"✅ 데이터 로드 및 정규화 완료: {len(df)}개 매물")
    except FileNotFoundError as e:
        print(f"❌ 오류: {e}")
        return

    matcher = Matcher(df)
    test_set = generate_test_set(df, num_queries=100)
    
    all_labels, all_scores = [], []
    for item in test_set:
        profile, positives = item['profile'], set(item['positives'])
        results_df = matcher.match(profile, top_k=100)
        
        for _, row in results_df.iterrows():
            all_labels.append(1 if row['row_id'] in positives else 0)
            all_scores.append(row['_score'])

    if not all_scores:
        print("\n[error] 매칭 결과가 비어있어 평가할 수 없습니다.")
        return

    y_true, scores = np.array(all_labels), np.array(all_scores)
    scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-9)
    best_result = find_best_threshold(y_true, scores)

    print("\n" + "="*20 + " 최종 성능 평가 결과 " + "="*20)
    if best_result:
        b = best_result
        if b['acc'] >= TARGET_METRICS["acc"] and b['prec'] >= TARGET_METRICS["prec"] and b['rec'] >= TARGET_METRICS["rec"]:
            print("\n✅ 목표치 (정확도, 정밀도, 재현율 90%) 동시 달성!")
        else:
            print("\n⚠️ 90% 동시 달성 불가. 가장 근접한 최적 지점:")

        print(f"- 최적 임계값 (Threshold) = {b['thr']:.3f}")
        print("-" * 50)
        print(f"- 정확도 (Accuracy)  = {b['acc']:.4f} (목표: {TARGET_METRICS['acc']})")
        print(f"- 정밀도 (Precision) = {b['prec']:.4f} (목표: {TARGET_METRICS['prec']})")
        print(f"- 재현율 (Recall)    = {b['rec']:.4f} (목표: {TARGET_METRICS['rec']})")
        print(f"- F1 점수 (F1)        = {b['f1']:.4f}")
        print("-" * 50)
        print(f"- Confusion Matrix: TN={b['tn']}, TP={b['tp']}, FN={b['fn']}, FP={b['fp']}")
    else:
        print("[error] 평가 결과를 산출할 수 없습니다.")

if __name__ == "__main__":
    main()