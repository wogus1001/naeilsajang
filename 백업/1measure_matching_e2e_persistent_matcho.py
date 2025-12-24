# measure_matching_e2e_finalclick.py
# 목적: 모든 인풋(1~3단계) 자동 입력 후, "최종 제출(매칭)" 클릭 ~ 결과 표시까지 시간만 측정
# 사용 예:
#   python measure_matching_e2e_finalclick.py --runs 10 --headless true --resp "/ai/matching"
# 필요: 같은 폴더에 auth_state.json (로그인 세션)

import argparse
import csv
import math
import statistics
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

# -------------------- 기본 설정 --------------------
URL                 = "http://sajang.opentest.kr/ai/matching"  # http 고정
STATE_FILE          = "auth_state.json"                        # 로그인 세션 파일
RUNS_DEFAULT        = 10
HEADLESS_DEFAULT    = True
TIMEOUT_MS_DEFAULT  = 10000

# (선택) 서버 응답 구간도 보고 싶으면 경로 일부 지정 (빈 값이면 미사용)
RESPONSE_SUBSTR_DEFAULT = ""   # 예: "/ai/matching"

# 결과 감지 신호 후보 (URL 변경 또는 아래 텍스트/리스트 등장 시 종료)
RESULT_TEXTS        = ["매칭 결과", "매칭점수", "추천", "결과", "조회 완료"]
RESULT_LIST_CSS     = ["div.match-result", "div.result", "div.list", "ul.list", "div.card"]

# 측정 최대 대기
UI_RACE_DEADLINE_MS = 4000
UI_RACE_STEP_MS     = 80

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
    arr = [v for v in vals if v is not None and math.isfinite(v)]
    return round(statistics.median(arr), 2) if arr else None

def p95(vals):
    arr = sorted([v for v in vals if v is not None and math.isfinite(v)])
    if not arr: return None
    k = int(round(0.95 * (len(arr)-1)))
    return round(arr[k], 2)

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

def _click_first(page, selectors):
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click()
                return True
        except:
            pass
    return False

def _fill_visible_numeric_pair(page, v1, v2):
    """보이는 input 중 type/입력모드가 숫자/텍스트 계열인 첫 2개에 값 입력"""
    try:
        loc = page.locator("input")
        n = min(loc.count(), 50)
        picks = []
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible():
                    continue
                itype = (el.get_attribute("type") or "").lower()
                imode = (el.get_attribute("inputmode") or "").lower()
                if itype in ("number", "tel", "text") or imode in ("numeric", "decimal"):
                    picks.append(el)
                if len(picks) >= 2:
                    break
            except:
                continue
        if len(picks) >= 2:
            picks[0].fill(str(v1))
            picks[1].fill(str(v2))
            return True
    except:
        pass
    return False

def _try_fill_placeholder(page, placeholder, value):
    try:
        el = page.get_by_placeholder(placeholder).first
        if el.count():
            try:
                # 일부 readonly 방지
                page.evaluate("(el)=>el.removeAttribute('readonly')", el)
            except:
                pass
            el.click()
            el.fill(str(value))
            return True
    except:
        pass
    return False

def _select_region_candidate(page, query_text):
    """지역 자동 선택: 특정 후보(li) 우선, 실패 시 Query 포함 항목 선택"""
    try:
        cand_specific = page.locator("li:has-text('서울 광진구 화양동')")
        if cand_specific.count():
            cand_specific.first.click(timeout=7000)
            return True
        cand_any = page.locator(f"li:has-text('{query_text}')")
        if cand_any.count():
            cand_any.first.click(timeout=7000)
            return True
    except:
        pass
    return False

def _dump_buttons(page, tag="debug_buttons"):
    try:
        labels = page.eval_on_selector_all(
            "button, a, [role='button'], input[type='submit']",
            "els => els.filter(e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)).map(e=>({tag:e.tagName, txt:(e.innerText||e.value||'').trim()}))"
        )
        print(f"[DEBUG:{tag}] visible buttons/links => {labels[:80]}")
    except Exception as e:
        print(f"[DEBUG:{tag}] dump failed: {e}")

