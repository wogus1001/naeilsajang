# measure_matching_100.py  (optimized + multi-signal UI_SRT + optional Server_SRT)
from playwright.sync_api import sync_playwright
import time, csv, os

# -------------------- Config --------------------
N = 100
URL = "http://sajang.opentest.kr/ai/matching"
STATE_FILE = "auth_state.json"
HEADLESS = True

INPUTS = {
    "budgetManwon": "5000",   # 총 예산(만원)
    "minAreaM2": "10",        # 최소 면적(㎡)
    "regionQuery": "화양",     # 지역 검색어
    "minMonthlySales": "10",  # 최소 월 매출(만원)
    "minMonths": "10",        # 최소 운영 기간(개월)
}

# (선택) 매칭 요청을 식별할 수 있는 API URL 일부(네트워크 탭에서 확인). 모르면 빈 문자열 유지.
RESPONSE_SUBSTR = ""   # 예: "/api/matching"

# UI 결과 신호 후보 (레이스; 가장 먼저 보이는 신호로 UI_SRT 종료)
READY_CANDIDATES = [
    "div.match-result", "div.result", "div.list", "ul.list", "div.card",
    "h2:has-text('결과')", "h2:has-text('매칭')",
    "text=추천", "text=결과", "text=매칭", "text=조회", "text=완료",
]
UI_RACE_DEADLINE_MS = 1500   # 최대 대기 (짧게 잡아 타임아웃 대폭 방지)
UI_RACE_STEP_MS = 120

# -------------------- Helpers --------------------
def visible_numeric_inputs(page):
    loc = page.locator("input.t_right[inputmode='numeric']")
    return [loc.nth(i) for i in range(min(loc.count(), 2))]

def click_next(page):
    nxt = page.locator("a.btn.enter:has-text('다음')")
    (nxt if nxt.count() else page.locator(":is(button,a):has-text('다음')")).first.click()

def click_match(page):
    page.locator(":is(button,a):has-text('매칭하기')").first.click()

# -------------------- One iteration --------------------
def run_once(page, i):
    t0 = time.time()

    page.goto(URL, wait_until="domcontentloaded", timeout=20000)
    if "/member/login" in page.url:
        raise RuntimeError("로그인 세션 없음 → 먼저 auth_setup.py 실행")

    # ----- 화면 1: 기본 조건 -----
    inputs = visible_numeric_inputs(page)
    if len(inputs) < 2:
        raise RuntimeError("총예산/최소면적 입력칸(두 개)을 찾지 못했습니다.")
    inputs[0].fill(INPUTS["budgetManwon"])
    inputs[1].fill(INPUTS["minAreaM2"])

    if page.locator('label[for="targetIndustryNone"]').count():
        page.locator('label[for="targetIndustryNone"]').first.click()

    # 지역 검색
    region_any = page.locator('input[placeholder^="동(읍/면)으로 검색해주세요"]')
    if region_any.count():
        region = region_any.first
        try:
            page.evaluate("(el)=>el.removeAttribute('readonly')", region)
        except Exception:
            pass
        region.click()
        region.fill(INPUTS["regionQuery"])
        specific = page.locator("li:has-text('서울 광진구 화양동')")
        target = specific if specific.count() else page.locator("li:has-text('화양')")
        target.first.click(timeout=7000)

    click_next(page)

    # ----- 화면 2: 운영 정보 -----
    inputs2 = visible_numeric_inputs(page)
    if len(inputs2) < 2:
        raise RuntimeError("월매출/운영기간 입력칸(두 개)을 찾지 못했습니다.")
    inputs2[0].fill(INPUTS["minMonthlySales"])
    inputs2[1].fill(INPUTS["minMonths"])
    click_next(page)

    # ----- 화면 3: 거래 조건 -----
    if page.locator('label[for="dateForSale4"]').count():
        page.locator('label[for="dateForSale4"]').first.click()  # 협의 가능
    if page.locator('label[for="safePayment1"]').count():
        page.locator('label[for="safePayment1"]').first.click()  # 안전결제 가능

    # ----- SRT 측정 (레이스) -----
    ui_start = time.perf_counter()
    server_ms = None
    prev_url = page.url

    # (옵션) 서버 응답 시점
    if RESPONSE_SUBSTR:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: RESPONSE_SUBSTR in r.url, timeout=3000):
                click_match(page)
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except Exception:
            click_match(page)
    else:
        click_match(page)

    # UI_SRT: URL 변경 또는 후보 요소 중 가장 빠른 신호로 종료
    def url_changed():
        try:
            return page.url != prev_url
        except Exception:
            return False

    ui_ms, elapsed = None, 0
    while elapsed < UI_RACE_DEADLINE_MS:
        if url_changed():
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        found = False
        for sel in READY_CANDIDATES:
            try:
                if page.locator(sel).first.is_visible():
                    found = True; break
            except Exception:
                pass
        if found:
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        page.wait_for_timeout(UI_RACE_STEP_MS)
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=500)
        except Exception:
            pass

    e2e_ms = int((time.time() - t0) * 1000)
    print(
        f"{i+1}/{N} 회차: E2E={e2e_ms} ms, UI_SRT={ui_ms} ms"
        + (f", Server_SRT={server_ms} ms" if server_ms is not None else "")
    )
    return e2e_ms, ui_ms, server_ms

