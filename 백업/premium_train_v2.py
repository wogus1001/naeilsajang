# premium_train_v2.py
# - 엑셀/CSV 데이터에서 권리금 예측 모델을 학습하고 속도 지표를 기록
# - predict_premium_v2.py와 호환되는 저장 형식(튜플)로 저장
# - 학습속도: sec/epoch, samples/sec, sec/1000, TTA 기록

import os
import time
import json
import joblib
import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Tuple

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.impute import SimpleImputer

# =========================
# [A] 사용자 설정
# =========================
DATA_PATH  = r"C:\Users\awmve\OneDrive\바탕 화면\my_project\양도양수매물리스트 다운로드 (2).xlsx"
SHEET_NAME = 0   # 시트가 여러 개면 이름/인덱스로 지정 (예: "Sheet1")

# 타깃 열 이름(고정) — 엑셀에 "권리금"으로 존재한다고 확인
TARGET_NAME = "권리금"
TARGET_CANDIDATES = [
    "권리금", "권리금(만원)", "권리금_만원",
    "premium", "총권리금", "예상권리금", "transfer_fee", "target"
]

TEST_SIZE = 0.2
RANDOM_STATE = 42

# 학습 루프(에폭) 설정
EPOCHS = 10
TREES_PER_EPOCH = 50

# TTA 판단 기준(검증 MAE가 이 값 이하가 되는 최초 시점)
TARGET_MAE = 2.0

# 산출물
MODEL_OUT = "premium_model_v2.joblib"
SPEED_CSV = "train_speed_log.csv"
RUN_SUMMARY_JSON = "run_summary.json"


# =========================
# [B] 로더
# =========================
def load_table(path: str, sheet=0) -> pd.DataFrame:
    p = str(path).lower()
    if p.endswith(".csv"):
        return pd.read_csv(path)
    if p.endswith(".xlsx") or p.endswith(".xls"):
        # openpyxl 필요: pip install openpyxl
        return pd.read_excel(path, sheet_name=sheet, engine="openpyxl")
    raise ValueError("지원하지 않는 형식입니다. csv/xlsx만 지원")


# =========================
# [C] feature engineer (predict 스크립트와 동일 로직)
# =========================
def engineer(df_in: pd.DataFrame) -> pd.DataFrame:
    X = df_in.copy()
    # 면적/비율 파생
    if "전용면적" in X.columns and "월세" in X.columns:
        X["월세_per_m2"] = X["월세"] / X["전용면적"].replace(0, np.nan)
    if "월평균 매출액" in X.columns and "월세" in X.columns:
        X["rent_sales_ratio"] = X["월세"] / X["월평균 매출액"].replace(0, np.nan)
    # 로그 파생
    for col in ["전용면적","월세","보증금","관리비","월평균 매출액",
                "월세_per_m2","rent_sales_ratio"]:
        if col in X.columns:
            X[f"log1p_{col}"] = np.log1p(pd.to_numeric(X[col], errors="coerce"))
    # 순서형 매핑
    if "매매 가능 일정" in X.columns:
        order_map = {"즉시": 3, "즉시가능": 3, "1~2개월": 2, "3~5개월": 1, "6~8개월": 0, "협의 가능": 1, "협의가능": 1}
        X["매매 가능 일정(ord)"] = X["매매 가능 일정"].map(order_map)
    return X


