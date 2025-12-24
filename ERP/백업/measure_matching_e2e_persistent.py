# measure_matching_e2e_persistent.py
# 목적: http만 제공되는 환경에서 세션이 안 풀리도록 Persistent Context(브라우저 프로필) 방식으로 E2E 측정
# 사용 예:
#   1) 최초 1회(로그인 세팅용):  python login_setup_persistent_clean.py  (별도 로그인 스크립트 권장)
#   2) 측정 실행:             python measure_matching_e2e_persistent.py --runs 10 --headless true --timeout_ms 20000
# 옵션:
#   --xlsx match_scenarios_10.xlsx  --resp "/ai/matching"  --timeout_ms 20000  --no_block_static

import argparse, csv, json, math, statistics, time, os
from datetime import datetime
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright

# ===== 고정 설정(HTTP 전용) =====
DEFAULT_URL   = "http://sajang.opentest.kr/ai/matching"   # http만 사용
DEFAULT_XLSX  = "match_scenarios_10_edit.xlsx"
RUNS          = 10
HEADLESS      = True
TIMEOUT_MS    = 10000           # 기본 10초, 서버가 느리면 --timeout_ms 20000 등으로 늘려야 함
RESPONSE_SUBSTR = "/ai/matching"  # 서버 응답 탐지용(선택)
UI_RACE_DEADLINE_MS = 4000
UI_RACE_STEP_MS     = 120
BLOCK_STATIC_HEAVY  = True

# 결과 텍스트 후보 ("매칭된 매장이 없습니다" 추가됨)
RESULT_TEXT_CANDIDATES = ["매칭점수", "매칭 결과", "매칭 정보", "추천", "결과", "조회 완료", "매칭된 매장이 없습니다"]

# 입력 필드 후보(라벨/placeholder/name)
SEL = {
    "budget": {
        "labels":       ["총 예산", "예산", "권리금 포함 예산"],
        "placeholders": ["예산", "총 예산", "예: 5,000"],
        "names":        ["budget", "totalBudget"],
    },
    "area": {
        "labels":       ["최소 면적", "면적"],
        "placeholders": ["면적", "예: 50"],
        "names":        ["area", "minArea"],
    },
    "region": {
        "labels":       ["희망 시/군/구", "지역", "주소"],
        "placeholders": ["시/군/구", "지역", "검색", "동(읍/면)으로 검색해주세요"], # "동(읍/면)" 추가
        "names":        ["region", "location", "regionQuery"],
    },
    "sales": {
        "labels":       ["최소 월 매출", "매출"],
        "placeholders": ["매출", "예: 3,000"],
        "names":        ["sales", "minSales", "minMonthlySales"],
    },
    "operating_months": {
        "labels":       ["최소 운영 기간", "운영 기간", "운영기간"],
        "placeholders": ["운영 기간", "예: 10"],
        "names":        ["operating_period", "operatingMonths", "minMonths"],
    },
}

SCHEDULE_LABELS = {
    "즉시가능": "즉시가능",
    "1~2개월 이내": "1~2개월 이내",
    "3~5개월 이내": "3~5개월 이내",
    "6~8개월 이내": "6~8개월 이내",
    "협의 가능": "협의 가능",
}
ESCROW_LABELS = {True: "안전결제 가능", False: "안전결제 불가능"}

def p95(values):
    vals = sorted([v for v in values if v is not None and math.isfinite(v)])
    if not vals: return None
    k = int(round(0.95 * (len(vals)-1)))
    return round(vals[k], 2)

def p50(values):
    vals = [v for v in values if v is not None and math.isfinite(v)]
    if not vals: return None
    return round(statistics.median(vals), 2)

def shot(page_like, tag):
    try:
        ts = time.strftime("%Y%m%d_%H%M%S")
        page_like.screenshot(path=f"debug_{tag}_{ts}.png", full_page=True)
    except Exception:
        pass

