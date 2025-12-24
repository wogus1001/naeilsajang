# measure_matching_e2e_persistent.py
# HTTP 환경 + Persistent Context로 E2E(UI_SRT & Server_SRT) 안정 측정
# 사용:
#   1) 최초 1회(로그인 세팅): python measure_matching_e2e_persistent.py --headless false
#      → 브라우저에서 로그인 후 폼 1페이지까지 진입 → 창 닫기
#   2) 측정 실행:             python measure_matching_e2e_persistent.py --runs 10 --headless true

import argparse
import csv
import json
import math
import statistics
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
from playwright.sync_api import sync_playwright

# ===== 고정 설정 =====
DEFAULT_URL   = "http://sajang.opentest.kr/ai/matching"   # HTTP only
DEFAULT_XLSX  = "match_scenarios_10.xlsx"
RUNS          = 10
HEADLESS      = True
TIMEOUT_MS    = 10000
RESPONSE_SUBSTR = "/ai/matching"   # 서버 응답 탐지용 (선택)
UI_RACE_DEADLINE_MS = 2000         # 결과 보임 레이스 상한
UI_RACE_STEP_MS     = 60
BLOCK_STATIC_HEAVY  = True

RESULT_TEXT_CANDIDATES = ["매칭 결과", "매칭점수", "추천", "결과", "조회 완료"]

# 입력(라벨/플레이스홀더/네임 후보)
SEL = {
    "budget": {"labels":["총 예산","예산"], "placeholders":["예산","총 예산"], "names":["budget","totalBudget"]},
    "area":   {"labels":["최소 면적","면적"], "placeholders":["면적"], "names":["area","minArea"]},
    "region": {"labels":["희망 시/군/구","지역","주소"], "placeholders":["시/군/구","지역","검색"], "names":["region","location","regionQuery"]},
    "sales":  {"labels":["최소 월 매출","매출"], "placeholders":["매출","예: 3,000"], "names":["sales","minSales","minMonthlySales"]},
    "months": {"labels":["최소 운영 기간","운영 기간","운영기간"], "placeholders":["운영 기간","예: 10"], "names":["operating_period","operatingMonths","minMonths"]},
}

SCHEDULE_LABELS = {"즉시가능":"즉시가능","협의 가능":"협의 가능"}
ESCROW_LABELS = {True:"안전결제 가능", False:"안전결제 불가능"}

# ===== 유틸 =====
def p95(vals):
    arr = sorted([v for v in vals if v and math.isfinite(v)])
    if not arr: return None
    k = int(round(0.95*(len(arr)-1)))
    return round(arr[k], 2)

def p50(vals):
    arr = [v for v in vals if v and math.isfinite(v)]
    return round(statistics.median(arr), 2) if arr else None

def fill_by_lpn(page, cfg, value):
    # label → placeholder → name
    for t in cfg["labels"]:
        try:
            el = page.get_by_label(t, exact=False)
            if el.count():
                el.first.fill(str(value)); return True
        except: pass
    for t in cfg["placeholders"]:
        try:
            el = page.get_by_placeholder(t)
            if el.count():
                el.first.fill(str(value)); return True
        except: pass
    for n in cfg["names"]:
        try:
            el = page.locator(f"input[name='{n}']")
            if el.count():
                el.first.fill(str(value)); return True
        except: pass
    return False

def fill_any_two_numeric_inputs(page, v1, v2):
    try:
        loc = page.locator("input")
        n = min(loc.count(), 50); picks=[]
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible(): continue
                typ = (el.get_attribute("type") or "").lower()
                im  = (el.get_attribute("inputmode") or "").lower()
                if typ in ("number","tel","text") or im in ("numeric","decimal"):
                    picks.append(el)
                if len(picks) >= 2: break
            except: continue
        if len(picks)>=2:
            picks[0].fill(str(v1)); picks[1].fill(str(v2)); return True
    except: pass
    return False

def dump_buttons(page, tag="btn_dump"):
    try:
        labels = page.eval_on_selector_all(
            "button, a, input[type='submit'], [role='button']",
            "els => els.filter(e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)).map(e=>({tag:e.tagName, txt:(e.innerText||e.value||'').trim()}))"
        )
        print(f"[DEBUG:{tag}] visible buttons/links =>", labels[:80])
    except Exception as e:
        print(f"[DEBUG:{tag}] dump failed:", e)

