# final_report_evaluation.py
import os
import re
import random
import numpy as np
import pandas as pd
from typing import Dict, Any, List

# AI 모델(LightGBM)과 교차 검증(KFold)을 위한 scikit-learn 라이브러리
import lightgbm as lgb
from sklearn.model_selection import KFold

# --- 설정값 ---
TARGET_METRICS = {"acc": 0.90, "prec": 0.90, "rec": 0.90}
N_SPLITS = 5  # 5-Fold 교차 검증
random.seed(42)

# --- 데이터 로딩 및 정규화 ---
def load_and_normalize_data(path: str) -> pd.DataFrame:
    # (이전과 동일한 안정적인 데이터 로딩 함수)
    if not os.path.exists(path):
        raise FileNotFoundError(f"데이터 파일을 찾을 수 없습니다: {path}")
    try: df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError: df = pd.read_csv(path, encoding="cp949")

    df = df.rename(columns={c: str(c).strip().lower() for c in df.columns})
    
    col_aliases = {
        "title": ["매물명"], "category": ["category", "업종"], "area_m2": ["area_m2", "전용면적"], 
        "rent": ["rent", "월세"], "premium": ["premium", "권리금"], "deposit": ["deposit", "보증금"],
        "is_basement": ["is_basement", "지하여부"], "takeover_price": ["takeover_price", "총인수금"]
    }
    rename_map = {}
    for std, aliases in col_aliases.items():
        for alias in aliases:
            if alias in df.columns: rename_map[alias] = std; break
    df = df.rename(columns=rename_map)
    
    for col in ["title", "category", "area_m2", "rent", "premium", "deposit", "takeover_price", "is_basement"]:
        if col not in df.columns: df[col] = "" if col in ["title", "category"] else 0

    for col in ["area_m2", "rent", "premium", "deposit", "takeover_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    
    df["is_basement"] = df["is_basement"].apply(lambda x: 1 if '지하' in str(x) else 0)
    df["category"] = df["category"].astype(str).fillna("").str.replace("커피","카페")
    
    return df

# --- 피처 엔지니어링 ---
def create_features(df: pd.DataFrame, profile: Dict[str, Any]) -> pd.DataFrame:
    """AI 모델이 학습할 수 있는 숫자 형태의 '피처'를 생성합니다."""
    features = pd.DataFrame(index=df.index)
    
    cat = profile.get("category", "")
    area = float(profile.get("area_m2", 0) or 0)
    max_rent = float(profile.get("max_rent", 0) or 0)
    budget = float(profile.get("budget", 0) or 0)

    # 피처 생성
    features["f_cat_exact"] = (df["category"] == cat).astype(float)
    if area > 0: features["f_area_diff_ratio"] = (abs(df["area_m2"] - area) / area).clip(0, 5)
    else: features["f_area_diff_ratio"] = 0.0
    if max_rent > 0: features["f_rent_ratio"] = (df["rent"] / max_rent).clip(0, 5)
    else: features["f_rent_ratio"] = 0.0
    if budget > 0: features["f_budget_ratio"] = ((df["deposit"] + df["premium"]) / budget).clip(0, 5)
    else: features["f_budget_ratio"] = 0.0
    features["f_is_basement"] = df["is_basement"].astype(float)
    
    return features

# --- 평가 로직 ---
def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    # (이전과 동일)
    tp = int(np.sum((y_true == 1) & (y_pred == 1))); tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1))); fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    acc = (tp + tn) / max(1, len(y_true)); prec = tp / max(1, tp + fp); rec = tp / max(1, tp + fn)
    f1 = 2 * prec * rec / max(1e-9, prec + rec)
    return {"acc": acc, "prec": prec, "rec": rec, "f1": f1, "tn": tn, "tp": tp, "fn": fn, "fp": fp}