# -------------------- 폼 작성 ~ 최종버튼 직전까지 --------------------
def prepare_until_final_button(page):
    # 1) 페이지 진입
    page.goto(URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS_DEFAULT)
    if "/member/login" in page.url:
        raise RuntimeError("로그인 필요: auth_state.json을 먼저 준비하세요.")

    # ---- 1단계: 예산/면적 + 지역(선택) ----
    ok = _fill_visible_numeric_pair(page, INPUTS["budgetManwon"], INPUTS["minAreaM2"])
    if not ok:
        _dump_buttons(page, "p1_no_numeric_inputs")
        raise RuntimeError("1단계: 예산/면적 입력칸 자동 인식 실패")

    # 지역(선택)
    if _try_fill_placeholder(page, "동(읍/면)으로 검색해주세요", INPUTS["regionQuery"]):
        _select_region_candidate(page, INPUTS["regionQuery"])

    # 다음(1단계 → 2단계)
    _click_first(page, ["a.btn.enter:has-text('다음')",
                        "button:has-text('다음')", "a:has-text('다음')"])

    # ---- 2단계: 매출/운영기간 (있을 때만) ----
    time.sleep(0.1)
    _fill_visible_numeric_pair(page, INPUTS["minMonthlySales"], INPUTS["minMonths"])
    _click_first(page, ["a.btn.enter:has-text('다음')",
                        "button:has-text('다음')", "a:has-text('다음')"])

    # ---- 3단계: 거래조건 (있으면 클릭) ----
    try: page.get_by_text(INPUTS["availableSchedule"], exact=False).first.click()
    except: pass
    try: page.get_by_text(INPUTS["safePayment"], exact=False).first.click()
    except: pass

    # 최종 제출 버튼 탐색 (강화)
    # 1순위: "매칭" 포함
    for sel in [
        ":is(button,a,[role='button']):has-text('매칭하기')",
        ":is(button,a,[role='button']):has-text('매칭')",
    ]:
        loc = page.locator(sel).first
        if loc.count() and loc.is_visible():
            return loc

    # 백업: '결과','결과 보기','조회','완료','시작'
    for sel in [
        ":is(button,a,[role='button']):has-text('결과 보기')",
        ":is(button,a,[role='button']):has-text('결과')",
        ":is(button,a,[role='button']):has-text('조회')",
        ":is(button,a,[role='button']):has-text('완료')",
        ":is(button,a,[role='button']):has-text('시작')",
        "button[type='submit']", "input[type='submit']",
    ]:
        loc = page.locator(sel).first
        if loc.count() and loc.is_visible():
            return loc

    _dump_buttons(page, "final_no_submit")
    raise RuntimeError("최종 제출(매칭/결과) 버튼을 찾을 수 없습니다.")

# -------------------- 최종 클릭 ~ 결과 표시까지 측정 --------------------
def measure_match_only_once(page, final_button, timeout_ms, resp_substr: str):
    prev_url = page.url
    # Server_SRT(선택)
    server_ms = None

    ui_start = time.perf_counter()
    if resp_substr:
        try:
            with page.expect_response(lambda r: (resp_substr in r.url), timeout=timeout_ms):
                final_button.click()
            # 서버 응답까지 걸린 시간
            server_ms = int((time.perf_counter() - ui_start) * 1000)
        except:
            # 응답 감지 실패 시에도 클릭은 수행됨
            final_button.click()
    else:
        final_button.click()

    # UI_SRT_MATCH: URL 변경/결과 노출까지
    elapsed = 0
    ui_ms = None
    while elapsed < UI_RACE_DEADLINE_MS:
        # URL 변경
        try:
            if page.url != prev_url:
                ui_ms = int((time.perf_counter() - ui_start) * 1000)
                break
        except:
            pass
        # 결과 요소 등장
        if _result_visible(page):
            ui_ms = int((time.perf_counter() - ui_start) * 1000)
            break

        page.wait_for_timeout(UI_RACE_STEP_MS)
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)

    return ui_ms, server_ms

# -------------------- 메인 --------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=RUNS_DEFAULT)
    ap.add_argument("--headless", type=lambda s: s.lower() != "false", default=HEADLESS_DEFAULT)
    ap.add_argument("--timeout_ms", type=int, default=TIMEOUT_MS_DEFAULT)
    ap.add_argument("--resp", default=RESPONSE_SUBSTR_DEFAULT)
    args = ap.parse_args()

    if not Path(STATE_FILE).exists():
        raise SystemExit(f"[오류] {STATE_FILE} 없음 → 먼저 로그인 세션(auth_state.json)을 준비하세요.")

    out_rows = []
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = f"match_only_results_{ts}.csv"

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=args.headless,
            args=[
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-sync",
                "--no-first-run", "--no-default-browser-check",
                "--disable-background-timer-throttling",
                "--disable-gpu",
            ],
        )
        # ✅ auth_state.json 기반 context 생성
        context = browser.new_context(
            storage_state=STATE_FILE,
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1,
        )
        page = context.new_page()
        page.set_default_timeout(args.timeout_ms)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!important;} html{scroll-behavior:auto!important;}")

        ui_list, sv_list = [], []

        for i in range(args.runs):
            try:
                final_btn = prepare_until_final_button(page)  # 모든 입력 완료, 최종 버튼 Locator 반환
                ui_ms, server_ms = measure_match_only_once(page, final_btn, args.timeout_ms, args.resp)
                ui_list.append(ui_ms); sv_list.append(server_ms)
                out_rows.append({"run": i+1, "ui_srt_match_ms": ui_ms, "server_srt_ms": server_ms})
                print(f"[{i+1}/{args.runs}] UI_SRT_MATCH={ui_ms} ms" + (f", Server_SRT={server_ms} ms" if server_ms is not None else ""))
            except Exception as e:
                print(f"[{i+1}/{args.runs}] 실패: {e}")
                ui_list.append(None); sv_list.append(None)
                out_rows.append({"run": i+1, "ui_srt_match_ms": None, "server_srt_ms": None})
                # 다음 반복 대비 새로고침
                try: page.reload()
                except: pass

        # 요약 출력
        valid = [x for x in ui_list if x is not None]
        print("\n[Summary - Final Click → Result]")
        if valid:
            print(f" n={len(valid)}, avg={round(sum(valid)/len(valid),2)} ms, p50={p50(valid)} ms, p95={p95(valid)} ms, max={max(valid)} ms")
        else:
            print(" 유효한 측정값 없음")

        # CSV 저장
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["run", "ui_srt_match_ms", "server_srt_ms"])
            w.writeheader(); w.writerows(out_rows)
        print(f"Saved: {out_csv}")

        context.close()
        browser.close()

if __name__ == "__main__":
    main()
