# measure_matching_e2e_persistent_v2.py
# 목적: 내일사장 AI 매칭 E2E 속도측정 (2초 이하 목표 버전)
# 사용:
# 1) 로그인 세팅: python measure_matching_e2e_persistent_v2.py --headless false
#    → 브라우저에서 로그인 후 폼 진입까지 → 창 닫기
# 2) 측정 실행:   python measure_matching_e2e_persistent_v2.py --runs 10 --headless true

import argparse, csv, json, math, statistics, time, os
from datetime import datetime
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright

# =====================================================
# CONFIGURATION
# =====================================================
DEFAULT_URL   = "http://sajang.opentest.kr/ai/matching"  # HTTP only
DEFAULT_XLSX  = "match_scenarios_10.xlsx"
RUNS          = 10
HEADLESS      = True
TIMEOUT_MS    = 8000
RESPONSE_SUBSTR = "/ai/matching"
UI_RACE_DEADLINE_MS = 2000
UI_RACE_STEP_MS     = 60
BLOCK_STATIC_HEAVY  = True

RESULT_TEXT_CANDIDATES = ["매칭 결과", "매칭점수", "추천", "결과", "조회 완료"]

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
}

SCHEDULE_LABELS = {"즉시가능": "즉시가능", "협의 가능": "협의 가능"}
ESCROW_LABELS = {True: "안전결제 가능", False: "안전결제 불가능"}

# =====================================================
# UTILITIES
# =====================================================
def p95(values):
    vals = sorted([v for v in values if v and math.isfinite(v)])
    if not vals: return None
    k = int(round(0.95 * (len(vals)-1)))
    return round(vals[k], 2)

def p50(values):
    vals = [v for v in values if v and math.isfinite(v)]
    return round(statistics.median(vals), 2) if vals else None

def wait_result_visible(page, timeout_ms, result_texts):
    deadline = time.time() + timeout_ms/1000.0
    while time.time() < deadline:
        for t in result_texts:
            try:
                if page.get_by_text(t, exact=False).first.is_visible():
                    return True
            except Exception:
                continue
        time.sleep(UI_RACE_STEP_MS/1000.0)
    return False

def load_scenarios_from_excel(xlsx_path: str):
    df = pd.read_excel(xlsx_path)
    out = []
    for _, r in df.iterrows():
        payload = {
            "budget": int(r.get("budget", 5000)),
            "area": float(r.get("area_m2", 50)),
            "category": str(r.get("category", "상관없음")),
            "region": str(r.get("region", "서울특별시")),
        }
        out.append({"name": str(r.get("scenario_name", f"SC{len(out)+1:02d}")), "payload": payload})
    return out

# =====================================================
# MEASUREMENT CORE
# =====================================================
def run_once(page, url, pl, timeout_ms, resp_substr):
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    try:
        # 입력 필드 자동 탐색 (총예산/면적)
        inputs = page.locator("input")
        if inputs.count() >= 2:
            inputs.nth(0).fill(str(pl["budget"]))
            inputs.nth(1).fill(str(pl["area"]))
        else:
            raise RuntimeError("입력칸 2개를 찾지 못했습니다.")

        # 다음/매칭 버튼 클릭
        page.locator(":is(button,a):has-text('매칭')").first.click()
    except Exception as e:
        raise RuntimeError(f"입력/클릭 실패: {e}")

    prev_url = page.url
    ui_start = time.perf_counter()
    server_ms = None

    if resp_substr:
        server_start = time.perf_counter()
        try:
            with page.expect_response(lambda r: resp_substr in r.url, timeout=timeout_ms):
                pass
            server_ms = int((time.perf_counter() - server_start) * 1000)
        except Exception:
            pass

    ui_ms, elapsed = None, 0
    while elapsed < UI_RACE_DEADLINE_MS:
        if page.url != prev_url:
            ui_ms = int((time.perf_counter() - ui_start) * 1000)
            break
        if wait_result_visible(page, UI_RACE_STEP_MS, RESULT_TEXT_CANDIDATES):
            ui_ms = int((time.perf_counter() - ui_start) * 1000)
            break
        elapsed += UI_RACE_STEP_MS

    if ui_ms is None:
        ui_ms = int((time.perf_counter() - ui_start) * 1000)

    return ui_ms, server_ms

# =====================================================
# MAIN RUN
# =====================================================
def run(url, xlsx, runs, headless, timeout_ms, resp_substr, block_static_heavy):
    scenarios = load_scenarios_from_excel(xlsx)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rows = []
    user_dir = Path("user_profile"); user_dir.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
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
                browser.route(ptn, lambda route: route.abort())

        page = browser.new_page()
        page.set_default_timeout(timeout_ms)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!important;} html{scroll-behavior:auto!important;}")

        for sc in scenarios:
            name, pl = sc["name"], sc["payload"]
            measures, servers = [], []

            for i in range(runs):
                try:
                    ui_ms, server_ms = run_once(page, url, pl, timeout_ms, resp_substr)
                    measures.append(ui_ms); servers.append(server_ms)
                    print(f"[{name}] {i+1}/{runs}: UI_SRT={ui_ms} ms" + (f", Server_SRT={server_ms} ms" if server_ms else ""))
                except Exception as e:
                    print(f"[{name}] {i+1}/{runs} 실패: {e}")
                    measures.append(math.inf); servers.append(None)

                rows.append({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "scenario": name,
                    "run": i+1,
                    "ui_srt_ms": None if not math.isfinite(measures[-1]) else measures[-1],
                    "server_srt_ms": servers[-1],
                    "payload": json.dumps(pl, ensure_ascii=False)
                })

            valid = [m for m in measures if math.isfinite(m)]
            print(f"[Scenario] {name} - p50={p50(valid)}ms, p95={p95(valid)}ms, max={(max(valid) if valid else None)}ms\n")

        browser.close()

    out_csv = f"match_e2e_results_{ts}.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(f"✅ Saved: {out_csv}")

# =====================================================
# ENTRYPOINT
# =====================================================
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
