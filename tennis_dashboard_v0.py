#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
테니스장–회원 매칭 대시보드 v0 (Streamlit 선택 / HTML 대체)

버그 수정: `SyntaxError: f-string: valid expression required before '}'`
- 원인: Python f-string 내부에 JS 블록(중괄호 `{}`)을 그대로 썼기 때문 → 파이썬이 `{}`를 표현식으로 오인
- 해결: HTML/JS 생성부를 **f-string 대신 string.Template**로 변경하여 `{}` 이슈 제거

또한 이전 이슈(`ModuleNotFoundError: No module named 'streamlit'`) 회피를 위해:
- Streamlit은 선택적 임포트, 미설치 환경에서는 **정적 HTML 대시보드**를 생성/서빙

사용법(권장):
1) 데모로 즉시 실행(HTML 대시보드 생성 + 간이 서버):
   python tennis_dashboard_v0.py --demo --ui auto --report-html ./demo_report.html --serve 8501
   → http://localhost:8501 에서 열람

2) 실제 데이터 사용(HTML):
   python tennis_dashboard_v0.py \
     --facilities /mnt/data/공공체육시설현황_추가컬럼.xlsx \
     --members /mnt/data/member_profile_data_1000_adjusted_ages_60pct05.csv \
     --ui html --report-html ./match_report_v0.html --serve 8501

3) Streamlit이 설치되어 있다면(선택):
   streamlit run tennis_dashboard_v0.py
   또는
   python tennis_dashboard_v0.py --ui streamlit

추가 옵션:
- --topk 5 --sample-n 300  (추천 수/샘플 수)
- --weights loc=0.45,price=0.2,time=0.2,amenity=0.05,coach=0.1 (쉼표 구분 키=값)
- --run-tests (내장 테스트만 실행)

