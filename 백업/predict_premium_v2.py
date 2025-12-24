# predict_premium_v2.py
# 사용법:
#   'JSON' | python predict_premium_v2.py
#   python predict_premium_v2.py --csv one_row.csv

import sys
import json
import argparse
import numpy as np
import pandas as pd
import joblib

# === 학습 시 사용한 engineer와 동일 로직 ===
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
        order_map = {"즉시": 3, "1~2개월": 2, "3~5개월": 1, "6~8개월": 0, "협의 가능": 1}
        X["매매 가능 일정(ord)"] = X["매매 가능 일정"].map(order_map)
    return X

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="premium_model_v2.joblib")
    ap.add_argument("--csv", help="한 줄짜리 CSV로 예측할 때 지정")
    args = ap.parse_args()

    # 저장된 튜플: (engineer, pipe, present_num, present_cat, num_cols, cat_cols, target)
    eng_saved, pipe, present_num, present_cat, num_cols, cat_cols, target = joblib.load(args.model)

    # 입력 읽기 → DataFrame
    if args.csv:
        X = pd.read_csv(args.csv)
    else:
        payload = sys.stdin.read()
        X = pd.DataFrame([json.loads(payload)])

    # 주소만 있고 시/군구 없으면 보완
    if ("시도" not in X.columns or "시군구" not in X.columns) and ("주소" in X.columns):
        a = X["주소"].astype(str).str.split()
        if "시도" not in X.columns:
            X["시도"] = a.str[0]
        if "시군구" not in X.columns:
            X["시군구"] = a.str[1]

    # 학습 때 사용한 "원본 입력 컬럼"만 우선 유지 (없으면 생성해서 NaN)
    needed_raw = sorted(set(num_cols + cat_cols))
    for col in needed_raw:
        if col not in X.columns:
            X[col] = np.nan
    X = X[needed_raw]

    # 안전한 숫자 캐스팅 (문자/콤마 들어와도 NaN 처리)
    for c in num_cols:
        if c in X.columns:
            X[c] = pd.to_numeric(X[c], errors="coerce")

    # 카테고리는 문자열로
    for c in cat_cols:
        if c in X.columns:
            X[c] = X[c].astype("object")

    # 동일한 엔지니어링 적용 (로컬 engineer를 사용)
    X_fe = engineer(X)

    # === 핵심: 학습 시 ColumnTransformer가 기대하는 컬럼 셋/순서 확보 ===
    expected_cols = list(present_num) + list(present_cat)
    # 누락된 엔지니어드 컬럼은 NaN으로 채워 생성
    for col in expected_cols:
        if col not in X_fe.columns:
            X_fe[col] = np.nan
    # 순서 맞추기 + DataFrame 보장
    X_fe = pd.DataFrame(X_fe, columns=expected_cols)

    # 예측
    yhat_log = pipe.predict(X_fe)[0]
    yhat = float(np.expm1(yhat_log))
    print(json.dumps({"predicted_권리금": yhat}, ensure_ascii=False))

if __name__ == "__main__":
    main()
