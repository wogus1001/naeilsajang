# measure_proposal_100.py  (final micro-tuned: reuse context + soft reset + JS fast-fill + SRT)
from playwright.sync_api import sync_playwright
import time, csv, os

URL = "http://sajang.opentest.kr/ai/proposal"
STATE_FILE = "auth_state.json"
N = 100
HEADLESS = True

# ---- 입력값 ----
VAL = {
    # 1단계
    "area_m2": "50",
    "deposit_manwon": "5000",
    "rent_manwon": "500",
    "sales_manwon": "5000",
    # 2단계
    "floors": "1",
    "major": "요식업",
    "minor": "한식",
    "brand_personal": True,
    "sido": "서울",
    "sigungu": "종로구",
    # 3단계
    "equip_purchase": "3000",
    "furniture_purchase": "3000",
    "interior_first": "3000",
    "operation_months": "12",
    "first_floor_deposit": "3000",
}

# ---- 결과 감지(Ui SRT) ----
RESPONSE_SUBSTR = ""  # 예: "/api/proposal" (모르면 빈 문자열)
READY_CANDIDATES = [
    "div.result", "div.match-result", "div.card", "div.list", "ul.list",
    "h2:has-text('제안')", "h2:has-text('결과')", "h2:has-text('완료')",
    "text=제안", "text=결과", "text=완료", "text=추천",
]
UI_RACE_DEADLINE_MS = 1000
UI_RACE_STEP_MS = 90

# -------------------- 공통 유틸 --------------------
def fast_fill_numeric(page, values):
    """보이는 numeric inputs를 JS로 한 번에 세팅"""
    page.evaluate(
        """(vals) => {
            const nodes = Array.from(document.querySelectorAll("input.t_right[inputmode='numeric']"));
            const n = Math.min(vals.length, nodes.length);
            for (let i=0; i<n; i++){
              const el = nodes[i]; const v = String(vals[i] ?? "");
              if (el.value === v) continue;
              el.value = v;
              el.dispatchEvent(new Event('input', {bubbles:true}));
              el.dispatchEvent(new Event('change', {bubbles:true}));
            }
            return n;
        }""",
        values,
    )

def click_next(page):
    btn = page.locator("a.btn.enter:has-text('다음'), :is(a,button):has-text('다음')").first
    btn.wait_for(state="visible", timeout=2500)
    btn.click()

def wait_ok_button(page):
    ok_btn = page.locator("button.btn.btn_search:has-text('확인')").first
    ok_btn.wait_for(state="visible", timeout=6000)
    return ok_btn

def get_category_containers(page):
    wrap = page.locator("div.list_search_wrap").first
    wrap.wait_for(state="visible", timeout=6000)
    left  = wrap.locator("div.list_search_subject").first
    right = wrap.locator("div.list_search_item").first
    return left, right

def scroll_pick(loc, text, is_label=False, tries=18, step=260):
    page = loc.page
    if is_label:
        loc.locator("label[for^='sub-item-']").first.wait_for(state="visible", timeout=6000)
    target = loc.locator(f":is(button,label,li,a,div,span):has-text('{text}')").first
    for _ in range(tries):
        if target.count() and target.is_visible():
            target.click(); return True
        loc.evaluate(f"(el)=>{{ el.scrollTop = (el.scrollTop||0) + {step}; }}")
        page.wait_for_timeout(70)
    return False

# -------------------- 화면별 액션 --------------------
def open_and_pick_category(page, major_text, minor_text):
    page.locator("a.btn_cate:has-text('대분류')").first.click()
    ok_btn = wait_ok_button(page)
    left, right = get_category_containers(page)
    if not scroll_pick(left, major_text, is_label=False):
        raise RuntimeError(f"대분류 '{major_text}'을(를) 찾지 못했습니다.")
    if not scroll_pick(right, minor_text, is_label=True):
        raise RuntimeError(f"소분류 '{minor_text}'을(를) 찾지 못했습니다.")
    ok_btn.click()