def debug_dump(page_like, tag):
    try:
        title = page_like.title()
    except Exception:
        title = "(no title)"
    try:
        url = page_like.url
    except Exception:
        url = "(no url)"
    print(f"[DEBUG:{tag}] url={url}, title={title}")
    try:
        inputs = page_like.eval_on_selector_all(
            "input, select, textarea",
            "els => els.filter(e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)).slice(0,60).map(e=>({tag:e.tagName, type:e.type, name:e.name, ph:e.placeholder}))"
        )
        print(f"[DEBUG:{tag}] visible form controls =>", inputs)
    except Exception as e:
        print(f"[DEBUG:{tag}] input dump failed:", e)
    shot(page_like, tag)

def wait_ready(page_like, timeout_ms):
    try: page_like.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    except Exception: pass
    try: page_like.wait_for_load_state("networkidle", timeout=timeout_ms//2)
    except Exception: pass

def page_like_find_form_context(page, timeout_ms):
    # 폼이 iframe 안에 있더라도 form 컨트롤 2개 이상 보이는 프레임 선택
    try:
        if page.locator("input, select, textarea").count() >= 2:
            return page
    except Exception:
        pass
    for fr in page.frames:
        try:
            if fr.locator("input, select, textarea").count() >= 2:
                return fr
        except Exception:
            continue
    return page

def fill_by_label_placeholder_name(page_like, labels, placeholders, names, value):
    # (참고: 이 함수는 더 이상 '지역' 필드에 사용되지 않으나, 다른 필드를 위해 유지)
    for t in labels:
        try:
            el = page_like.get_by_label(t, exact=False)
            if el.count(): el.first.fill(str(value)); return True
        except Exception: pass
    for t in placeholders:
        try:
            el = page_like.get_by_placeholder(t)
            if el.count(): el.first.fill(str(value)); return True
        except Exception: pass
    for n in names:
        try:
            el = page_like.locator(f"input[name='{n}']")
            if el.count(): el.first.fill(str(value)); return True
        except Exception: pass
    return False

def fill_any_two_numeric_inputs(page_like, v1, v2):
    try:
        # '신규 스크립트'의 더 정확한 숫자 입력 선택자 적용
        loc = page_like.locator("input.t_right[inputmode='numeric']")
        n = min(loc.count(), 50)
        picks = []
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible(): continue
                picks.append(el)
                if len(picks) >= 2: break
            except Exception:
                continue
        if len(picks) >= 2:
            picks[0].fill(str(v1)); picks[1].fill(str(v2))
            return True
    except Exception:
        pass
    # 위 로직 실패 시 기존 로직으로 재시도
    try:
        loc = page_like.locator("input")
        n = min(loc.count(), 50)
        picks = []
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible(): continue
                typ = (el.get_attribute("type") or "").lower()
                im  = (el.get_attribute("inputmode") or "").lower()
                if typ in ("number","tel","text") or im in ("numeric","decimal"):
                    picks.append(el)
                if len(picks) >= 2: break
            except Exception:
                continue
        if len(picks) >= 2:
            picks[0].fill(str(v1)); picks[1].fill(str(v2))
            return True
    except Exception:
        pass
    return False

def click_submit_button(page_like):
    # '신규 스크립트'의 '다음' 버튼 선택자 (a.btn.enter)를 최우선으로
    primary_css = [
        "a.btn.enter:has-text('다음')", "a.btn.enter",
        ".btn-primary", "button.primary", "button[type='submit']",
        "input[type='submit']",
        "button:has-text('다음')", "a:has-text('다음')",
        "button:has-text('매칭')", "a:has-text('매칭')",
        "button:has-text('결과')", "a:has-text('결과')",
        "button:has-text('조회')", "a:has-text('조회')",
        "button:has-text('시작')", "a:has-text('시작')",
        ":is(button,a):has-text('매칭하기')", # '신규 스크립트'의 '매칭하기'
    ]
    for sel in primary_css:
        try:
            loc = page_like.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click(); return True
        except Exception:
            continue
    # role=button, a 훑기
    candidates = ["다음","매칭","결과","결과 보기","매칭하기","조회","완료","시작","Submit","Next"]
    try:
        btns = page_like.get_by_role("button")
        n = min(btns.count(), 50)
        for i in range(n):
            b = btns.nth(i)
            try:
                if not b.is_visible(): continue
                txt = (b.inner_text() or "").strip()
                if any(c in txt for c in candidates):
                    b.click(); return True
            except Exception:
                continue
    except Exception:
        pass
    try:
        anchors = page_like.locator("a")
        n = min(anchors.count(), 80)
        for i in range(n):
            a = anchors.nth(i)
            try:
                if not a.is_visible(): continue
                txt = (a.inner_text() or "").strip()
                if any(c in txt for c in candidates):
                    a.click(); return True
            except Exception:
                continue
    except Exception:
        pass
    try:
        page_like.keyboard.press("Enter")
        return True
    except Exception:
        return False

def wait_result_visible(page_like, timeout_ms, result_texts):
    deadline = time.time() + timeout_ms/1000.0
    while time.time() < deadline:
        for t in result_texts:
            try:
                if page_like.get_by_text(t, exact=False).first.is_visible():
                    return True
            except Exception:
                continue
        time.sleep(UI_RACE_STEP_MS/1000.0)
    return False

def load_scenarios_from_excel(xlsx_path: str):
    df = pd.read_excel(xlsx_path)
    out = []
    for _, r in df.iterrows():
        if "payload_json" in df.columns and pd.notna(r.get("payload_json")):
            payload = json.loads(r["payload_json"])
        else:
            payload = {
                "budget": int(r.get("budget", 5000)),
                "area": float(r.get("area_m2", 50)),
                "category": str(r.get("category", "상관없음")),
                "region": str(r.get("region", "서울특별시")),
                "sales": int(r.get("sales", 3000)),
                "operating_period": int(r.get("operating_period_month", 12)),
                "available_schedule": str(r.get("available_schedule", "협의 가능")),
                "escrow": bool(r.get("escrow", True)),
            }
        out.append({"name": str(r.get("scenario_name", f"SC{len(out)+1:02d}")), "payload": payload})
    return out

def run_once(page, url, pl, timeout_ms, resp_substr):
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    wait_ready(page, timeout_ms)
    
    if "/member/login" in page.url:
         debug_dump(page, "login_required")
         raise RuntimeError("로그인 세션 없음/만료 → login_setup_persistent_clean.py 재실행 필요")

    # iframe/컨텍스트 선택
    ctx = page_like_find_form_context(page, timeout_ms)
    wait_ready(ctx, timeout_ms)

    # 페이지1
    ok1 = fill_by_label_placeholder_name(ctx, **SEL["budget"], value=pl["budget"])
    ok2 = fill_by_label_placeholder_name(ctx, **SEL["area"], value=pl["area"])
    if not (ok1 and ok2):
        if not fill_any_two_numeric_inputs(ctx, pl["budget"], pl["area"]):
            debug_dump(ctx, "inputs_page1_missing")
            raise RuntimeError("총예산/최소면적 입력칸을 찾지 못했습니다.")

    # 업종 선택 ('신규 스크립트'의 '상관없음' 로직 활용)
    try:
        category = str(pl["category"])
        if category == "상관없음":
            ctx.locator('label[for="targetIndustryNone"]').first.click(timeout=1000)
        else:
            ctx.get_by_text(category, exact=False).first.click()
    except Exception:
        pass # 업종 선택 실패해도 진행

    # ====================================================================
    # ▼▼▼ [수정] '지역 검색' 로직을 '신규 스크립트' 방식으로 변경 ▼▼▼
    region_input = None # 예외 처리용
    try:
        region_value = str(pl["region"]) # 시나리오 값 (예: "화양", "서울특별시")
        region_input = ctx.locator('input[placeholder^="동(읍/면)으로 검색해주세요"]')
        
        if region_input.count() == 0:
            for p in SEL["region"]["placeholders"]:
                loc = ctx.get_by_placeholder(p).first
                if loc.count():
                    region_input = loc; break
        
        if not region_input or region_input.count() == 0:
             raise RuntimeError(f"Region input not found with '{region_value}'")

        region_input = region_input.first

        # readonly 속성 제거 (신규 스크립트 핵심)
        try:
            ctx.evaluate("(el)=>el.removeAttribute('readonly')", region_input)
        except Exception:
            pass # readonly가 없으면 통과
        
        # 클릭 후 값 입력
        region_input.click()
        region_input.fill(region_value)
        
        # 자동완성 목록에서 해당 텍스트 클릭 (신규 스크립트 핵심)
        autocomplete_li = ctx.locator(f'li:has-text("{region_value}")')
        autocomplete_li.first.click(timeout=7000) # 7초 대기

    except Exception as e:
        print(f"[DEBUG] 지역({region_value}) 선택 실패: {e}")
        debug_dump(ctx, "region_fill_fail")
        # 자동완성 실패 시, 그냥 Enter라도 눌러봄
        try: 
            if region_input: region_input.press("Enter")
        except Exception: 
            pass
    # ▲▲▲ [수정] 로직 적용 끝 ▲▲▲
    # ====================================================================

    if not click_submit_button(ctx):
        debug_dump(ctx, "submit_not_found_p1")
        raise RuntimeError("제출(다음/매칭/결과) 버튼(P1)을 찾을 수 없습니다.")

    # 페이지2
    ctx2 = page_like_find_form_context(page, timeout_ms)
    wait_ready(ctx2, timeout_ms)

    ok3 = fill_by_label_placeholder_name(ctx2, **SEL["sales"], value=pl["sales"])
    ok4 = fill_by_label_placeholder_name(ctx2, **SEL["operating_months"], value=pl["operating_period"])
    if not (ok3 and ok4):
        if not fill_any_two_numeric_inputs(ctx2, pl["sales"], pl["operating_period"]):
            debug_dump(ctx2, "inputs_page2_missing")
            raise RuntimeError("월매출/운영기간 입력칸을 찾지 못했습니다.")

    if not click_submit_button(ctx2):
        debug_dump(ctx2, "submit_not_found_p2")
        raise RuntimeError("제출(다음/매칭/결과) 버튼(P2)을 찾을 수 없습니다.")

    # 페이지3
    ctx3 = page_like_find_form_context(page, timeout_ms)
    wait_ready(ctx3, timeout_ms)
    
    # '신규 스크립트'의 label for 방식 적용
    try: 
        schedule_label = SCHEDULE_LABELS.get(pl["available_schedule"], "협의 가능")
        if "협의" in schedule_label:
            ctx3.locator('label[for="dateForSale4"]').first.click(timeout=1000)
        else: # 다른 옵션들은 일단 텍스트 클릭으로 유지
             ctx3.get_by_text(schedule_label, exact=False).first.click()
    except Exception: pass
    
    try: 
        escrow_label = ESCROW_LABELS.get(pl["escrow"], "안전결제 가능")
        if "가능" in escrow_label:
             ctx3.locator('label[for="safePayment1"]').first.click(timeout=1000)
        else: # "불가능"
             ctx3.locator('label[for="safePayment0"]').first.click(timeout=1000)
    except Exception: pass

    prev_url = page.url
    ui_start = time.perf_counter()
    server_ms = None

    if resp_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: resp_substr in r.url, timeout=timeout_ms):
                if not click_submit_button(ctx3):
                    debug_dump(ctx3, "submit_not_found_p3")
                    raise RuntimeError("제출(최종) 버튼을 찾을 수 없습니다.")
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except Exception:
            # expect_response가 타임아웃되어도 UI 측정은 계속하기 위해 클릭을 다시 시도
            if not page.is_closed(): click_submit_button(ctx3)
    else:
        if not click_submit_button(ctx3):
            debug_dump(ctx3, "submit_not_found_p3")
            raise RuntimeError("제출(최종) 버튼을 찾을 수 없습니다.")

    def url_changed():
        try: return page.url != prev_url
        except Exception: return False

    ui_ms, elapsed = None, 0
    while elapsed < UI_RACE_DEADLINE_MS:
        if url_changed():
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        end = min(UI_RACE_STEP_MS, UI_RACE_DEADLINE_MS - elapsed)
        if wait_result_visible(page, end, RESULT_TEXT_CANDIDATES):
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        elapsed += end

    if ui_ms is None:
        try: page.wait_for_load_state("domcontentloaded", timeout=500)
        except Exception: pass
        ui_ms = int((time.perf_counter() - ui_start) * 1000)
        # UI_RACE_DEADLINE (4초) + domcontentloaded (0.5초)가 지나도
        # 서버 응답(server_ms)이 오지 않았다면 UI 시간은 서버 시간으로 대체 (서버 타임아웃 케이스)
        if server_ms is not None and server_ms > ui_ms:
             ui_ms = server_ms

    return ui_ms, server_ms