# =========================
# [D] 학습속도 측정기(내장)
# =========================
class TrainSpeedMeter:
    """
    - start()/tick_epoch_start()/tick_epoch_end()/finish() 호출로
      sec/epoch, samples/sec, sec/1000, TTA 기록
    - write_csv()로 요약 결과 CSV 저장
    """
    def __init__(self, train_size: int, target_mae: Optional[float] = None, csv_path: str = SPEED_CSV):
        self.train_size = int(train_size)
        self.target_mae = target_mae
        self.csv_path = csv_path
        self.t0 = None
        self.epochs = 0
        self.epoch_times: List[float] = []
        self.val_mae_log: List[float] = []
        self.tta_sec: Optional[float] = None
        self._last_epoch_start = None
        self._result: Dict[str, float] = {}

    def start(self):
        self.t0 = time.perf_counter()

    def tick_epoch_start(self):
        self._last_epoch_start = time.perf_counter()

    def tick_epoch_end(self, val_mae: Optional[float] = None):
        assert self._last_epoch_start is not None, "tick_epoch_start()를 먼저 호출하세요."
        e_sec = time.perf_counter() - self._last_epoch_start
        self.epoch_times.append(e_sec)
        self.epochs += 1
        if val_mae is not None:
            self.val_mae_log.append(float(val_mae))
            if self.target_mae is not None and self.tta_sec is None and val_mae <= self.target_mae:
                self.tta_sec = time.perf_counter() - self.t0

    def finish(self) -> Dict[str, float]:
        total_sec = time.perf_counter() - self.t0
        sec_per_epoch_avg = (sum(self.epoch_times) / len(self.epoch_times)) if self.epoch_times else float('nan')
        samples_per_sec = (self.train_size * max(self.epochs, 1)) / total_sec
        sec_per_1000 = (total_sec * 1000.0) / (self.train_size * max(self.epochs, 1))
        self._result = {
            "total_sec": total_sec,
            "sec_per_epoch_avg": sec_per_epoch_avg,
            "samples_per_sec": samples_per_sec,
            "sec_per_1000_samples": sec_per_1000,
            "epochs": self.epochs,
            "tta_sec": (self.tta_sec if self.tta_sec is not None else float('nan')),
            "target_mae": (self.target_mae if self.target_mae is not None else float('nan')),
            "train_size": self.train_size,
        }
        return self._result

    def write_csv(self):
        write_header = not os.path.exists(self.csv_path)
        with open(self.csv_path, "a", newline="", encoding="utf-8-sig") as f:
            cols = ["total_sec", "sec_per_epoch_avg", "samples_per_sec", "sec_per_1000_samples", "epochs", "tta_sec", "target_mae", "train_size"]
            if write_header:
                f.write(",".join(cols) + "\n")
            r = self._result
            f.write(",".join(str(r[c]) for c in cols) + "\n")


# =========================
# [E] 유틸
# =========================
def split_num_cat(df: pd.DataFrame, exclude: List[str]) -> Tuple[List[str], List[str]]:
    num_cols, cat_cols = [], []
    for c in df.columns:
        if c in exclude:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            num_cols.append(c)
        else:
            cat_cols.append(c)
    return num_cols, cat_cols


