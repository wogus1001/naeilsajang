import pandas as pd
import argparse

CATS = ["시도","시군구","업태","업종","운영 방식","매장 타입",
        "지하 여부","화장실 상태","운영 상태","매매 가능 일정",
        "브랜드인증","내일사장인증"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="원본 파일 경로 (.xlsx/.csv)")
    ap.add_argument("--sheet", type=int, default=0, help="엑셀 시트 번호(기본 0)")
    ap.add_argument("--out", default="권리금_카테고리_리스트.xlsx")
    args = ap.parse_args()

    # 원본 로드
    if args.data.lower().endswith(".xlsx"):
        df = pd.read_excel(args.data, sheet_name=args.sheet)
    else:
        df = pd.read_csv(args.data)

    # 실제 존재하는 카테고리만 사용
    cats = [c for c in CATS if c in df.columns]

    with pd.ExcelWriter(args.out, engine="openpyxl") as w:
        # 요약 시트
        pd.DataFrame({
            "구분": ["범주형(카테고리)"],
            "컬럼 수": [len(cats)],
            "목록": [", ".join(cats)]
        }).to_excel(w, index=False, sheet_name="요약")

        # 각 컬럼별 시트(값 + 건수)
        for col in cats:
            vc = df[col].fillna("(결측)").astype(str).value_counts().reset_index()
            vc.columns = [col, "건수"]
            vc.to_excel(w, index=False, sheet_name=col[:31])  # Excel 시트명 31자 제한

    print(f"[OK] 저장됨: {args.out}")

if __name__ == "__main__":
    main()