def click_submit_button(page):
    # 1) 자주 쓰는 CSS/텍스트
    primary = [
        "a.btn.enter", ".btn-primary", "button.primary", "button[type='submit']",
        "input[type='submit']",
        "button:has-text('다음')", "a:has-text('다음')",
        "button:has-text('매칭')", "a:has-text('매칭')",
        "button:has-text('결과')", "a:has-text('결과')",
        "button:has-text('결과 보기')", "a:has-text('결과 보기')",
        "button:has-text('매칭하기')", "a:has-text('매칭하기')",
        "button:has-text('조회')", "a:has-text('조회')",
        "button:has-text('시작')", "a:has-text('시작')",
        # 영어 백업
        "button:has-text('Next')","a:has-text('Next')","button:has-text('Submit')","a:has-text('Submit')",
    ]
    for sel in primary:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click(); return True
        except: continue
    # 2) role=button 훑기
    cand = ["다음","매칭","결과","결과 보기","매칭하기","조회","완료","시작","Next","Submit"]
    try:
        btns = page.get_by_role("button")
        for i in range(min(btns.count(), 60)):
            b = btns.nth(i)
            try:
                if not b.is_visible(): continue
                txt = (b.inner_text() or "").strip()
                if any(c in txt for c in cand):
                    b.click(); return True
            except: continue
    except: pass
    # 3) anchor 훑기
    try:
        anchors = page.locator("a")
        for i in range(min(anchors.count(), 100)):
            a = anchors.nth(i)
            try:
                if not a.is_visible(): continue
                txt = (a.inner_text() or "").strip()
                if any(c in txt for c in cand):
                    a.click(); return True
            except: continue
    except: pass
    # 4) 최후 수단: Enter
    try:
        page.keyboard.press("Enter"); return True
    except: return False

def wait_result_visible(page, timeout_ms):
    deadline = time.time() + timeout_ms/1000.0
    while time.time() < deadline:
        for t in RESULT_TEXT_CANDIDATES:
            try:
                if page.get_by_text(t, exact=False).first.is_visible():
                    return True
            except: continue
        time.sleep(UI_RACE_STEP_MS/1000.0)
    return False

def load_scenarios_from_excel(xlsx_path):
    df = pd.read_excel(xlsx_path)
    out=[]
    for _, r in df.iterrows():
        payload = {
            "budget": int(r.get("budget", 5000)),
            "area": float(r.get("area_m2", 50)),
            "category": str(r.get("category", "상관없음")),
            "region": str(r.get("region", "서울특별시")),
            "sales": int(r.get("sales", 3000)),
            "months": int(r.get("operating_period_month", 12)),
            "schedule": str(r.get("available_schedule","협의 가능")),
            "escrow": bool(r.get("escrow", True)),
        }
        out.append({"name": str(r.get("scenario_name", f"SC{len(out)+1:02d}")), "payload": payload})
    return out

# ===== 1회 측정 (3단계 폼 자동 대응) =====
def run_once(page, url, pl, timeout_ms, resp_substr):
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

    # --- 1페이지: 예산/면적(+지역) ---
    ok1 = fill_by_lpn(page, SEL["budget"], pl["budget"])
    ok2 = fill_by_lpn(page, SEL["area"],   pl["area"])
    if not (ok1 and ok2):
        if not fill_any_two_numeric_inputs(page, pl["budget"], pl["area"]):
            dump_buttons(page, "p1_no_inputs")
            raise RuntimeError("1페이지: 예산/면적 입력칸을 못 찾음")

    # (선택) 지역 입력
    if pl.get("region"):
        if fill_by_lpn(page, SEL["region"], pl["region"]):
            try: page.keyboard.press("Enter")
            except: pass

    if not click_submit_button(page):
        dump_buttons(page, "p1_no_submit")
        raise RuntimeError("1페이지: 제출/다음 버튼을 못 찾음")

    # --- 2페이지: 매출/운영기간 (화면에 있을 때만) ---
    time.sleep(0.1)
    second_has_inputs = page.locator("input").count() >= 2
    if second_has_inputs:
        fill_by_lpn(page, SEL["sales"],  pl["sales"])
        fill_by_lpn(page, SEL["months"], pl["months"])
        # 못 찾으면 무시(사이트마다 2페이지 없을 수 있음)
        click_submit_button(page)  # 다음 페이지로

    # --- 3페이지: 거래조건 (있으면 클릭, 없어도 통과) ---
    try: page.get_by_text(SCHEDULE_LABELS.get(pl["schedule"],"협의 가능"), exact=False).first.click()
    except: pass
    try: page.get_by_text(ESCROW_LABELS.get(pl["escrow"], True), exact=False).first.click()
    except: pass

    # --- 최종 제출 → 결과 대기 (측정 시작) ---
    prev_url = page.url
    ui_start = time.perf_counter()
    server_ms = None

    if not click_submit_button(page):
        dump_buttons(page, "p3_no_submit")
        raise RuntimeError("3페이지: 최종 제출 버튼을 못 찾음")

    if resp_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: resp_substr in r.url, timeout=timeout_ms):
                pass
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except: pass

    # URL 변경 혹은 결과 텍스트 노출까지
    ui_ms, elapsed = None, 0
    while elapsed < UI_RACE_DEADLINE_MS:
        if page.url != prev_url:
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        if wait_result_visible(page, UI_RACE_STEP_MS):
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)

    return ui_ms, server_ms