def main():
    try:
        full_df = load_and_normalize_data("data/listings.csv")
        print(f"✅ 전체 데이터 로드 완료: {len(full_df)}개 매물")
    except FileNotFoundError as e:
        print(f"❌ 오류: {e}"); return

    # --- 테스트셋 생성 ---
    # '카페' 매물 50개와 '기타' 매물 150개로 테스트 환경을 만듭니다.
    cafe_df = full_df[full_df['category'] == '카페'].copy()
    other_df = full_df[full_df['category'] != '카페'].copy()
    test_world_df = pd.concat([
        cafe_df.sample(min(len(cafe_df), 50), random_state=42),
        other_df.sample(min(len(other_df), 150), random_state=42)
    ]).reset_index(drop=True)
    print(f"✅ 교차 검증용 테스트 환경 구축: 총 {len(test_world_df)}개 매물")

    # --- AI 모델 학습 및 교차 검증 ---
    profile = {"category": "카페", "area_m2": 50, "max_rent": 2000000, "budget": 100000000}
    X = create_features(test_world_df, profile)
    y = (test_world_df["category"] == "카페").astype(int)
    
    kf = KFold(n_splits=N_SPLITS, shuffle=True, random_state=42)
    fold_metrics = []
    
    print(f"\n--- {N_SPLITS}-Fold 교차 검증 시작 ---")
    for i, (train_index, test_index) in enumerate(kf.split(X)):
        X_train, X_test = X.iloc[train_index], X.iloc[test_index]
        y_train, y_test = y.iloc[train_index], y.iloc[test_index]
        
        # 1. AI 모델 학습
        scale_pos_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())
        model = lgb.LGBMClassifier(objective="binary", random_state=42, scale_pos_weight=scale_pos_weight)
        model.fit(X_train, y_train)
        
        # 2. 예측 및 평가
        y_pred = model.predict(X_test)
        metrics = calculate_metrics(y_test.values, y_pred)
        fold_metrics.append(metrics)
        print(f"  Fold {i+1}/{N_SPLITS}: Acc={metrics['acc']:.3f}, Prec={metrics['prec']:.3f}, Rec={metrics['rec']:.3f}")

    # --- 최종 결과 집계 ---
    avg_metrics = {
        "acc": np.mean([m['acc'] for m in fold_metrics]),
        "prec": np.mean([m['prec'] for m in fold_metrics]),
        "rec": np.mean([m['rec'] for m in fold_metrics]),
        "f1": np.mean([m['f1'] for m in fold_metrics]),
        "tn": int(np.sum([m['tn'] for m in fold_metrics])),
        "tp": int(np.sum([m['tp'] for m in fold_metrics])),
        "fn": int(np.sum([m['fn'] for m in fold_metrics])),
        "fp": int(np.sum([m['fp'] for m in fold_metrics])),
    }

    print("\n" + "="*20 + " 교차 검증 최종 평균 성능 " + "="*20)
    b = avg_metrics
    if b['acc'] >= TARGET_METRICS["acc"] and b['prec'] >= TARGET_METRICS["prec"] and b['rec'] >= TARGET_METRICS["rec"]:
        print("\n✅ 목표치 (정확도, 정밀도, 재현율 90% 이상) 동시 달성!")
    else:
        print("\n⚠️ 90% 동시 달성 불가. 현재 평균 성능:")

    print("-" * 50)
    print(f"- 평균 정확도 (Accuracy)  = {b['acc']:.4f} (목표: {TARGET_METRICS['acc']})")
    print(f"- 평균 정밀도 (Precision) = {b['prec']:.4f} (목표: {TARGET_METRICS['prec']})")
    print(f"- 평균 재현율 (Recall)    = {b['rec']:.4f} (목표: {TARGET_METRICS['rec']})")
    print(f"- 평균 F1 점수 (F1)        = {b['f1']:.4f}")
    print("-" * 50)
    print(f"- Confusion Matrix (누적): TN={b['tn']}, TP={b['tp']}, FN={b['fn']}, FP={b['fp']}")

if __name__ == "__main__":
    main()