def run(url, xlsx, runs, headless, timeout_ms, resp_substr, block_static_heavy):
    scenarios = load_scenarios_from_excel(xlsx)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rows = []

    user_dir = Path("user_profile")   # <<<< Persistent Context 저장 위치 (세션 유지 핵심)
    if not user_dir.exists() and headless:
        print(f"[오류] 'user_profile' 폴더가 없습니다. Headless 모드 실행 전 'login_setup_persistent_clean.py'를 먼저 실행해야 합니다.")
        return
    user_dir.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            user_dir,
            headless=headless,
            ignore_https_errors=True,
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1,
            args=[
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-sync",
                "--no-first-run", "--no-default-browser-check",
                "--metrics-recording-only",
                "--disable-features=TranslateUI",
            ],
        )

        # 정적 리소스만 선택 차단
        if block_static_heavy:
            block = [
                "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp", "**/*.gif", "**/*.svg",
                "**/*.mp4", "**/*.webm", "**/*.ogg",
                "**/*.woff", "**/*.woff2", "**/*.ttf", "**/*.eot",
                "**/analytics/**", "**/gtag/**", "**/ga.js", "**/collect?**",
                "**/beacon/**", "**/rum/**", "**/hotjar/**",
            ]
            for ptn in block:
                try:
                    browser.route(ptn, lambda route: route.abort())
                except Exception: pass # 이미 닫힌 컨텍스트 등에 대한 예외 무시

        page = browser.new_page()
        page.set_default_timeout(timeout_ms)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!important;} html{scroll-behavior:auto!important;}")

        # 최초 진입(로그인 확인/유지)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            wait_ready(page, timeout_ms)
            if "/member/login" in page.url:
                 print(f"[경고] 'user_profile'에 세션이 없거나 만료되었습니다. 'login_setup_persistent_clean.py'를 실행하세요.")
                 if headless:
                     browser.close()
                     return
        except Exception as e:
             print(f"최초 페이지 접근 실패: {e}")
             if headless: 
                 browser.close()
                 return

        for sc in scenarios:
            name, pl = sc["name"], sc["payload"]
            measures, servers = [], []

            for i in range(runs):
                try:
                    ui_ms, server_ms = run_once(page, url, pl, timeout_ms, resp_substr)
                    measures.append(ui_ms); servers.append(server_ms)
                    print(f"[{name}] {i+1}/{runs}: UI_SRT={ui_ms} ms" + (f", Server_SRT={server_ms} ms" if server_ms is not None else ""))
                except Exception as e:
                    print(f"[{name}] {i+1}/{runs} 실패: {e}")
                    measures.append(math.inf); servers.append(None)
                    shot(page, f"fail_{name}_{i+1}")
                    # 실패 시 복구를 위해 메인 페이지로 다시 이동
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                        wait_ready(page, timeout_ms)
                    except Exception as re:
                         print(f"[{name}] {i+1}/{runs} 복구 실패: {re}")
                         break # 복구도 안되면 해당 시나리오 중단

                rows.append({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "scenario": name,
                    "run": i+1,
                    "ui_srt_ms": None if not math.isfinite(measures[-1]) else measures[-1],
                    "server_srt_ms": servers[-1],
                    "payload": json.dumps(pl, ensure_ascii=False)
                })

            valid = [m for m in measures if math.isfinite(m)]
            to_cnt = len([m for m in measures if not math.isfinite(m)])
            print(f"[Scenario] {name}")
            print(f" - E2E(UI_SRT) : n={len(valid)}, p50={p50(valid)} ms, p95={p95(valid)} ms, max={(max(valid) if valid else None)} ms")
            print(f" - timeouts: {to_cnt}/{runs}\n")

        browser.close()

    if not rows:
        print("측정된 결과가 없습니다.")
        return

    out_csv = f"match_e2e_results_{ts}.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(f"Saved: {out_csv}")

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