# =========================
# [F] 메인 학습 루틴
# =========================
def main():
    # 1) 데이터 로드
    df = load_table(DATA_PATH, SHEET_NAME)
    print(f"[INFO] Load table: {DATA_PATH}  (rows={len(df)})")

    # 2) 타깃 확정: 우선 '권리금' 고정, 없으면 후보 자동 탐색
    target = TARGET_NAME if TARGET_NAME in df.columns else None
    if target is None:
        for c in TARGET_CANDIDATES:
            if c in df.columns:
                target = c
                break
    if target is None:
        raise ValueError(f"타깃 열을 찾을 수 없습니다. TARGET_NAME='{TARGET_NAME}' 또는 후보 {TARGET_CANDIDATES} 중 하나가 필요합니다.\n실제 컬럼: {list(df.columns)}")
    print(f"[INFO] Target column: {target}")

    # 3) 입력/타깃 분리
    y_raw = pd.to_numeric(df[target], errors="coerce")
    X_raw = df.drop(columns=[target])

    # 4) 숫자/문자 구분(원본 입력 컬럼 기준)
    num_cols, cat_cols = split_num_cat(X_raw, exclude=[])
    print(f"[INFO] Raw feature counts -> num: {len(num_cols)}, cat: {len(cat_cols)}")

    # 5) 안전 캐스팅(숫자열) & 카테고리 캐스팅
    for c in num_cols:
        X_raw[c] = pd.to_numeric(X_raw[c], errors="coerce")
    for c in cat_cols:
        X_raw[c] = X_raw[c].astype("object")

    # 5-1) 문자열 'nan','NULL','' 등을 실제 NaN으로 치환 (카테고리 전반에 적용)
    MISSING_TOKENS = {"nan", "None", "NULL", "null", "NaN", "", " "}
    for c in cat_cols:
        if c in X_raw.columns:
            X_raw[c] = X_raw[c].astype(str).str.strip()
            X_raw.loc[X_raw[c].isin(MISSING_TOKENS), c] = np.nan
            X_raw[c] = X_raw[c].astype("object")

    # 6) 주소 → 시도/시군구 보완(있으면)
    if ("시도" not in X_raw.columns or "시군구" not in X_raw.columns) and ("주소" in X_raw.columns):
        a = X_raw["주소"].astype(str).str.split()
        if "시도" not in X_raw.columns:
            X_raw["시도"] = a.str[0]
            cat_cols.append("시도")
        if "시군구" not in X_raw.columns:
            X_raw["시군구"] = a.str[1]
            cat_cols.append("시군구")

    # 7) feature engineering (원본 입력 → 파생)
    X_fe_all = engineer(X_raw)

    # 8) present_num/present_cat: 엔지니어링 후 컬럼에서 숫자/문자 분류
    present_num, present_cat = split_num_cat(X_fe_all, exclude=[])

    # 9) 학습/검증 분할(엔지니어링 후 DataFrame 기준으로 동기 분할)
    X_train_fe, X_val_fe, y_train_raw, y_val_raw = train_test_split(
        X_fe_all, y_raw, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    # 10) 타깃 로그 변환(예측 스크립트가 expm1으로 되돌리므로 log1p로 학습)
    y_train = np.log1p(y_train_raw.values.astype(float))
    y_val_true = y_val_raw.values.astype(float)  # MAE는 원 단위로 계산하기 위해 저장

    # 11) 전처리기: 숫자=Imputer, 카테고리=Imputer+OneHot (버전 호환)
    try:
        ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)  # scikit-learn 1.2+
    except TypeError:
        ohe = OneHotEncoder(handle_unknown="ignore", sparse=False)         # scikit-learn <=1.1

    num_pipe = Pipeline(steps=[
        ("impute", SimpleImputer(strategy="median"))
    ])
    cat_pipe = Pipeline(steps=[
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("ohe", ohe)
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipe, present_num),
            ("cat", cat_pipe, present_cat)
        ],
        remainder="drop",
        verbose_feature_names_out=False
    )

    # 12) 전처리 학습 & 변환(한번만 fit, 속도측정은 모델 학습에 한정)
    print("[INFO] Fitting preprocessor...")
    X_train_arr = preprocessor.fit_transform(X_train_fe)
    X_val_arr = preprocessor.transform(X_val_fe)
    train_size = X_train_arr.shape[0]
    print(f"[INFO] Train size: {train_size}, Val size: {X_val_arr.shape[0]}, Features(after preprocess): {X_train_arr.shape[1]}")

    # 13) 모델: GradientBoostingRegressor(warm_start로 에폭 루프 가능)
    model = GradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.05,
        max_depth=3,
        n_estimators=0,     # 에폭에서 누적
        subsample=1.0,
        random_state=RANDOM_STATE,
        warm_start=True
    )

    # 14) 속도계측 시작
    meter = TrainSpeedMeter(train_size=train_size, target_mae=TARGET_MAE, csv_path=SPEED_CSV)
    meter.start()

    # 15) 에폭 루프
    print("[INFO] Training...")
    history = []
    for ep in range(EPOCHS):
        meter.tick_epoch_start()

        # 트리 추가 학습
        model.n_estimators += TREES_PER_EPOCH
        model.fit(X_train_arr, y_train)

        # 검증 MAE(원단위로 환산)
        val_pred_log = model.predict(X_val_arr)
        val_pred = np.expm1(val_pred_log)
        val_mae = float(mean_absolute_error(y_val_true, val_pred))
        meter.tick_epoch_end(val_mae=val_mae)
        history.append({"epoch": ep + 1, "n_estimators": model.n_estimators, "val_mae": val_mae})
        print(f"  - epoch {ep + 1:02d}: n_estimators={model.n_estimators}, val_MAE={val_mae:.4f}")

    # 16) 계측 종료/요약
    result = meter.finish()
    meter.write_csv()
    print("[SPEED]", json.dumps(result, ensure_ascii=False))

    # 17) 최종 파이프라인(예측 스크립트 호환용)
    pipe = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("regressor", model)
    ])

    # predict_premium_v2.py가 기대하는 튜플 구조로 저장
    payload = (engineer, pipe, present_num, present_cat, num_cols, cat_cols, target)
    joblib.dump(payload, MODEL_OUT)
    print(f"[INFO] Saved model to: {MODEL_OUT}")

    # 18) 실행 요약 저장
    summary = {
        "data_path": DATA_PATH,
        "sheet_name": SHEET_NAME,
        "target": target,
        "epochs": EPOCHS,
        "trees_per_epoch": TREES_PER_EPOCH,
        "train_size": int(train_size),
        "val_size": int(X_val_arr.shape[0]),
        "features_out": int(X_train_arr.shape[1]),
        "speed_result": result,
        "val_history": history
    }
    with open(RUN_SUMMARY_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Wrote run summary: {RUN_SUMMARY_JSON}")


if __name__ == "__main__":
    main()