# ===== 메인 =====
def run(url, xlsx, runs, headless, timeout_ms, resp_substr, block_static_heavy):
    scenarios = load_scenarios_from_excel(xlsx)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rows=[]

    user_dir = Path("user_profile"); user_dir.mkdir(exist_ok=True)
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_dir,
            headless=headless,
            ignore_https_errors=True,
            viewport={"width":1280,"height":720},
            device_scale_factor=1,
            args=[
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-sync",
                "--no-first-run",
                "--disable-background-timer-throttling",
                "--disable-gpu",
                "--metrics-recording-only",
            ],
        )
        if block_static_heavy:
            block = [
                "**/*googleapis*","**/*gstatic*","**/*googletag*","**/*doubleclick*",
                "**/*analytics*","**/*hotjar*","**/*facebook*","**/*cdn*",
                "**/*.png","**/*.jpg","**/*.jpeg","**/*.webp","**/*.gif","**/*.svg",
                "**/*.mp4","**/*.woff","**/*.woff2","**/*.ttf","**/*.eot",
            ]
            for ptn in block:
                context.route(ptn, lambda route: route.abort())

        for sc in scenarios:
            name, pl = sc["name"], sc["payload"]
            measures, servers = [], []

            for i in range(runs):
                page = context.new_page()
                page.set_default_timeout(timeout_ms)
                page.add_init_script("navigator.sendBeacon = () => true")
                page.add_style_tag(content="*{animation:none!important;transition:none!important;} html{scroll-behavior:auto!important;}")

                try:
                    ui_ms, server_ms = run_once(page, url, pl, timeout_ms, resp_substr)
                    measures.append(ui_ms); servers.append(server_ms)
                    print(f"[{name}] {i+1}/{runs}: UI_SRT={ui_ms} ms" + (f", Server_SRT={server_ms} ms" if server_ms else ""))
                except Exception as e:
                    print(f"[{name}] {i+1}/{runs} 실패: {e}")
                    measures.append(math.inf); servers.append(None)
                finally:
                    try: page.close()
                    except: pass

                rows.append({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "scenario": name, "run": i+1,
                    "ui_srt_ms": None if not math.isfinite(measures[-1]) else measures[-1],
                    "server_srt_ms": servers[-1],
                    "payload": json.dumps(pl, ensure_ascii=False)
                })

            valid = [m for m in measures if math.isfinite(m)]
            print(f"[Scenario] {name} - p50={p50(valid)} ms, p95={p95(valid)} ms, max={(max(valid) if valid else None)} ms\n")

        context.close()

    out_csv = f"match_e2e_results_{ts}.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(f"✅ Saved: {out_csv}")

# ===== 엔트리포인트 =====
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--xlsx", default=DEFAULT_XLSX)
    ap.add_argument("--runs", type=int, default=RUNS)
    ap.add_argument("--headless", type=lambda s: s.lower()!="false", default=HEADLESS)
    ap.add_argument("--timeout_ms", type=int, default=TIMEOUT_MS)
    ap.add_argument("--resp", default=RESPONSE_SUBSTR)
    ap.add_argument("--no_block_static", action="store_true")
    args = ap.parse_args()

    run(
        url=args.url,
        xlsx=args.xlsx,
        runs=args.runs,
        headless=args.headless,
        timeout_ms=args.timeout_ms,
        resp_substr=args.resp,
        block_static_heavy=not args.no_block_static
    )
