# measure_matching_e2e_persistent_finalclick.py
# 목적: Persistent Context 환경에서 모든 인풋 자동 입력 후,
#       "최종 제출(매칭/결과)" 클릭 ~ 결과 표시까지의 구간만 측정

import argparse, csv, json, math, statistics, time, os
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

# ===== 기본 설정 =====
DEFAULT_URL   = "http://sajang.opentest.kr/ai/matching"
RUNS          = 10
HEADLESS      = True
TIMEOUT_MS    = 10000
RESPONSE_SUBSTR = "/ai/matching"
UI_RACE_DEADLINE_MS = 4000
UI_RACE_STEP_MS     = 120

RESULT_TEXT_CANDIDATES = ["매칭점수", "매칭 결과", "추천", "결과", "조회 완료", "매칭된 매장이 없습니다"]

INPUTS = {
    "budget": 5000,
    "area": 50,
    "region": "화양",
    "sales": 3000,
    "months": 12,
    "schedule": "협의 가능",
    "escrow": True,
}

SCHEDULE_LABELS = {"즉시가능":"즉시가능","협의 가능":"협의 가능"}
ESCROW_LABELS = {True:"안전결제 가능", False:"안전결제 불가능"}

# -------------------- 유틸 --------------------
def p50(v): return round(statistics.median(v),2) if v else None
def p95(v): 
    arr=sorted(v)
    return round(arr[int(0.95*(len(arr)-1))],2) if arr else None

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

def click_submit_button(page_like):
    # measure_matching_e2e_persistent.py 의 원본 로직 그대로
    primary_css = [
        "a.btn.enter:has-text('다음')", "a.btn.enter",
        ".btn-primary", "button.primary", "button[type='submit']",
        "input[type='submit']",
        "button:has-text('다음')", "a:has-text('다음')",
        "button:has-text('매칭')", "a:has-text('매칭')",
        "button:has-text('결과')", "a:has-text('결과')",
        "button:has-text('조회')", "a:has-text('조회')",
        "button:has-text('시작')", "a:has-text('시작')",
        ":is(button,a):has-text('매칭하기')",
    ]
    for sel in primary_css:
        try:
            loc = page_like.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click(); return True
        except: continue
    try:
        page_like.keyboard.press("Enter")
        return True
    except: return False

# -------------------- 실행단계 --------------------
def run_once(page, url, timeout_ms, resp_substr):
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    if "/member/login" in page.url:
        raise RuntimeError("로그인 세션 없음. login_setup_persistent_clean.py로 로그인 필요.")

    # === 1단계 ===
    inputs = page.locator("input")
    if inputs.count() < 2:
        raise RuntimeError("입력칸 부족")
    inputs.nth(0).fill(str(INPUTS["budget"]))
    inputs.nth(1).fill(str(INPUTS["area"]))
    # 지역 입력
    try:
        reg = page.get_by_placeholder("동(읍/면)으로 검색해주세요").first
        page.evaluate("(el)=>el.removeAttribute('readonly')", reg)
        reg.click(); reg.fill(INPUTS["region"])
        page.locator(f"li:has-text('{INPUTS['region']}')").first.click(timeout=5000)
    except: pass
    click_submit_button(page)

    # === 2단계 ===
    inputs2 = page.locator("input")
    if inputs2.count() >= 2:
        inputs2.nth(0).fill(str(INPUTS["sales"]))
        inputs2.nth(1).fill(str(INPUTS["months"]))
    click_submit_button(page)

    # === 3단계 (거래조건) ===
    try: page.get_by_text(SCHEDULE_LABELS.get(INPUTS["schedule"],"협의 가능"), exact=False).first.click()
    except: pass
    try: page.get_by_text(ESCROW_LABELS.get(INPUTS["escrow"], True), exact=False).first.click()
    except: pass

    # === [측정 구간 시작] ===
    prev_url = page.url
    ui_start = time.perf_counter()
    server_ms = None

    if resp_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: resp_substr in r.url, timeout=timeout_ms):
                click_submit_button(page)
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except:
            click_submit_button(page)
    else:
        click_submit_button(page)

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

# -------------------- 메인 --------------------
def run(url, runs, headless, timeout_ms, resp_substr):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rows = []
    user_dir = Path("user_profile")
    if not user_dir.exists():
        print("[오류] 'user_profile' 폴더 없음 → login_setup_persistent_clean.py 먼저 실행")
        return

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_dir,
            headless=headless,
            viewport={"width":1280,"height":720},
            device_scale_factor=1,
            ignore_https_errors=True,
            args=[
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-sync",
                "--no-first-run","--no-default-browser-check",
                "--disable-background-networking",
                "--metrics-recording-only",
            ],
        )

        page = context.new_page()
        page.set_default_timeout(timeout_ms)
        page.add_init_script("navigator.sendBeacon = () => true")

        ui_list, sv_list = [], []
        for i in range(runs):
            try:
                ui, sv = run_once(page, url, timeout_ms, resp_substr)
                ui_list.append(ui); sv_list.append(sv)
                print(f"[{i+1}/{runs}] UI_SRT_MATCH={ui} ms" + (f", Server_SRT={sv} ms" if sv else ""))
            except Exception as e:
                print(f"[{i+1}/{runs}] 실패: {e}")
                ui_list.append(None); sv_list.append(None)
                try: page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                except: pass

        valid = [x for x in ui_list if x]
        if valid:
            print(f"\n[요약] n={len(valid)}, avg={round(sum(valid)/len(valid),2)} ms, p50={p50(valid)} ms, p95={p95(valid)} ms, max={max(valid)} ms")

        out_csv = f"match_e2e_finalclick_{ts}.csv"
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            w=csv.writer(f); w.writerow(["iter","ui_match_ms","server_srt_ms"])
            for i in range(runs):
                w.writerow([i+1, ui_list[i], sv_list[i]])
        print(f"CSV 저장 완료 ✅ {out_csv}")

        context.close()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--runs", type=int, default=RUNS)
    ap.add_argument("--headless", type=lambda s: s.lower()!="false", default=HEADLESS)
    ap.add_argument("--timeout_ms", type=int, default=TIMEOUT_MS)
    ap.add_argument("--resp", default=RESPONSE_SUBSTR)
    args = ap.parse_args()

    run(
        url=args.url,
        runs=args.runs,
        headless=args.headless,
        timeout_ms=args.timeout_ms,
        resp_substr=args.resp
    )
