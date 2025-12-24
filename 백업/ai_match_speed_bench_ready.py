# ai_match_speed_bench_ready.py
# 목적: 모든 입력 완료 후 '최종 매칭' 클릭 시점부터 결과 표시까지의 시간만 측정
# 사용:
#   1) 먼저 auth_setup.py 등으로 auth_state.json을 생성해 둡니다.
#   2) python ai_match_speed_bench_ready.py --runs 10 --headless true
import argparse
import csv
import math
import statistics
import time
from datetime import datetime
from pathlib import Path       # ✅ 이 줄 추가
from playwright.sync_api import sync_playwright

from playwright.sync_api import sync_playwright

# -------------------- 기본 설정 --------------------
URL                 = "http://sajang.opentest.kr/ai/matching"  # http 고정
STATE_FILE          = "auth_state.json"                        # 로그인 세션 필수
RUNS                = 10
HEADLESS            = True
TIMEOUT_MS          = 10000

# (선택) 서버 응답 구간도 보고 싶으면 경로 일부 지정 (없으면 빈 문자열)
RESPONSE_SUBSTR     = ""   # 예: "/ai/matching"

# 결과 감지 신호 후보 (URL 변경 또는 아래 텍스트/리스트 등장 시 종료)
RESULT_TEXTS        = ["매칭 결과", "매칭점수", "추천", "결과", "조회 완료"]
RESULT_LIST_CSS     = ["div.match-result", "div.result", "div.list", "ul.list", "div.card"]

# 측정 최대 대기
UI_RACE_DEADLINE_MS = 3000
UI_RACE_STEP_MS     = 60

# -------------------- 입력값 (필요 시 수정) --------------------
INPUTS = {
    # 1단계
    "budgetManwon": "5000",    # 총 예산(만원)
    "minAreaM2": "50",         # 최소 면적(㎡)
    # 지역 검색(있는 경우만 수행)
    "regionQuery": "화양",
    # 2단계
    "minMonthlySales": "3000", # 최소 월 매출(만원)
    "minMonths": "12",         # 최소 운영기간(개월)
    # 3단계(있는 경우만 클릭)
    "availableSchedule": "협의 가능",     # 라디오/라벨 텍스트
    "safePayment": "안전결제 가능",        # 라디오/라벨 텍스트
}

# -------------------- 유틸 --------------------
def p50(vals):
    arr = [v for v in vals if v and math.isfinite(v)]
    return round(statistics.median(arr), 2) if arr else None

def p95(vals):
    arr = sorted([v for v in vals if v and math.isfinite(v)])
    if not arr: return None
    k = int(round(0.95 * (len(arr)-1)))
    return round(arr[k], 2)

def _fill(page, selector, value):
    el = page.locator(selector)
    if el.count() and el.first.is_visible():
        el.first.fill(str(value)); return True
    return False

def _click_first(page, css_list):
    for sel in css_list:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click(); return True
        except:
            pass
    return False

def _result_visible(page):
    # 리스트/카드 보이거나, 결과 텍스트 등장
    for css in RESULT_LIST_CSS:
        try:
            if page.locator(css).first.is_visible():
                return True
        except:
            pass
    for t in RESULT_TEXTS:
        try:
            if page.get_by_text(t, exact=False).first.is_visible():
                return True
        except:
            pass
    return False