# -------------------- Main --------------------
if __name__ == "__main__":
    if not os.path.exists(STATE_FILE):
        raise SystemExit("[오류] auth_state.json 없음 → `python auth_setup.py` 먼저 실행")

    with sync_playwright() as p:
        # 브라우저 성능 플래그
        browser = p.chromium.launch(
            headless=HEADLESS,
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

        context = browser.new_context(
            ignore_https_errors=True,
            storage_state=STATE_FILE,
            reduced_motion="reduce",
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1,
        )

        # 리소스 차단(이미지/폰트/비디오/애널리틱스 등)
        block = [
            "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp", "**/*.gif", "**/*.svg",
            "**/*.mp4", "**/*.webm", "**/*.ogg",
            "**/*.woff", "**/*.woff2", "**/*.ttf", "**/*.eot",
            "**/analytics/**", "**/gtag/**", "**/ga.js", "**/collect?**",
            "**/beacon/**", "**/rum/**", "**/hotjar/**",
        ]
        for ptn in block:
            context.route(ptn, lambda route: route.abort())

        page = context.new_page()
        page.set_default_timeout(8000)  # 공격적 타임아웃

        # 애니메이션/트랜지션 제거 + sendBeacon 무력화
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="""
            * { animation: none !important; transition: none !important; }
            html { scroll-behavior: auto !important; }
        """)

        e2e_list, ui_list, sv_list = [], [], []
        for i in range(N):
            try:
                e2e, ui, sv = run_once(page, i)
            except Exception as e:
                print(f"{i+1}/{N} 실패: {e}")
                e2e, ui, sv = 0, 0, None
            e2e_list.append(e2e); ui_list.append(ui); sv_list.append(sv)

        # 요약 (E2E)
        ok = [d for d in e2e_list if d > 0]
        if ok:
            ok.sort()
            p50 = ok[int(0.5*(len(ok)-1))]
            p95 = ok[int(0.95*(len(ok)-1))]
            avg = round(sum(ok)/len(ok))
            print({"n": len(ok), "avg_ms": avg, "p50_ms": p50, "p95_ms": p95, "max_ms": ok[-1]})
        else:
            print("모든 시도 실패")

        # CSV 저장 (E2E, UI_SRT, Server_SRT)
        with open("matching_measure_100.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["iter", "e2e_ms", "ui_srt_ms", "server_srt_ms"])
            for i in range(N):
                w.writerow([i+1, e2e_list[i], ui_list[i], (sv_list[i] if sv_list[i] is not None else "")])

        browser.close()