def open_region_panel_for_sido(page):
    btns = page.locator("a.btn_cate")
    cand = btns.filter(has_text="시/도")
    if cand.count() and cand.first.is_visible():
        cand.first.click(); return
    if btns.count() >= 1:
        btns.nth(0).click(); return
    raise RuntimeError("[sido] 버튼을 찾지 못했습니다.")

def ensure_panel_open(page):
    ok_btn = wait_ok_button(page)
    left, right = get_category_containers(page)
    return ok_btn, left, right

def pick_region_sido(page, sido_text):
    open_region_panel_for_sido(page)
    ok_btn, left, _ = ensure_panel_open(page)
    if not scroll_pick(left, sido_text, is_label=False):
        raise RuntimeError(f"[sido] '{sido_text}' 항목을 찾지 못했습니다.")
    ok_btn.click()

def pick_region_sigungu(page, sigungu_text):
    btns = page.locator("a.btn_cate")
    if btns.filter(has_text="시/군/구").count():
        btns.filter(has_text="시/군/구").first.click()
    else:
        if not page.locator("div.list_search_wrap").first.is_visible() and btns.count():
            btns.nth(0).click()
    ok_btn, _, right = ensure_panel_open(page)
    if not scroll_pick(right, sigungu_text, is_label=True):
        raise RuntimeError(f"[sigungu] '{sigungu_text}' 항목을 찾지 못했습니다.")
    ok_btn.click()

# ---- UI SRT 측정 보조 ----
def ui_srt_after_click(page, click_callable, response_substr="", candidates=None):
    ui_start = time.perf_counter()
    server_ms = None
    prev_url = page.url
    candidates = candidates or READY_CANDIDATES

    if response_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: response_substr in r.url, timeout=2500):
                click_callable()
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except Exception:
            click_callable()
    else:
        click_callable()

    def url_changed():
        try: return page.url != prev_url
        except Exception: return False

    ui_ms, elapsed = None, 0
    while elapsed < UI_RACE_DEADLINE_MS:
        if url_changed():
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        hit = False
        for sel in candidates:
            try:
                if page.locator(sel).first.is_visible():
                    hit = True; break
            except Exception:
                pass
        if hit:
            ui_ms = int((time.perf_counter() - ui_start) * 1000); break
        page.wait_for_timeout(UI_RACE_STEP_MS)
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)
        try: page.wait_for_load_state("domcontentloaded", timeout=350)
        except Exception: pass
    return ui_ms, server_ms

# ---- 소프트 리셋 ----
def soft_reset_to_step1(page):
    for sel in [
        ":is(a,button,span):has-text('다시')",
        ":is(a,button,span):has-text('처음')",
        ":is(a,button,span):has-text('초기화')",
        ":is(a,button,span):has-text('검색')",
        ":is(a,button,span):has-text('재시작')",
    ]:
        el = page.locator(sel)
        if el.count() and el.first.is_visible():
            try:
                el.first.click()
                page.locator("input.t_right[inputmode='numeric']").nth(3).wait_for(state="visible", timeout=1200)
                return True
            except Exception:
                pass
    for _ in range(3):
        try:
            page.go_back(wait_until="domcontentloaded", timeout=1200)
            if page.locator("a.btn.enter:has-text('다음')").count():
                return True
        except Exception:
            pass
    return False

# -------------------- 한 회 실행 --------------------
def do_flow(page, first_iter=False):
    t0 = time.time()
    if first_iter or page.url.rstrip("/") != URL.rstrip("/"):
        page.goto(URL, wait_until="domcontentloaded", timeout=10000)
    if "/member/login" in page.url:
        raise RuntimeError("LOGIN_REDIRECT")

    # 1단계
    fast_fill_numeric(page, [VAL["area_m2"], VAL["deposit_manwon"], VAL["rent_manwon"], VAL["sales_manwon"]])
    click_next(page)

    # 2단계
    fast_fill_numeric(page, [VAL["floors"]])
    open_and_pick_category(page, VAL["major"], VAL["minor"])
    if VAL["brand_personal"]:
        page.locator('label[for="brandStatus1"]').first.click()
    pick_region_sido(page, VAL["sido"])
    pick_region_sigungu(page, VAL["sigungu"])
    click_next(page)

    # 3단계
    fast_fill_numeric(page, [
        VAL["equip_purchase"], VAL["furniture_purchase"], VAL["interior_first"],
        VAL["operation_months"], VAL["first_floor_deposit"],
    ])

    ui_ms, server_ms = ui_srt_after_click(
        page,
        lambda: page.locator(":is(button,a,span):has-text('권리금 제안받기')").first.click(),
        response_substr=RESPONSE_SUBSTR,
        candidates=READY_CANDIDATES,
    )

    e2e_ms = int((time.time() - t0) * 1000)

    if not soft_reset_to_step1(page):
        page.goto(URL, wait_until="domcontentloaded", timeout=6000)

    return e2e_ms, ui_ms, server_ms

