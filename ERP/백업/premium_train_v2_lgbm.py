# premium_train_v2_lgbm.py
# -----------------------------------------
# 권리금 예측 AI 모델 학습 및 인퍼런스 속도 측정 (최종 보고서용 버전)
# 콘솔, CSV, JSON의 결과값이 완전히 일치함
# 로그는 1회 실행당 1줄만 생성됨
# -----------------------------------------

import os, time, json, joblib, numpy as np, pandas as pd, datetime
from typing import Optional, List
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import lightgbm as lgb

# ============================================
# 기본 설정
# ============================================
DATA_PATH  = r"C:\Users\awmve\OneDrive\바탕 화면\my_project\양도양수매물리스트 다운로드 (2).xlsx"
TARGET_NAME = "권리금"
TEST_SIZE = 0.2
RANDOM_STATE = 42
EPOCHS = 10
TREES_PER_EPOCH = 100
TARGET_MAE = 30_000_000
MODEL_OUT = "premium_model_v2.joblib"
CSV_LOG = "train_speed_log.csv"
JSON_LOG = "run_summary.json"

# ============================================
# 데이터 로드 & 엔지니어링
# ============================================
def load_table(path):
    if path.lower().endswith(".csv"):
        return pd.read_csv(path)
    return pd.read_excel(path, engine="openpyxl")

def engineer(df: pd.DataFrame):
    X = df.copy()
    if "전용면적" in X.columns and "월세" in X.columns:
        X["월세_per_m2"] = X["월세"] / X["전용면적"].replace(0, np.nan)
    if "월평균 매출액" in X.columns and "월세" in X.columns:
        X["rent_sales_ratio"] = X["월세"] / X["월평균 매출액"].replace(0, np.nan)
    for col in ["전용면적","월세","보증금","관리비","월평균 매출액",
                "월세_per_m2","rent_sales_ratio"]:
        if col in X.columns:
            X[f"log1p_{col}"] = np.log1p(pd.to_numeric(X[col], errors="coerce"))
    if "매매 가능 일정" in X.columns:
        order_map = {"즉시":3,"즉시가능":3,"1~2개월":2,"3~5개월":1,"6~8개월":0,"협의 가능":1,"협의가능":1}
        X["매매 가능 일정(ord)"] = X["매매 가능 일정"].map(order_map)
    return X

# ============================================
# 속도 측정 클래스
# ============================================
class TrainSpeedMeter:
    def __init__(self, train_size:int, target_mae:float):
        self.train_size = train_size
        self.target_mae = target_mae
        self.start_time = None
        self.end_time = None
        self.epoch_times = []
        self.epochs = 0
        self.tta_sec = None
        self.result = {}

    def start(self):
        self.start_time = datetime.datetime.now().isoformat()
        self.t0 = time.perf_counter()

    def tick_epoch_start(self):
        self._ep_t0 = time.perf_counter()

    def tick_epoch_end(self, val_mae=None):
        elapsed = time.perf_counter() - self._ep_t0
        self.epoch_times.append(elapsed)
        self.epochs += 1
        if val_mae and val_mae <= self.target_mae and not self.tta_sec:
            self.tta_sec = time.perf_counter() - self.t0

    def finish(self):
        self.end_time = datetime.datetime.now().isoformat()
        total_sec = time.perf_counter() - self.t0
        sec_per_epoch = np.mean(self.epoch_times)
        samples_per_sec = (self.train_size * self.epochs) / total_sec
        sec_per_1000 = (total_sec * 1000) / (self.train_size * self.epochs)
        self.result = {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_sec": round(total_sec, 8),
            "sec_per_epoch_avg": round(sec_per_epoch, 8),
            "samples_per_sec": round(samples_per_sec, 8),
            "sec_per_1000_samples": round(sec_per_1000, 8),
            "epochs": self.epochs,
            "tta_sec": round(self.tta_sec, 8) if self.tta_sec else None,
            "target_mae": self.target_mae,
            "train_size": self.train_size
        }
        return self.result

# ============================================
# 메인 함수
# ============================================
def main():
    df = load_table(DATA_PATH)
    print(f"[INFO] Load table: {DATA_PATH} (rows={len(df)})")

    y = pd.to_numeric(df[TARGET_NAME], errors="coerce")
    X = engineer(df.drop(columns=[TARGET_NAME]))

    # 범주형 처리
    cat_cols = [c for c in X.columns if X[c].dtype == 'object']
    for c in cat_cols:
        X[c] = X[c].astype("category")

    X_train, X_val, y_train_raw, y_val_true = train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    y_train = np.log1p(y_train_raw.values.astype(float))

    dtrain = lgb.Dataset(
    X_train,
    label=y_train,
    categorical_feature=cat_cols,
    free_raw_data=False)
    dval = lgb.Dataset( 
    X_val,
    label=np.log1p(y_val_true.values.astype(float)),
    categorical_feature=cat_cols,
    free_raw_data=False)


    params = {
        "objective": "regression",
        "metric": "l1",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.9,
        "bagging_freq": 1,
        "min_data_in_leaf": 20,
        "verbosity": -1,
        "seed": RANDOM_STATE
    }

    meter = TrainSpeedMeter(train_size=len(X_train), target_mae=TARGET_MAE)
    meter.start()
    print(f"[SPEED] start_time = {meter.start_time}")

    booster = None
    for ep in range(EPOCHS):
        meter.tick_epoch_start()
        booster = lgb.train(params, dtrain, num_boost_round=TREES_PER_EPOCH,
                            valid_sets=[dval], init_model=booster,
                            keep_training_booster=True)
        pred = np.expm1(booster.predict(X_val))
        val_mae = float(mean_absolute_error(y_val_true, pred))
        meter.tick_epoch_end(val_mae)
        print(f"  - epoch {ep+1:02d}: iters_total={booster.current_iteration()}, val_MAE={val_mae:,.1f}")

    result = meter.finish()
    print(f"[SPEED] end_time = {result['end_time']}")
    print("[SPEED]", json.dumps(result, ensure_ascii=False, indent=2))

    # 모델 저장
    joblib.dump((engineer, booster, cat_cols), MODEL_OUT)
    print(f"[INFO] Saved model to: {MODEL_OUT}")

    # 로그 파일 (CSV + JSON)
    pd.DataFrame([result]).to_csv(CSV_LOG, index=False, encoding="utf-8-sig")  # ✅ 덮어쓰기 (1회 측정용)
    with open(JSON_LOG, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Logs saved: {CSV_LOG}, {JSON_LOG}")

if __name__ == "__main__":
    main()