# -------------------- 폼 입력 ~ 최종버튼 직전까지 --------------------
def prepare_until_final_button(page):
    # 1) 페이지 진입
    page.goto(URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
    if "/member/login" in page.url:
        raise RuntimeError("로그인 필요: auth_state.json을 먼저 준비하세요.")

    # ---- 1단계: 예산/면적 + 지역(선택) ----
    # 예산/면적: 보이는 숫자 입력 2개에 순차 입력 (UI가 바뀌어도 견고)
    nums = page.locator("input")
    if nums.count() < 2:
        raise RuntimeError("1단계 입력칸(예산/면적) 부족")
    # 가장 먼저 보이는 2개에 채움
    filled = 0
    for i in range(min(nums.count(), 8)):
        el = nums.nth(i)
        try:
            if not el.is_visible(): continue
            itype = (el.get_attribute("type") or "").lower()
            imode = (el.get_attribute("inputmode") or "").lower()
            if itype in ("number","tel","text") or imode in ("numeric","decimal"):
                if filled == 0:
                    el.fill(INPUTS["budgetManwon"]); filled += 1
                elif filled == 1:
                    el.fill(INPUTS["minAreaM2"]); filled += 1; break
        except:
            continue
    if filled < 2:
        raise RuntimeError("1단계 예산/면적 자동입력 실패")

    # 지역(선택)
    try:
        reg = page.get_by_placeholder("동(읍/면)으로 검색해주세요").first
        if reg.count():
            try:
                page.evaluate("(el)=>el.removeAttribute('readonly')", reg)
            except:
                pass
            reg.click()
            reg.fill(INPUTS["regionQuery"])
            cand = page.locator("li:has-text('서울 광진구 화양동')")
            (cand if cand.count() else page.locator("li:has-text('화양')")).first.click(timeout=7000)
    except:
        pass

    # 다음(1단계 → 2단계)
    if not _click_first(page, ["a.btn.enter:has-text('다음')",
                               "button:has-text('다음')", "a:has-text('다음')"]):
        # 일부 화면은 2단계 없이 바로 3단계일 수 있음 → 계속 진행
        pass

    # ---- 2단계: 매출/운영기간 (있을 때만) ----
    time.sleep(0.1)
    inputs2 = page.locator("input")
    if inputs2.count() >= 2:
        # 다시 보이는 숫자 2개에 입력
        filled2 = 0
        for i in range(min(inputs2.count(), 8)):
            el = inputs2.nth(i)
            try:
                if not el.is_visible(): continue
                itype = (el.get_attribute("type") or "").lower()
                imode = (el.get_attribute("inputmode") or "").lower()
                if itype in ("number","tel","text") or imode in ("numeric","decimal"):
                    if filled2 == 0:
                        el.fill(INPUTS["minMonthlySales"]); filled2 += 1
                    elif filled2 == 1:
                        el.fill(INPUTS["minMonths"]); filled2 += 1; break
            except:
                continue
        # 다음(2단계 → 3단계)
        _click_first(page, ["a.btn.enter:has-text('다음')",
                            "button:has-text('다음')", "a:has-text('다음')"])

    # ---- 3단계: 거래조건 (있으면 클릭) ----
    try: page.get_by_text(INPUTS["availableSchedule"], exact=False).first.click()
    except: pass
    try: page.get_by_text(INPUTS["safePayment"], exact=False).first.click()
    except: pass

    # 여기서 멈춘다. (아직 매칭하기 클릭하지 않음)
    # 최종 제출 버튼 후보를 반환해, 측정 구간에서만 클릭하도록 한다.
    final_candidates = [
        "button:has-text('매칭하기')", "a:has-text('매칭하기')",
        "button:has-text('결과')", "a:has-text('결과')",
        "button:has-text('결과 보기')", "a:has-text('결과 보기')",
        "button:has-text('조회')", "a:has-text('조회')",
        "button:has-text('완료')", "a:has-text('완료')",
        "button:has-text('시작')", "a:has-text('시작')",
        # 백업
        "button[type='submit']", "input[type='submit']",
    ]
    for sel in final_candidates:
        loc = page.locator(sel).first
        if loc.count() and loc.is_visible():
            return loc  # 클릭 가능한 최종버튼을 반환

    raise RuntimeError("최종 제출(매칭/결과) 버튼을 찾을 수 없습니다.")

# -------------------- 최종 클릭 ~ 결과 표시까지 측정 --------------------
def measure_match_only_once(page, final_button, resp_substr: str):
    prev_url = page.url
    # Server_SRT(선택) 준비
    server_ms = None
    if resp_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: resp_substr in r.url, timeout=TIMEOUT_MS):
                final_button.click()
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except:
            # 응답 감지 실패 시에도 클릭은 수행
            pass
    else:
        final_button.click()

    # UI_SRT_MATCH: URL 변경/결과 노출까지
    ui_start = time.perf_counter()
    elapsed = 0
    ui_ms = None
    while elapsed < UI_RACE_DEADLINE_MS:
        # URL 변경
        try:
            if page.url != prev_url:
                ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        except:
            pass
        # 결과 요소 등장
        if _result_visible(page):
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        page.wait_for_timeout(UI_RACE_STEP_MS)
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)
    return ui_ms, server_ms

# -------------------- 실행 --------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=RUNS)
    ap.add_argument("--headless", type=lambda s: s.lower() != "false", default=HEADLESS)
    ap.add_argument("--timeout_ms", type=int, default=TIMEOUT_MS)
    ap.add_argument("--resp", default=RESPONSE_SUBSTR)
    args = ap.parse_args()

    if not Path(STATE_FILE).exists():
        raise SystemExit(f"[오류] {STATE_FILE} 없음 → 먼저 로그인 세션을 준비하세요.")

    out = []
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = f"match_only_results_{ts}.csv"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless, args=[
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-sync",
            "--no-first-run", "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-gpu",
        ])
        context = browser.new_context(storage_state=STATE_FILE, viewport={"width":1280,"height":720}, device_scale_factor=1)
        page = context.new_page()
        page.set_default_timeout(args.timeout_ms)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!important;} html{scroll-behavior:auto!important;}")

        # 각 반복: 폼 작성(측정 X) → 최종 버튼 찾음 → 여기서만 측정
        for i in range(args.runs):
            try:
                final_btn = prepare_until_final_button(page)  # 작성 완료, 마지막 버튼 Locator 반환
                ui_ms, server_ms = measure_match_only_once(page, final_btn, args.resp)
                out.append({"run": i+1, "ui_srt_match_ms": ui_ms, "server_srt_ms": server_ms})
                print(f"[{i+1}/{args.runs}] UI_SRT_MATCH={ui_ms} ms" + (f", Server_SRT={server_ms} ms" if server_ms is not None else ""))
            except Exception as e:
                print(f"[{i+1}/{args.runs}] 실패: {e}")
                out.append({"run": i+1, "ui_srt_match_ms": None, "server_srt_ms": None})

        context.close(); browser.close()

    # 요약
    valid = [r["ui_srt_match_ms"] for r in out if r["ui_srt_match_ms"] is not None]
    print("\n[Summary - Final Click → Result]")
    if valid:
        print(f" n={len(valid)}, avg={round(sum(valid)/len(valid),2)} ms, p50={p50(valid)} ms, p95={p95(valid)} ms, max={max(valid)} ms")
    else:
        print(" 유효한 측정값 없음")

    # CSV 저장
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["run", "ui_srt_match_ms", "server_srt_ms"])
        w.writeheader(); w.writerows(out)
    print(f"Saved: {out_csv}")

if __name__ == "__main__":
    main()
