# make_batch_200.py  (전체 교체본)

import numpy as np
import pandas as pd
import re
import argparse

CATS = [
    "시도","시군구","업태","업종","운영 방식","매장 타입",
    "지하 여부","화장실 상태","운영 상태","매매 가능 일정",
    "브랜드인증","내일사장인증"
]
NUMS = [
    "전용면적","월세","보증금","관리비","층수","근무자 수",
    "월평균 매출액","전용 주차"
]

def to_numeric(x):
    if pd.isna(x):
        return np.nan
    if isinstance(x, (int, float, np.integer, np.floating)):
        return float(x)
    s = str(x)
    if re.search(r"\d+\s*~\s*\d+", s):
        nums = [float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", s)]
        return float(np.mean(nums)) if len(nums) >= 2 else np.nan
    m = re.findall(r"-?\d[\d,]*\.?\d*", s)
    return float(m[0].replace(",", "")) if m else np.nan

def sample_empirical(s: pd.Series, n: int):
    s = s.dropna()
    if len(s) == 0:
        return np.array([np.nan] * n)
    return s.sample(n, replace=True, random_state=42).to_numpy()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--sheet", type=int, default=0)
    ap.add_argument("--out", default="batch_200.csv")
    ap.add_argument("--n", type=int, default=200)
    args = ap.parse_args()

    # 1) 원본 로드
    if args.data.lower().endswith(".xlsx"):
        df = pd.read_excel(args.data, sheet_name=args.sheet)
    else:
        df = pd.read_csv(args.data)

    # 실제 있는 컬럼만 사용
    cats = [c for c in CATS if c in df.columns]
    nums = [c for c in NUMS if c in df.columns]

    # 숫자 정리
    for c in nums:
        df[c] = df[c].apply(to_numeric)

    # 비율 분포 (가능할 때)
    if {"월세", "월평균 매출액"} <= set(df.columns):
        rent_sales = (df["월세"] / df["월평균 매출액"]).replace([np.inf, -np.inf], np.nan)
        rent_sales = rent_sales[(rent_sales > 0) & (rent_sales < 1.5)]
    else:
        rent_sales = pd.Series(dtype=float)

    if {"보증금", "월세"} <= set(df.columns):
        dep_rent = (df["보증금"] / df["월세"]).replace([np.inf, -np.inf], np.nan)
        dep_rent = dep_rent[(dep_rent > 0) & (dep_rent < 200)]
    else:
        dep_rent = pd.Series(dtype=float)

    if {"관리비", "월세"} <= set(df.columns):
        ops_rent = (df["관리비"] / df["월세"]).replace([np.inf, -np.inf], np.nan)
        ops_rent = ops_rent[(ops_rent >= 0) & (ops_rent < 1.0)]
    else:
        ops_rent = pd.Series(dtype=float)

    # 2) 샘플 생성
    N = args.n
    out = pd.DataFrame()

    if "월평균 매출액" in df.columns:
        out["월평균 매출액"] = sample_empirical(df["월평균 매출액"], N)
    if "전용면적" in df.columns:
        out["전용면적"] = sample_empirical(df["전용면적"], N)

    # 월세
    if len(rent_sales) > 0 and "월평균 매출액" in out:
        rs = sample_empirical(rent_sales, N)
        out["월세"] = np.round(np.maximum(out["월평균 매출액"] * rs, 0) / 1000) * 1000
    elif "월세" in df.columns:
        out["월세"] = np.round(np.maximum(sample_empirical(df["월세"], N), 0) / 1000) * 1000

    # 보증금/관리비
    if len(dep_rent) > 0 and "월세" in out:
        dr = sample_empirical(dep_rent, N)
        out["보증금"] = np.round(np.maximum(out["월세"] * dr, 0) / 10000) * 10000
    elif "보증금" in df.columns:
        out["보증금"] = np.round(np.maximum(sample_empirical(df["보증금"], N), 0) / 10000) * 10000

    if len(ops_rent) > 0 and "월세" in out:
        orat = sample_empirical(ops_rent, N)
        out["관리비"] = np.round(np.maximum(out["월세"] * orat, 0) / 1000) * 1000
    elif "관리비" in df.columns:
        out["관리비"] = np.round(np.maximum(sample_empirical(df["관리비"], N), 0) / 1000) * 1000

    # 정수형(판다스 Series로 변환 후 nullable Int64로 캐스팅)
    if "층수" in df.columns:
        _v = pd.to_numeric(pd.Series(sample_empirical(df["층수"], N)), errors="coerce")
        out["층수"] = np.maximum(np.round(_v), 0).astype("Int64")

    if "근무자 수" in df.columns:
        _v = pd.to_numeric(pd.Series(sample_empirical(df["근무자 수"], N)), errors="coerce")
        out["근무자 수"] = np.maximum(np.round(_v), 0).astype("Int64")

    if "전용 주차" in df.columns:
        _v = pd.to_numeric(pd.Series(sample_empirical(df["전용 주차"], N)), errors="coerce")
        out["전용 주차"] = np.maximum(np.round(_v), 0).astype("Int64")

    # 범주형
    for c in cats:
        out[c] = sample_empirical(df[c].astype(str), N)

    # 컬럼 순서 정리
    ordered = [c for c in NUMS if c in out.columns] + [c for c in CATS if c in out.columns]
    out = out[[c for c in ordered if c in out.columns]]

    # 저장
    out.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"[OK] saved {args.out} rows={len(out)}")

if __name__ == "__main__":
    main()