주의:
- 엑셀(.xlsx) 읽기엔 openpyxl가 필요할 수 있습니다(`pip install openpyxl`).
- HTML 모드는 **표/검색/필터/요약/히스토그램**을 한 페이지에 제공합니다(지도/드롭다운 UI는 간단화).
"""

import argparse
import base64
import io
import importlib.util
import json
import os
import re
import sys
import textwrap
import warnings
import webbrowser
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from string import Template

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# =============================
# 유틸 & 공통 함수
# =============================

def has_streamlit() -> bool:
    return importlib.util.find_spec("streamlit") is not None


def detect_col(df: pd.DataFrame, candidates: List[str], contains_any: Optional[List[str]] = None) -> Optional[str]:
    cols = [str(c).strip() for c in df.columns]
    for cand in candidates:
        if cand in cols:
            return cand
    if contains_any:
        lowered = {c: str(c).lower() for c in cols}
        for c, lc in lowered.items():
            if all(s.lower() in lc for s in contains_any):
                return c
    return None


def norm_text(x: object) -> str:
    return str(x).strip().lower() if pd.notna(x) else ""


# =============================
# 로딩/전처리
# =============================

def parse_lesson_fee(text: object) -> float:
    if pd.isna(text):
        return np.nan
    s = str(text)
    m = re.search(r"레슨\s*([\d,]+)", s)
    if m:
        return float(m.group(1).replace(",", ""))
    m2 = re.search(r"([\d,]+)\s*원", s)
    if m2:
        return float(m2.group(1).replace(",", ""))
    return np.nan


def parse_time_range(text: object) -> Tuple[Optional[int], Optional[int]]:
    if pd.isna(text):
        return (None, None)
    times = re.findall(r"(\d{1,2}):?(\d{2})", str(text))
    mins: List[int] = []
    for hh, mm in times:
        try:
            mins.append(int(hh) * 60 + int(mm))
        except Exception:
            pass
    if len(mins) >= 2:
        return (min(mins), max(mins))
    return (None, None)


def prepare_facilities(fac_df: pd.DataFrame) -> pd.DataFrame:
    df = fac_df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    col_city = detect_col(df, ["시군명", "지역"], None)
    col_addr = detect_col(df, ["소재지도로명주소", "주소"], None)
    col_hours = detect_col(df, ["운영 시간", "영업 시간", "운영시간", "영업시간"], None)
    col_price_text = detect_col(df, ["이용 요금", "요금"], ["요금"])
    col_coach_style = detect_col(df, ["코치 수 및 스타일", "코치스타일", "코치 스타일"], ["코치", "스타일"])
    col_amenity_level = detect_col(df, ["시설 완비 수준"], ["완비", "수준"])

    col_lat = detect_col(df, ["위도", "WGS84위도", "lat", "latitude"], None)
    col_lon = detect_col(df, ["경도", "WGS84경도", "lon", "longitude"], None)

    df["_city"] = df[col_city] if col_city else ""
    df["_addr"] = df[col_addr] if col_addr else ""

    if col_price_text:
        df["lesson_fee"] = df[col_price_text].apply(parse_lesson_fee)
    else:
        df["lesson_fee"] = np.nan

    if col_hours:
        df["open_min"], df["close_min"] = zip(*df[col_hours].apply(parse_time_range))
    else:
        df["open_min"], df["close_min"] = (None, None)

    def split_amenities(x: object) -> List[str]:
        if pd.isna(x):
            return []
        s = str(x)
        for sep in ["/", "·", "|"]:
            s = s.replace(sep, ",")
        parts = [t.strip() for t in s.split(",") if t.strip()]
        return parts

    if col_amenity_level:
        amenity_lists = df[col_amenity_level].apply(split_amenities)
        df["_amenity_count"] = amenity_lists.apply(len)
        max_cnt = max(int(df["_amenity_count"].max()), 1)
        df["amenity_norm"] = df["_amenity_count"] / max_cnt
    else:
        df["amenity_norm"] = 0.5

    df["coach_style_norm"] = df[col_coach_style].apply(norm_text) if col_coach_style else ""

    if col_lat and col_lon:
        df["lat"] = pd.to_numeric(df[col_lat], errors="coerce")
        df["lon"] = pd.to_numeric(df[col_lon], errors="coerce")
    else:
        df["lat"] = np.nan
        df["lon"] = np.nan

    return df


def budget_from_category(cat: object) -> float:
    s = norm_text(cat)
    if not s:
        return np.nan
    if "미만" in s:
        return 100_000.0
    if "10-30" in s or "10–30" in s or "10-30만" in s:
        return 200_000.0
    if "30" in s and ("이상" in s or "만" in s):
        return 400_000.0
    return np.nan


def time_pref_to_range(pref: str) -> Optional[Tuple[int, int]]:
    p = norm_text(pref)
    if any(k in p for k in ["오전", "morning", "am"]):
        return (6 * 60, 12 * 60)
    if any(k in p for k in ["오후", "afternoon", "pm"]):
        return (12 * 60, 18 * 60)
    if any(k in p for k in ["저녁", "야간", "evening", "night"]):
        return (18 * 60, 23 * 60)
    return None


def prepare_members(mem_df: pd.DataFrame) -> pd.DataFrame:
    df = mem_df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    col_member_id = detect_col(df, ["회원ID", "회원id", "member_id", "id"], None)
    col_residence = detect_col(df, ["거주지", "주소", "지역"], None)
    col_timepref = detect_col(df, ["주_이용_시간대", "선호_레슨_시간대"], None)
    col_coach_pref = detect_col(df, ["선호_코치_스타일"], None)
    col_center_type = detect_col(df, ["선호_테니스_센터_유형"], None)
    col_budget_num = detect_col(df, ["월_스포츠_예산", "예산", "budget"], None)
    col_budget_cat = detect_col(df, ["소비_성향"], None)

    col_lat = detect_col(df, ["위도", "WGS84위도", "lat", "latitude"], None)
    col_lon = detect_col(df, ["경도", "WGS84경도", "lon", "longitude"], None)

    if col_member_id is None:
        warnings.warn("회원ID 컬럼이 없어 임시 ID를 생성합니다.")
        df["member_id"] = [f"M{i:04d}" for i in range(len(df))]
    else:
        df["member_id"] = df[col_member_id]

    df["res_text"] = df[col_residence] if col_residence else ""
    df["time_pref_raw"] = df[col_timepref] if col_timepref else ""
    df["coach_pref_raw"] = df[col_coach_pref] if col_coach_pref else ""
    df["center_type_raw"] = df[col_center_type] if col_center_type else ""

    if col_budget_num:
        df["budget_est"] = pd.to_numeric(df[col_budget_num], errors="coerce")
    else:
        df["budget_est"] = df[col_budget_cat].apply(budget_from_category) if col_budget_cat else np.nan

    if col_lat and col_lon:
        df["lat"] = pd.to_numeric(df[col_lat], errors="coerce")
        df["lon"] = pd.to_numeric(df[col_lon], errors="coerce")
    else:
        df["lat"] = np.nan
        df["lon"] = np.nan

    df["res_norm"] = df["res_text"].apply(norm_text)
    df["time_pref_norm"] = df["time_pref_raw"].apply(norm_text)
    df["coach_pref_norm"] = df["coach_pref_raw"].apply(norm_text)
    df["center_type_norm"] = df["center_type_raw"].apply(norm_text)

    return df


# =============================
# 점수 & 매칭 + (신규) 단일 유저 입력 지원 헬퍼
# =============================

def build_member_df_from_inputs(
    member_id: str,
    residence: str,
    time_pref: str,
    coach_pref: str,
    center_type: str,
    budget_num: Optional[float] = None,
    budget_cat: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
) -> pd.DataFrame:
    """프론트(단일 사용자 입력)로부터 회원 DataFrame 1행 생성.
    - 기존 prepare_members()와 호환되는 컬럼명을 사용.
    - budget_num이 있으면 숫자 우선, 없으면 budget_cat 사용.
    """
    row = {
        "회원ID": member_id or "UFORM",
        "거주지": residence or "",
        "주_이용_시간대": time_pref or "",
        "선호_코치_스타일": coach_pref or "",
        "선호_테니스_센터_유형": center_type or "",
    }
    if budget_num is not None and not pd.isna(budget_num):
        row["월_스포츠_예산"] = float(budget_num)
    elif budget_cat:
        row["소비_성향"] = budget_cat
    if lat is not None and lon is not None:
        row["위도"] = lat
        row["경도"] = lon
    return pd.DataFrame([row])

# =============================
# 점수 & 매칭
# =============================

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2.0)**2 + np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c


def location_score_text(member_res: str, fac_city: str, fac_addr: str) -> float:
    m = norm_text(member_res)
    c = norm_text(fac_city)
    a = norm_text(fac_addr)
    if not m:
        return 0.5
    if c and c in m:
        return 1.0
    toks = [t for t in m.replace(",", " ").split() if t]
    if a and any(t for t in toks if t in a):
        return 0.7
    first = toks[0] if toks else ""
    if first and ((c and first in c) or (a and first in a)):
        return 0.6
    return 0.2


def time_overlap_score(pref_range: Optional[Tuple[int, int]], open_min: Optional[int], close_min: Optional[int]) -> float:
    if pref_range is None:
        return 0.5
    if None in [open_min, close_min]:
        return 0.5
    a, b = pref_range
    c, d = int(open_min), int(close_min)
    left = max(a, c)
    right = min(b, d)
    return max(0, right - left) / max(1, b - a)


def contains_coach_style(text_norm: str, pref_norm: str) -> bool:
    s = text_norm
    p = pref_norm
    if not p:
        return False
    if "친절" in p:
        return "친절" in s
    if "엄격" in p:
        return "엄격" in s
    if "동기부여" in p:
        return "동기부여" in s
    return p in s


def normalize_weights(w: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(0.0, float(v)) for v in w.values())
    if total <= 0:
        return {k: 0.0 for k in w}
    return {k: float(v)/total for k, v in w.items()}


def match(
    fac: pd.DataFrame,
    mem: pd.DataFrame,
    topk: int = 5,
    sample_n: Optional[int] = None,
    weight_override: Optional[Dict[str, float]] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    mem_use = mem.iloc[: int(sample_n)].copy() if sample_n is not None else mem.copy()

    has_member_coords = {"lat","lon"}.issubset(mem_use.columns) and mem_use[["lat", "lon"]].notna().all(axis=1).any()
    has_facility_coords = {"lat","lon"}.issubset(fac.columns) and fac[["lat", "lon"]].notna().all(axis=1).any()

    if has_member_coords and has_facility_coords:
        base = dict(dist=0.50, price=0.15, time=0.20, amenity=0.05, coach=0.10)
        use_text_loc = False
    else:
        base = dict(loc=0.45, price=0.20, time=0.20, amenity=0.05, coach=0.10)
        use_text_loc = True

    if weight_override:
        for k in list(weight_override.keys()):
            if k not in {"dist","loc","price","time","amenity","coach"}:
                weight_override.pop(k)
        base.update({k: float(v) for k, v in weight_override.items()})
    w = normalize_weights(base)

    rows = []
    nF = len(fac)

    for i, r in mem_use.iterrows():
        score = np.zeros(nF, dtype=float)

        if use_text_loc:
            loc_scores = np.array([
                location_score_text(r.get("res_norm", ""), fac.iloc[j]["_city"] if "_city" in fac.columns else "", fac.iloc[j]["_addr"] if "_addr" in fac.columns else "")
                for j in range(nF)
            ])
            score += w.get("loc", 0.0) * loc_scores
        else:
            dist = haversine(float(r["lat"]), float(r["lon"]), fac["lat"].astype(float).values, fac["lon"].astype(float).values)
            dist_score = np.clip(1 - (dist / 8.0), 0, 1)
            score += w.get("dist", 0.0) * dist_score

        budget = r.get("budget_est", np.nan)
        fee = fac.get("lesson_fee", pd.Series([np.nan]*nF)).values.astype(float)
        if pd.notna(budget) and budget > 0:
            per_session = budget / 4.0
            with np.errstate(divide='ignore', invalid='ignore'):
                price_score = np.where(~np.isnan(fee),
                                       np.where(fee <= per_session, 1.0, np.maximum(0.0, 1.0 - (fee - per_session) / max(per_session, 1.0))),
                                       0.5)
            score += w.get("price", 0.0) * price_score
        else:
            score += w.get("price", 0.0) * 0.5

        pref_range = time_pref_to_range(r.get("time_pref_norm", ""))
        openm = fac.get("open_min", pd.Series([None]*nF)).values
        closem = fac.get("close_min", pd.Series([None]*nF)).values
        time_score = np.array([time_overlap_score(pref_range, o, c) for o, c in zip(openm, closem)])
        score += w.get("time", 0.0) * time_score

        center_pref = r.get("center_type_norm", "")
        amenity_norm = fac.get("amenity_norm", pd.Series([0.5]*nF)).values
        if "시설 완비" in center_pref:
            score += w.get("amenity", 0.0) * amenity_norm
        else:
            score += w.get("amenity", 0.0) * 0.5

        pref_coach = r.get("coach_pref_norm", "")
        if pref_coach and pref_coach != "미입력":
            coach_series = fac.get("coach_style_norm", pd.Series([""]*nF))
            coach_score = np.array([1.0 if contains_coach_style(norm_text(cs), pref_coach) else 0.3 for cs in coach_series.values])
            score += w.get("coach", 0.0) * coach_score
        else:
            score += w.get("coach", 0.0) * 0.5

        idx = np.argsort(-score)[:topk]
        for rank, fi in enumerate(idx, start=1):
            fac_name = fac.iloc[fi]["시설명"] if "시설명" in fac.columns else str(fi)
            rows.append({
                "member_index": i,
                "member_id": r.get("member_id", f"M{i:04d}"),
                "facility_index": int(fi),
                "facility_name": fac_name,
                "score": float(score[fi]),
                "rank": rank,
            })

    out = pd.DataFrame(rows)
    top1 = out[out["rank"] == 1].copy()
    summary = pd.DataFrame({
        "metric": ["num_facilities","num_members_total","num_members_sample","avg_top1_score","median_top1_score"],
        "value": [float(len(fac)), float(len(mem)), float(len(mem_use)), float(top1["score"].mean()) if len(top1) else np.nan, float(top1["score"].median()) if len(top1) else np.nan],
    })
    return out, summary


# =============================
# 데모 데이터 & 테스트 (기존 + 추가)
# =============================

def _make_demo_facilities() -> pd.DataFrame:
    data = {
        "시설명": ["A코트", "B코트"],
        "시군명": ["서울특별시 강남구", "서울특별시 서초구"],
        "소재지도로명주소": ["서울특별시 강남구 테니스로 1", "서울특별시 서초구 라켓길 2"],
        "운영 시간": ["06:00~22:00", "10:00~20:00"],
        "이용 요금": ["레슨 70,000원/시간", "레슨 120,000원/시간"],
        "코치 수 및 스타일": ["친절 중심, 3명", "엄격 피드백, 2명"],
        "시설 완비 수준": ["샤워실, 라커, 주차장", "샤워실"],
        "위도": [37.4979, 37.4919],
        "경도": [127.0276, 127.0166],
    }
    return pd.DataFrame(data)


def _make_demo_members() -> pd.DataFrame:
    data = {
        "회원ID": ["U001", "U002"],
        "거주지": ["서울특별시 강남구 삼성동", "서울특별시 서초구 반포동"],
        "주_이용_시간대": ["오후", "오전"],
        "선호_코치_스타일": ["친절", "엄격"],
        "선호_테니스_센터_유형": ["시설 완비", "시설 완비"],
        "소비_성향": ["10–30만", "30만 이상"],
        "위도": [37.515, 37.501],
        "경도": [127.059, 127.011],
    }
    return pd.DataFrame(data)


def run_unit_tests():
    # 기존 테스트(변경 금지)
    assert parse_lesson_fee("레슨 70,000원/시간") == 70000.0
    assert parse_lesson_fee("120,000원 (개인)") == 120000.0
    assert np.isnan(parse_lesson_fee("문의 요망"))

    assert time_overlap_score((12*60, 18*60), 6*60, 22*60) == 1.0
    assert 0.0 <= time_overlap_score((18*60, 23*60), 10*60, 20*60) <= 1.0

    fac = prepare_facilities(_make_demo_facilities())
    mem = prepare_members(_make_demo_members())
    res, _ = match(fac, mem, topk=1)
    top1_u001 = res[(res.member_id == "U001") & (res.rank == 1)].iloc[0]
    assert top1_u001["facility_name"] == "A코트"

    # 추가 테스트 1: 가중치 정규화
    w = normalize_weights({"loc":0.45, "price":0.2, "time":0.2, "amenity":0.05, "coach":0.1})
    assert abs(sum(w.values()) - 1.0) < 1e-9

    # 추가 테스트 2: 위치 점수 범위와 일치 조건
    assert location_score_text("서울특별시 강남구", "서울특별시 강남구", "강남구 테니스로") == 1.0
    assert 0.2 <= location_score_text("", "", "") <= 1.0

    # 추가 테스트 3: TopK 행 수 확인(2명×Top2=4행)
    res2, summ2 = match(fac, mem, topk=2)
    assert len(res2) == 2 * 2

    # 추가 테스트 4: HTML 대시보드 생성 검증(파일 생성 및 핵심 요소 포함)
    tmp = Path("./_test_report.html")
    try:
        build_html_dashboard(res2, summ2, tmp)
        assert tmp.exists()
        content = tmp.read_text(encoding="utf-8")
        assert "memberSelect" in content and "resultTable" in content
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass

    print("[TEST] All tests passed.")


# =============================
# HTML 대시보드 생성(대체 UI)
# =============================

def _fig_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return b64


def build_html_dashboard(results: pd.DataFrame, summary: pd.DataFrame, out_html: Path):
    out_html.parent.mkdir(parents=True, exist_ok=True)

    # 요약 테이블 HTML
    summary_html = summary.to_html(index=False, escape=False)

    # 점수 히스토그램 (Top-1)
    top1 = results[results["rank"] == 1]
    fig = plt.figure()
    if not top1.empty:
        top1["score"].hist(bins=20)
    plt.title("Top-1 매칭 점수 분포 (v0)")
    score_b64 = _fig_to_base64(fig)

    # 결과 데이터(JSON) – 브라우저에서 필터/검색
    view_cols = [c for c in ["member_id","facility_name","score","rank"] if c in results.columns]
    data_json = results[view_cols].sort_values(["member_id","rank"]).to_dict(orient="records")
    data_js = json.dumps(data_json, ensure_ascii=False)

    tpl = Template(
        """
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>테니스 매칭 대시보드 v0 (HTML)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', Arial, sans-serif; margin: 24px; }
    h1, h2 { margin: .4em 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border: 1px solid #eee; padding: 8px 10px; text-align: left; }
    th { background: #fafafa; }
    .controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin: 8px 0; }
    .controls input, .controls select { padding: 6px 10px; border:1px solid #ddd; border-radius: 8px; }
    .metric { font-size: 20px; margin: 4px 0; }
    .muted { color:#666; }
  </style>
</head>
<body>
  <h1>🎾 테니스장–회원 매칭 대시보드 v0</h1>
  <div class="grid">
    <div class="card">
      <h2>요약 지표</h2>
      $SUMMARY_HTML
    </div>
    <div class="card">
      <h2>Top-1 점수 분포</h2>
      <img alt="score histogram" src="data:image/png;base64,$SCORE_B64" />
    </div>
  </div>

  <div class="card" style="margin-top:16px;">
    <h2>결과 표</h2>
    <div class="controls">
      <label>회원ID:
        <select id="memberSelect"></select>
      </label>
      <label>검색:
        <input type="text" id="searchBox" placeholder="시설명/회원ID 검색" />
      </label>
      <label>표시 행 수:
        <select id="pageSize"><option>20</option><option>50</option><option selected>100</option><option>200</option></select>
      </label>
    </div>
    <table id="resultTable">
      <thead><tr><th>member_id</th><th>facility_name</th><th>score</th><th>rank</th></tr></thead>
      <tbody></tbody>
    </table>
    <p class="muted">* 표는 클라이언트에서 필터/검색됩니다.</p>
  </div>

  <script>
    const raw = $DATA_JSON;
    let data = raw.slice();

    const memberSelect = document.getElementById('memberSelect');
    const searchBox = document.getElementById('searchBox');
    const pageSize = document.getElementById('pageSize');
    const tbody = document.querySelector('#resultTable tbody');

    // 멤버 목록 채우기
    const members = Array.from(new Set(raw.map(r => r.member_id)));
    const mk = (tag, attrs={}, text='') => { const el=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); if(text) el.textContent=text; return el; };
    memberSelect.appendChild(mk('option',{},'(전체)'));
    members.forEach(m => memberSelect.appendChild(mk('option',{},m)));

    function render() {
      const sel = memberSelect.value;
      const q = (searchBox.value || '').toLowerCase();
      const n = parseInt(pageSize.value || '100', 10);
      let view = raw;
      if (sel && sel !== '(전체)') view = view.filter(r => r.member_id === sel);
      if (q) view = view.filter(r => (r.member_id||'').toLowerCase().includes(q) || (r.facility_name||'').toLowerCase().includes(q));
      view = view.slice(0, n);
      tbody.innerHTML = '';
      view.forEach(r => {
        const tr = document.createElement('tr');
        ['member_id','facility_name','score','rank'].forEach(k => {
          const td = document.createElement('td'); td.textContent = r[k]; tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    memberSelect.addEventListener('change', render);
    searchBox.addEventListener('input', render);
    pageSize.addEventListener('change', render);
    render();
  </script>
</body>
</html>
        """
    )

    html = tpl.safe_substitute(
        SUMMARY_HTML=summary_html,
        SCORE_B64=score_b64,
        DATA_JSON=data_js,
    )
    out_html.write_text(html, encoding="utf-8")


# =============================
# 간이 HTTP 서버 (HTML 보기용)
# =============================

def serve_file(html_path: Path, port: int = 8501):
    cwd = html_path.parent.resolve()
    os.chdir(cwd)
    url = f"http://localhost:{port}/{html_path.name}"
    print(f"* Serving {html_path.name} at {url}")

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # quieter

    httpd = HTTPServer(("", port), Handler)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n* Server stopped")


# =============================
# Streamlit 모드 (선택적)
# =============================

def run_streamlit_app():
    # 지연 임포트로 ModuleNotFoundError 회피
    import streamlit as st  # type: ignore

    def _load_uploaded_table(uploaded, kind: str) -> Optional[pd.DataFrame]:
        if uploaded is None:
            return None
        name = uploaded.name.lower()
        try:
            if name.endswith(".xlsx") or name.endswith(".xls"):
                return pd.read_excel(uploaded)
            else:
                return pd.read_csv(uploaded)
        except Exception as e:
            st.error(f"{kind} 파일을 읽는 중 오류: {e}")
            return None

    st.set_page_config(page_title="테니스 매칭 대시보드 v0", layout="wide")
    st.title("🎾 테니스장–회원 매칭 대시보드 v0")

    with st.sidebar:
        st.header("모드 / 데이터")
        mode = st.radio("모드 선택", ["유저 입력(단일)", "배치(업로드/데모)"] , index=0)

        st.subheader("시설 데이터")
        fac_src = st.radio("시설 데이터 소스", ["업로드", "데모"], index=1, key="fac_src")
        fac_df = None
        if fac_src == "업로드":
            fac_up = st.file_uploader("시설 데이터(.xlsx/.csv)", type=["xlsx","xls","csv"], key="fac")
            fac_df = _load_uploaded_table(fac_up, "시설")
            st.caption("엑셀 파일은 openpyxl 설치가 필요할 수 있습니다.")
        else:
            fac_df = _make_demo_facilities()

        st.divider(); st.header("매칭 파라미터")
        topk = st.slider("Top-K 추천 수", 1, 10, 5, 1)

        with st.expander("고급: 가중치 조정(합은 자동 정규화)"):
            use_text_weights = st.checkbox("텍스트 기반 위치 가중치 사용 강제", value=False)
            if use_text_weights:
                loc = st.slider("위치(텍스트)", 0.0, 1.0, 0.45, 0.01)
                price = st.slider("가격", 0.0, 1.0, 0.20, 0.01)
                time = st.slider("시간", 0.0, 1.0, 0.20, 0.01)
                amenity = st.slider("시설", 0.0, 1.0, 0.05, 0.01)
                coach = st.slider("코치", 0.0, 1.0, 0.10, 0.01)
                weight_override = dict(loc=loc, price=price, time=time, amenity=amenity, coach=coach)
            else:
                dist = st.slider("거리", 0.0, 1.0, 0.50, 0.01)
                price = st.slider("가격", 0.0, 1.0, 0.15, 0.01)
                time = st.slider("시간", 0.0, 1.0, 0.20, 0.01)
                amenity = st.slider("시설", 0.0, 1.0, 0.05, 0.01)
                coach = st.slider("코치", 0.0, 1.0, 0.10, 0.01)
                weight_override = dict(dist=dist, price=price, time=time, amenity=amenity, coach=coach)

    # ------- 메인 영역 -------
    if mode == "유저 입력(단일)":
        st.subheader("🧑 사용자 입력")
        with st.form("user_form"):
            col1, col2 = st.columns(2)
            with col1:
                member_id = st.text_input("회원ID", value="UFORM")
                residence = st.text_input("거주지(예: 서울특별시 강남구)", value="")
                time_pref = st.selectbox("선호 시간대", ["", "오전", "오후", "저녁"], index=1, help="빈 값이면 무관")
                center_type = st.selectbox("센터 유형 선호", ["", "시설 완비"], index=0)
            with col2:
                coach_pref = st.selectbox("코치 스타일 선호", ["", "친절", "엄격", "동기부여"], index=0)
                budget_mode = st.radio("예산 입력 방식", ["숫자(원)", "범주"], index=0)
                if budget_mode == "숫자(원)":
                    budget_num = st.number_input("월 스포츠 예산(원)", min_value=0, value=200000, step=10000)
                    budget_cat = None
                else:
                    budget_cat = st.selectbox("소비 성향", ["", "10–30만", "30만 이상", "10만 미만"], index=1)
                    budget_num = None
                st.caption("좌표 입력은 옵션입니다. 없으면 텍스트 기반 위치 매칭을 사용합니다.")
                lat = st.number_input("위도(lat)", value=0.0, format="%.6f")
                lon = st.number_input("경도(lon)", value=0.0, format="%.6f")
                use_coords = st.checkbox("입력한 좌표 사용", value=False)

            submitted = st.form_submit_button("추천 보기", type="primary")

        if submitted:
            if fac_df is None or fac_df.empty:
                st.error("시설 데이터가 없습니다. 사이드바에서 업로드하거나 데모를 선택하세요.")
                return
            # 좌표 사용 여부에 따라 None 처리
            lat_val = float(lat) if use_coords else None
            lon_val = float(lon) if use_coords else None
            mem_one = build_member_df_from_inputs(
                member_id=member_id,
                residence=residence,
                time_pref=time_pref,
                coach_pref=coach_pref,
                center_type=center_type,
                budget_num=budget_num,
                budget_cat=budget_cat,
                lat=lat_val,
                lon=lon_val,
            )
            fac = prepare_facilities(fac_df)
            mem = prepare_members(mem_one)
            if use_text_weights:
                # 강제로 텍스트 기반 위치 사용하도록 좌표 drop
                if {"lat","lon"}.issubset(fac.columns):
                    fac = fac.copy(); fac["lat"], fac["lon"] = np.nan, np.nan
                if {"lat","lon"}.issubset(mem.columns):
                    mem = mem.copy(); mem["lat"], mem["lon"] = np.nan, np.nan
            res, summ = match(fac, mem, topk=int(topk), sample_n=None, weight_override=weight_override)

            st.success("추천 결과가 준비되었습니다.")
            st.write("### 요약 지표")
            c1, c2, c3 = st.columns(3)
            top1 = res[res["rank"]==1]["score"].mean() if not res.empty else 0.0
            c1.metric("평균 Top1", f"{top1:.4f}")
            c2.metric("시설 수", f"{len(fac)}")
            c3.metric("추천 수(TopK)", f"{int(topk)}")

            st.write("### 추천 표 (상위 TopK)")
            st.dataframe(res.sort_values(["rank","score"], ascending=[True, False]), use_container_width=True)
            st.download_button("CSV 다운로드", data=res.to_csv(index=False).encode("utf-8-sig"), file_name=f"match_{member_id}.csv", mime="text/csv")

    else:  # 배치(업로드/데모)
        st.subheader("📦 배치 매칭 (업로드/데모)")
        with st.expander("회원 데이터 로드", expanded=True):
            mem_src = st.radio("회원 데이터 소스", ["업로드", "데모"], index=1, key="mem_src")
            if mem_src == "업로드":
                mem_up = st.file_uploader("회원 데이터(.xlsx/.csv)", type=["xlsx","xls","csv"], key="mem")
                mem_df = _load_uploaded_table(mem_up, "회원")
            else:
                mem_df = _make_demo_members()
            sample_n_enable = st.checkbox("샘플 수 제한", value=True)
            sample_n = st.number_input("앞에서부터 N명", min_value=1, value=300, step=50) if sample_n_enable else None

        run_btn = st.button("매칭 실행", type="primary")
        if run_btn:
            if fac_df is None or mem_df is None or fac_df.empty or mem_df.empty:
                st.error("시설/회원 데이터가 비어 있습니다.")
                return
            fac = prepare_facilities(fac_df)
            mem = prepare_members(mem_df)
            if use_text_weights:
                if {"lat","lon"}.issubset(fac.columns):
                    fac = fac.copy(); fac["lat"], fac["lon"] = np.nan, np.nan
                if {"lat","lon"}.issubset(mem.columns):
                    mem = mem.copy(); mem["lat"], mem["lon"] = np.nan, np.nan
            res, summ = match(fac, mem, topk=int(topk), sample_n=int(sample_n) if sample_n is not None else None,
                              weight_override=weight_override)

            st.write("### 요약 지표")
            met_cols = st.columns(5)
            metrics = {
                "시설 수": int(summ.loc[summ.metric=="num_facilities", "value"].values[0]),
                "회원(전체)": int(summ.loc[summ.metric=="num_members_total", "value"].values[0]),
                "회원(샘플)": int(summ.loc[summ.metric=="num_members_sample", "value"].values[0]),
                "평균 Top1": float(summ.loc[summ.metric=="avg_top1_score", "value"].values[0]),
                "중앙값 Top1": float(summ.loc[summ.metric=="median_top1_score", "value"].values[0]),
            }
            for (label, val), c in zip(metrics.items(), met_cols):
                c.metric(label, f"{val:.4f}" if isinstance(val, float) else f"{val}")

            st.write("### Top-1 점수 분포")
            fig = plt.figure(); res[res["rank"]==1]["score"].hist(bins=20); plt.title("Top-1 매칭 점수 분포 (v0)"); st.pyplot(fig)
            st.write("### 결과 표")
            st.dataframe(res.sort_values(["member_id","rank"]).head(500), use_container_width=True)
            st.download_button("CSV 다운로드", data=res.to_csv(index=False).encode("utf-8-sig"), file_name="batch_match.csv", mime="text/csv")

# =============================
# CLI 진입점
# =============================

def parse_weights_arg(s: Optional[str]) -> Optional[Dict[str, float]]:
    if not s:
        return None
    out: Dict[str, float] = {}
    for pair in s.split(','):
        if '=' not in pair:
            continue
        k, v = pair.split('=', 1)
        try:
            out[k.strip()] = float(v.strip())
        except ValueError:
            pass
    return out or None


def main(argv: Optional[List[str]] = None):
    ap = argparse.ArgumentParser(description="테니스장–회원 매칭 대시보드 v0 (Streamlit 선택/HTML 대체)")
    ap.add_argument("--facilities", default=None, help="시설 데이터 경로 (.xlsx/.csv)")
    ap.add_argument("--members", default=None, help="회원 데이터 경로 (.csv/.xlsx)")
    ap.add_argument("--topk", type=int, default=5, help="회원별 추천 개수")
    ap.add_argument("--sample-n", type=int, default=300, help="앞에서부터 N명만 계산")
    ap.add_argument("--weights", type=str, default=None, help="가중치 오버라이드 예: loc=0.5,price=0.2,time=0.2,amenity=0.05,coach=0.05")
    ap.add_argument("--ui", choices=["auto","streamlit","html"], default="auto", help="UI 모드 선택")
    ap.add_argument("--report-html", default="./match_report_v0.html", help="HTML 대시보드 출력 경로")
    ap.add_argument("--serve", type=int, default=None, help="간이 HTTP 서버 포트(지정 시 HTML 제공)")
    ap.add_argument("--demo", action="store_true", help="데모 데이터 사용")
    ap.add_argument("--run-tests", action="store_true", help="내장 테스트 실행 후 종료")

    args = ap.parse_args(argv)

    if args.run_tests:
        run_unit_tests()
        return

    # 1) UI 모드 결정을 먼저 수행 → Streamlit이면 즉시 앱 실행 (데이터 인자 불필요)
    mode = args.ui
    if mode == "auto":
        mode = "streamlit" if has_streamlit() else "html"

    if mode == "streamlit":
        if not has_streamlit():
            print("[안내] 현재 환경에 streamlit이 없어 HTML 모드로 대체합니다. (--ui html)")
            mode = "html"  # 계속 진행하여 HTML 생성
        else:
            run_streamlit_app()
            return

    # 2) HTML 모드: 여기서부터 데이터 로드 → 매칭 → 리포트 생성
    if args.demo:
        fac_df = _make_demo_facilities()
        mem_df = _make_demo_members()
    else:
        if not args.facilities or not args.members:
            print("[힌트] 실제 데이터를 쓰려면 --facilities 와 --members 를 지정하거나 --demo 를 사용하세요.")
            return
        def _load(path: str) -> pd.DataFrame:
            p = Path(path)
            if not p.exists():
                raise FileNotFoundError(f"파일 없음: {path}")
            if p.suffix.lower() in {".xlsx",".xls"}:
                return pd.read_excel(p)
            return pd.read_csv(p)
        fac_df = _load(args.facilities)
        mem_df = _load(args.members)

    fac = prepare_facilities(fac_df)
    mem = prepare_members(mem_df)

    weights = parse_weights_arg(args.weights)
    res, summ = match(fac, mem, topk=args.topk, sample_n=args.sample_n, weight_override=weights)

    out_html = Path(args.report_html)
    build_html_dashboard(res, summ, out_html)
    print(f"Saved HTML report to: {out_html.resolve()}")

    if args.serve:
        serve_file(out_html, port=int(args.serve))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code == 2:
            print("[힌트] 예: python tennis_dashboard_v0.py --demo --ui html --report-html ./demo_report.html --serve 8501")
        raise
