# api/app.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import RootModel
from typing import Dict, Any, List
import pandas as pd
import numpy as np
import joblib
import io
import pathlib
import os

# ===== 경로 설정 =====
ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "premium_model_v2.joblib"

# ===== 학습과 동일한 engineer 함수 =====
def engineer(df_in: pd.DataFrame) -> pd.DataFrame:
    X = df_in.copy()

    # 면적/비율 파생
    if "전용면적" in X.columns and "월세" in X.columns:
        X["월세_per_m2"] = X["월세"] / X["전용면적"].replace(0, np.nan)
    if "월평균 매출액" in X.columns and "월세" in X.columns:
        X["rent_sales_ratio"] = X["월세"] / X["월평균 매출액"].replace(0, np.nan)

    # 로그 파생
    for col in [
        "전용면적", "월세", "보증금", "관리비", "월평균 매출액",
        "월세_per_m2", "rent_sales_ratio"
    ]:
        if col in X.columns:
            X[f"log1p_{col}"] = np.log1p(pd.to_numeric(X[col], errors="coerce"))

    # 순서형 매핑
    if "매매 가능 일정" in X.columns:
        order_map = {"즉시": 3, "1~2개월": 2, "3~5개월": 1, "6~8개월": 0, "협의 가능": 1}
        X["매매 가능 일정(ord)"] = X["매매 가능 일정"].map(order_map)

    return X

# ===== 모델 로드 =====
# (아래 6줄이 핵심 패치입니다: 언피클이 찾는 __main__.engineer 를 미리 주입)
import __main__
__main__.engineer = engineer  # 1) 현재 파일의 engineer를 등록
try:
    # 2) 보너스: premium_train_v2.py에 동일 함수가 있으면 그것도 등록(선택)
    from premium_train_v2 import engineer as _eng2
    __main__.engineer = _eng2
except Exception:
    pass

# 디버깅용 로그(배포 로그에서 이 줄이 보여야 패치가 실제로 적용된 것)
print("[app] registering __main__.engineer =", getattr(__main__, "engineer", None))

try:
    # 저장된 튜플: (engineer, pipe, present_num, present_cat, num_cols, cat_cols, target)
    eng_saved, pipe, present_num, present_cat, num_cols, cat_cols, target = joblib.load(MODEL_PATH)
    print("[app] model loaded ok from:", MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"모델 로드 실패: {e}")

# ===== FastAPI 앱 & CORS =====
app = FastAPI(title="Premium Predictor API", version="v1")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "null",  # file:// 로 열었을 때 일부 브라우저에서 보내는 Origin
]
# 배포 시에는 환경변수로 프론트 주소를 지정할 수도 있어요.
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "").strip()
if FRONTEND_ORIGIN:
    ALLOWED_ORIGINS = [FRONTEND_ORIGIN]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Pydantic v2: 단건 입력 =====
class PredictPayload(RootModel[Dict[str, Any]]):
    pass

# ===== 공용 전처리 =====
def prepare_df(df: pd.DataFrame) -> pd.DataFrame:
    # 주소 → 시/군구 보완
    if ("시도" not in df.columns or "시군구" not in df.columns) and ("주소" in df.columns):
        a = df["주소"].astype(str).str.split()
        if "시도" not in df.columns:
            df["시도"] = a.str[0]
        if "시군구" not in df.columns:
            df["시군구"] = a.str[1]

    # 학습때 쓰인 원본 입력 컬럼을 맞춤(없으면 NaN 생성)
    needed_raw = sorted(set(num_cols + cat_cols))
    for col in needed_raw:
        if col not in df.columns:
            df[col] = np.nan
    df = df[needed_raw]

    # 타입 정리
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in cat_cols:
        if c in df.columns:
            df[c] = df[c].astype("object")

    # 동일한 엔지니어링
    X_fe = engineer(df)

    # ColumnTransformer가 기대하는 컬럼/순서 고정
    expected_cols = list(present_num) + list(present_cat)
    for col in expected_cols:
        if col not in X_fe.columns:
            X_fe[col] = np.nan
    X_fe = pd.DataFrame(X_fe, columns=expected_cols)

    return X_fe

# ===== 카테고리 후보값 생성 =====
def _categories_from_model() -> Dict[str, List[str]]:
    """파이프라인의 OHE에서 학습된 카테고리 목록 추출"""
    out: Dict[str, List[str]] = {}
    try:
        pre = pipe.named_steps.get("prep")  # ColumnTransformer
        if pre is None:
            return out
        for name, trans, cols in pre.transformers_:
            if name != "cat":
                continue
            ohe = getattr(trans.named_steps, "ohe", None)
            if ohe is None or not hasattr(ohe, "categories_"):
                continue
            for col, opts in zip(cols, ohe.categories_):
                out[col] = [str(x) for x in opts if x is not None and x == x]
    except Exception:
        pass
    return out

def _categories_from_excel() -> Dict[str, List[str]]:
    """권리금_카테고리_리스트.xlsx(있을 때)에서 시트별 첫 컬럼을 후보로 사용"""
    path = ROOT / "권리금_카테고리_리스트.xlsx"
    if not path.exists():
        return {}
    res: Dict[str, List[str]] = {}
    try:
        xls = pd.ExcelFile(path)
        for sheet in xls.sheet_names:
            if sheet == "요약":
                continue
            df = pd.read_excel(path, sheet_name=sheet)
            if not df.empty:
                first_col = df.columns[0]
                vals = df[first_col].dropna().astype(str).tolist()
                if vals:
                    res[sheet] = vals
    except Exception:
        return {}
    return res

def _merge_category_maps(a: Dict[str, List[str]], b: Dict[str, List[str]]) -> Dict[str, List[str]]:
    keys = set(a.keys()) | set(b.keys())
    merged: Dict[str, List[str]] = {}
    for k in keys:
        vals: List[str] = []
        if k in a:
            vals += a[k]
        if k in b:
            vals += b[k]
        merged[k] = sorted(set(map(str, vals)))
    return merged

# ===== 엔드포인트 =====
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "model_path": str(MODEL_PATH),
        "num_cols": list(num_cols),
        "cat_cols": list(cat_cols),
        "allowed_origins": ALLOWED_ORIGINS,
    }

@app.get("/categories")
def categories():
    model_cats = _categories_from_model()
    excel_cats = _categories_from_excel()
    merged = _merge_category_maps(model_cats, excel_cats)
    return merged

@app.post("/predict")
def predict(payload: PredictPayload):
    data = payload.root or {}
    X = pd.DataFrame([data])
    try:
        X_fe = prepare_df(X)
        yhat_log = pipe.predict(X_fe)[0]
        yhat = float(np.expm1(yhat_log))
        return {"predicted_권리금": yhat}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"예측 실패: {e}")

@app.post("/batch_predict")
async def batch_predict(file: UploadFile = File(...)):
    content = await file.read()
    # 파일 파싱
    try:
        if file.filename.lower().endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 파싱 실패: {e}")

    # 예측
    try:
        X_fe = prepare_df(df)
        yhat_log = pipe.predict(X_fe)
        yhat = np.expm1(yhat_log)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"배치 예측 실패: {e}")

    # 응답(결측/무한값 안전 직렬화)
    out = df.copy()
    out["predicted_권리금"] = yhat

    safe = out.replace({np.nan: None, np.inf: None, -np.inf: None})
    payload = {
        "rows": int(len(safe)),
        "columns": list(safe.columns),
        "data": safe.to_dict(orient="records"),
    }
    return jsonable_encoder(payload)

# ===== 개발용 실행 =====
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
