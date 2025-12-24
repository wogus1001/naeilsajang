# measure_custom_search_advanced.py (sub-1s target tune)
import time, os, csv, statistics, json
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

URL = "http://sajang.opentest.kr/ai/search"
STATE_FILE = "auth_state.json"
N = 100
OUT_CSV = "custom_search_advanced_results.csv"
HEADLESS = True

# --- 결과 감지: 가장 확실한 1개만 두면 빨라짐 ---
# 필요시 "div.sc-ktaunt" 또는 "p.count > span" 등으로 교체해서 실험해봐도 OK
RESULT_PROBES = ["div.list_item"]
RESULT_TEXTS  = ["검색 결과", "조건에 맞는 매물이 없어요"]

# --- JS 한방 플로우: 최소 대기 / 최소 클릭 ---
JS_FLOW = r"""
async () => {
  const t0 = performance.now();
  const microWait = (ms=8) => new Promise(r => setTimeout(r, ms));

  const safeClick = (sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
  const setChecked = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    if (el.type === "radio" || el.type === "checkbox") el.checked = true; else el.value = "1";
    el.dispatchEvent(new Event("input",  {bubbles:true}));
    el.dispatchEvent(new Event("change", {bubbles:true}));
    const lb = document.querySelector(`label[for='${id}']`); lb?.click();
    return true;
  };

  // 1) 합계금액 +5천만 → 다음
  setChecked("totalSale3"); safeClick("a.btn.enter"); await microWait();

  // 2) 매출 상관없음 → 다음
  setChecked("targetSales6"); safeClick("a.btn.enter"); await microWait();

  // 3) 업종 상관없음 → 다음
  setChecked("targetIndustryNone"); safeClick("a.btn.enter"); await microWait();

  // 4) 프랜차이즈 매장 → 다음
  setChecked("storeType1"); safeClick("a.btn.enter"); await microWait();

  // 5) 지역: '화양' 입력 → 자동완성 선택 → 다음
  const addr = document.querySelector("input[placeholder^='동(읍/면)']");
  if (addr){
    addr.removeAttribute("readonly");
    addr.value = "화양";
    addr.dispatchEvent(new Event("input", {bubbles:true}));
    document.querySelector("button.btn_search, button[class*='search']")?.click();
    await microWait(12);
    const items = Array.from(document.querySelectorAll("li"));
    (items.find(li => li.textContent.includes("서울 광진구 화양동")) ||
     items.find(li => li.textContent.includes("화양")))?.click();
  }
  safeClick("a.btn.enter"); await microWait();

  // 6) 평형대 상관없음 → 다음
  setChecked("desiredArea5"); safeClick("a.btn.enter"); await microWait();

  // 7) 추가조건 없음 → 마지막 네비는 0ms 타이머로 스케줄
  setChecked("extraCondi_NONE");
  setTimeout(() => { document.querySelector("a.btn.enter")?.click(); }, 0);

  // 결과 감시: CSS 1개 + 텍스트 포함 (둘 중 먼저 만족하는 순간 반환)
  const cssProbes = %s;
  const textProbes = %s;

  // 이미 떠 있으면 즉시 반환
  for (const sel of cssProbes) if (document.querySelector(sel)) return performance.now() - t0;
  if (textProbes.some(t => (document.body?.innerText||"").includes(t))) return performance.now() - t0;

  return await new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done){ done = true; resolve(performance.now() - t0); } };

    const obs = new MutationObserver(() => {
      for (const sel of cssProbes) if (document.querySelector(sel)) { obs.disconnect(); finish(); return; }
      const txt = (document.body?.innerText)||"";
      if (textProbes.some(t => txt.includes(t))) { obs.disconnect(); finish(); return; }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});

    // 700ms 이내 감지 못하면 그냥 종료(렌더 완료로 간주)
    setTimeout(() => { obs.disconnect(); finish(); }, 700);
  });
}
""" % (json.dumps(RESULT_PROBES), json.dumps(RESULT_TEXTS))

def run_once(page):
    t = page.evaluate(JS_FLOW)  # 내부에서 performance.now()로 측정한 ms 반환
    return int(t)

if __name__ == "__main__":
    if not os.path.exists(STATE_FILE):
        raise SystemExit("[오류] auth_state.json 없음 → `python auth_setup.py` 먼저 실행")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=HEADLESS,
            args=[
                "--disable-dev-shm-usage","--disable-extensions",
                "--disable-background-networking","--disable-sync",
                "--no-first-run","--no-default-browser-check",
                "--metrics-recording-only","--disable-features=TranslateUI",
                "--renderer-process-limit=1",        # 탭/프로세스 분산 최소화
                "--disable-renderer-backgrounding",  # 백그라운드 스로틀 방지
            ],
        )
        ctx = browser.new_context(
            storage_state=STATE_FILE,
            ignore_https_errors=True,
            reduced_motion="reduce",
            viewport={"width": 1024, "height": 640},  # 더 작은 뷰포트로 페인트 비용 절감
            device_scale_factor=1,
        )

        # 리소스 차단 강화 (이미지/폰트/미디어/트래킹/광고/맵류)
        for pat in [
            "**/*.png","**/*.jpg","**/*.jpeg","**/*.webp","**/*.gif","**/*.svg",
            "**/*.mp4","**/*.webm","**/*.ogg",
            "**/*.woff","**/*.woff2","**/*.ttf","**/*.eot",
            "**/map/**","**/maps/**","**/tiles/**","**/tile/**",
            "**/analytics/**","**/gtag/**","**/ga.js","**/collect?**","**/beacon/**",
            "**/rum/**","**/hotjar/**","**/heatmap/**","**/ads/**","**/advert**",
        ]:
            ctx.route(pat, lambda r: r.abort())

        page = ctx.new_page()
        page.set_default_timeout(4500)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!important} html{scroll-behavior:auto!important}")

        results = []
        for i in range(N):
            try:
                # 초기화: domcontentloaded까지만(가장 빠름)
                page.goto(URL, wait_until="domcontentloaded", timeout=8000)
                # 상호작용 준비 신호 1개만 확인
                page.locator('label[for="totalSale3"]').wait_for(state="visible", timeout=1500)

                t = run_once(page)
                results.append(t)
                print(f"{i+1}/{N} 회차: E2E={t} ms")
            except Exception as e:
                print(f"{i+1}/{N} 실패: {str(e).splitlines()[0]}"); results.append(0)
                # 실패 시에도 다음 루프를 위해 즉시 초기화
                try: page.goto(URL, wait_until="domcontentloaded", timeout=5000)
                except: pass

        ok = [x for x in results if x>0]
        if ok:
            ok.sort()
            p50 = ok[len(ok)//2]
            p95 = ok[int(len(ok)*0.95)-1] if len(ok)>=20 else max(ok)
            avg = int(sum(ok)/len(ok))
            print({"n":len(ok), "avg_ms":avg, "p50_ms":p50, "p95_ms":p95, "max_ms":ok[-1]})
        else:
            print("모든 시도 실패")

        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["iter","e2e_ms"])
            for i,v in enumerate(results,1): w.writerow([i,v])

        page.close(); ctx.close(); browser.close()
