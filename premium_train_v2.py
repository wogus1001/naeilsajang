# premium_train_v2.py
# - v2 파이프라인: 로그 타깃(log(권리금)) + 면적/비율 파생 + 일정 순서형 매핑 + HGBRegressor
# - 범주형 인코더는 scikit-learn 버전에 따라 sparse_output / sparse 자동 호환
# 사용법:
#   python premium_train_v2.py --data "양도양수매물리스트 다운로드 (2).xlsx) --sheet 0
#   # 또는 CSV:
#   python premium_train_v2.py --data data.csv

import argparse
import re
import joblib
import numpy as np
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ===== 설정 =====
CATEGORICAL_COLS = [
    "시도", "시군구", "업태", "업종", "운영 방식", "매장 타입",
    "지하 여부", "화장실 상태", "운영 상태", "매매 가능 일정",
    "브랜드인증", "내일사장인증"
]

NUMERIC_COLS = [
    "전용면적", "월세", "보증금", "관리비", "층수", "근무자 수",
    "월평균 매출액", "전용 주차"
]


# ===== 유틸 함수 =====
def to_numeric(x):
    """숫자/범위/콤마 문자열을 float로 정리"""
    if pd.isna(x):
        return np.nan
    if isinstance(x, (int, float, np.integer, np.floating)):
        return float(x)
    s = str(x)
    # "10~20" → 평균
    if re.search(r"\d+\s*~\s*\d+", s):
        nums = [float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", s)]
        return float(np.mean(nums)) if len(nums) >= 2 else np.nan
    m = re.findall(r"-?\d[\d,]*\.?\d*", s)
    return float(m[0].replace(",", "")) if m else np.nan


def winsorize(s: pd.Series, p=0.01):
    """1%/99% 윈저라이즈(극단값 완화)"""
    if s.isna().all():
        return s
    lo, hi = s.quantile(p), s.quantile(1 - p)
    return s.clip(lo, hi)


def engineer(df_in: pd.DataFrame) -> pd.DataFrame:
    """간단 파생 피처 생성 (입력은 원본 스키마)"""
    X = df_in.copy()
    # 면적/비율
    if "전용면적" in X.columns and "월세" in X.columns:
        X["월세_per_m2"] = X["월세"] / X["전용면적"].replace(0, np.nan)
    if "월평균 매출액" in X.columns and "월세" in X.columns:
        X["rent_sales_ratio"] = X["월세"] / X["월평균 매출액"].replace(0, np.nan)
    # 로그 파생
    for col in ["전용면적", "월세", "보증금", "관리비", "월평균 매출액",
                "월세_per_m2", "rent_sales_ratio"]:
        if col in X.columns:
            X[f"log1p_{col}"] = np.log1p(X[col].astype(float))
    # 순서형 매핑
    if "매매 가능 일정" in X.columns:
        order_map = {"즉시": 3, "1~2개월": 2, "3~5개월": 1, "6~8개월": 0, "협의 가능": 1}
        X["매매 가능 일정(ord)"] = X["매매 가능 일정"].map(order_map)
    return X


def make_ohe():
    """OneHotEncoder 버전 호환 (신버전: sparse_output, 구버전: sparse)"""
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)  # sklearn ≥ 1.2~
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)         # sklearn < 1.2


# ===== 메인 =====
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="학습 데이터(.xlsx/.csv)")
    ap.add_argument("--sheet", type=int, default=0, help="엑셀 시트 인덱스(기본 0)")
    ap.add_argument("--target", default="권리금")
    ap.add_argument("--model_out", default="premium_model_v2.joblib")
    args = ap.parse_args()

    # 데이터 로드
    if args.data.lower().endswith(".xlsx"):
        df = pd.read_excel(args.data, sheet_name=args.sheet)
    else:
        df = pd.read_csv(args.data)

    # 주소 → 시도/시군구 보완
    if ("시도" not in df.columns or "시군구" not in df.columns) and ("주소" in df.columns):
        a = df["주소"].astype(str).str.split()
        if "시도" not in df.columns:
            df["시도"] = a.str[0]
        if "시군구" not in df.columns:
            df["시군구"] = a.str[1]

    # 사용할 컬럼
    num_cols = [c for c in NUMERIC_COLS if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_COLS if c in df.columns]
    use_cols = list(set(num_cols + cat_cols + [args.target]))
    data = df[use_cols].copy()

    # 숫자/타깃 정리
    for c in num_cols + [args.target]:
        if c in data.columns:
            data[c] = data[c].apply(to_numeric)

    # 유효 타깃만 남기기
    data = data[~data[args.target].isna() & (data[args.target] > 0)]

    # 윈저라이즈
    for c in num_cols:
        data[c] = winsorize(data[c], 0.01)
    data[args.target] = winsorize(data[args.target], 0.01)

    # 파생 + 로그 타깃
    X_all = engineer(data.drop(columns=[args.target]))
    y_all_log = np.log1p(data[args.target].astype(float))

    # 실제 학습에 쓰이는 컬럼 결정
    present_num = [c for c in X_all.columns if c not in cat_cols]
    present_cat = [c for c in X_all.columns if c in cat_cols]

    # 파이프라인(버전 호환 OHE + dense 강제)
    num_pipe = Pipeline([("imp", SimpleImputer(strategy="median"))])
    cat_pipe = Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                         ("ohe", make_ohe())])

    transformers = [("num", num_pipe, present_num)]
    if len(present_cat) > 0:
        transformers.append(("cat", cat_pipe, present_cat))

    preprocess = ColumnTransformer(
        transformers=transformers,
        sparse_threshold=0.0  # 강제로 dense 출력
    )

    model = HistGradientBoostingRegressor(
        max_iter=300,
        learning_rate=0.06,
        l2_regularization=0.1,
        min_samples_leaf=20,
        random_state=42
    )

    pipe = Pipeline([("prep", preprocess), ("model", model)])

    # 학습/평가
    X_tr, X_te, y_tr, y_te = train_test_split(X_all, y_all_log, test_size=0.2, random_state=42)
    pipe.fit(X_tr, y_tr)
    pred_log = pipe.predict(X_te)

    y_pred = np.expm1(pred_log)
    y_true = np.expm1(y_te)

    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5
    r2 = r2_score(y_true, y_pred)

    print({"rows": len(X_all), "MAE": float(mae), "RMSE": float(rmse), "R2": float(r2)})

    # 모델 저장 (엔지니어 함수와 메타 포함)
    joblib.dump(
        (engineer, pipe, present_num, present_cat, num_cols, cat_cols, args.target),
        args.model_out
    )
    print(f"[OK] Saved {args.model_out}")


if __name__ == "__main__":
    main()