# -------------------- 메인 --------------------
if __name__ == "__main__":
    if not os.path.exists(STATE_FILE):
        raise SystemExit("[오류] auth_state.json 없음 → `python auth_setup.py` 먼저 실행")

    with sync_playwright() as p:
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
                # 아래 2~3개는 테스트 환경에서만 시도(불안정할 수 있음)
                # "--disable-gpu", "--disable-renderer-backgrounding",
                # "--disable-background-timer-throttling",
            ],
        )

        def new_context_and_page():
            ctx = browser.new_context(
                ignore_https_errors=True,
                storage_state=STATE_FILE,
                reduced_motion="reduce",
                viewport={"width": 1280, "height": 720},
                device_scale_factor=1,
            )
            # 리소스 차단
            block = [
                "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp", "**/*.gif", "**/*.svg",
                "**/*.mp4", "**/*.webm", "**/*.ogg",
                "**/*.woff", "**/*.woff2", "**/*.ttf", "**/*.eot",
                "**/analytics/**", "**/gtag/**", "**/ga.js", "**/collect?**",
                "**/beacon/**", "**/rum/**", "**/hotjar/**",
            ]
            for ptn in block:
                ctx.route(ptn, lambda route: route.abort())
            pg = ctx.new_page()
            pg.set_default_timeout(7000)
            pg.add_init_script("navigator.sendBeacon = () => true")
            pg.add_style_tag(content="*{animation:none!important;transition:none!important} html{scroll-behavior:auto!important}")
            return ctx, pg

        context, page = new_context_and_page()

        e2e_list, ui_list, sv_list = [], [], []
        for i in range(N):
            try:
                e2e, ui, sv = do_flow(page, first_iter=(i == 0))
            except RuntimeError as e:
                if str(e) == "LOGIN_REDIRECT":
                    try: page.close(); context.close()
                    except Exception: pass
                    context, page = new_context_and_page()
                    try:
                        e2e, ui, sv = do_flow(page, first_iter=True)
                    except Exception as e2:
                        print(f"{i+1}/{N} 실패: 로그인 세션 없음 → auth_setup.py 재실행 필요")
                        e2e, ui, sv = 0, 0, None
                else:
                    print(f"{i+1}/{N} 실패: {e}")
                    e2e, ui, sv = 0, 0, None

            print(f"{i+1}/{N} 회차: E2E={e2e} ms, UI_SRT={ui} ms" + (f", Server_SRT={sv} ms" if sv is not None else ""))
            e2e_list.append(e2e); ui_list.append(ui); sv_list.append(sv)

        ok = [d for d in e2e_list if d > 0]
        if ok:
            ok.sort()
            p50 = ok[int(0.5*(len(ok)-1))]
            p95 = ok[int(0.95*(len(ok)-1))]
            avg = round(sum(ok)/len(ok))
            print({"n": len(ok), "avg_ms": avg, "p50_ms": p50, "p95_ms": p95, "max_ms": ok[-1]})
        else:
            print("모든 시도 실패")

        with open("proposal_measure_100.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["iter", "e2e_ms", "ui_srt_ms", "server_srt_ms"])
            for i in range(N):
                w.writerow([i+1, e2e_list[i], ui_list[i], (sv_list[i] if sv_list[i] is not None else "")])

        try:
            page.close(); context.close(); browser.close()
        except Exception:
            pass
