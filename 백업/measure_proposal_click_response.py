# measure_proposal_click_response.py
# 메인 화면 -> '권리금제안' 클릭 -> 폼 페이지 로드 시간 측정
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError
import time, csv, os, statistics

# --- 설정값 ---
# [수정] 시작 URL을 메인 대시보드로 변경
MAIN_URL = "http://sajang.opentest.kr/main" 
STATE_FILE = "auth_state.json"
N = 100
HEADLESS = True
OUTPUT_CSV = "proposal_click_response_results.csv"

# [수정] 클릭할 대상 (메인 화면의 '권리금제안' 박스)
PROPOSAL_BOX_SELECTOR = "a:has-text('권리금제안')" 
# [수정] 클릭 후 기다릴 대상 (다음 페이지의 고유한 제목)
TARGET_PAGE_SELECTOR = "text=매물 정보 입력" 

# -------------------- 한 회차 실행 --------------------
def do_one_run(page: Page) -> int:
    """
    메인 페이지로 이동하여 '권리금제안'을 클릭하고,
    다음 페이지가 로드되기까지의 시간을 측정합니다.
    """
    # 1. 측정을 위해 매번 메인 페이지로 이동
    page.goto(MAIN_URL, wait_until="domcontentloaded", timeout=10000)
    
    # 2. 클릭할 '권리금제안' 버튼이 보일 때까지 대기
    proposal_box = page.locator(PROPOSAL_BOX_SELECTOR).first
    proposal_box.wait_for(state="visible")
    
    # 3. 타이머 시작 (클릭 직전)
    t0 = time.perf_counter()
    
    # 4. '권리금제안' 클릭
    proposal_box.click()
    
    # 5. 다음 페이지(매물 정보 입력)의 제목이 나타날 때까지 대기
    page.locator(TARGET_PAGE_SELECTOR).first.wait_for(state="visible", timeout=10000)
    
    # 6. 타이머 종료
    t1 = time.perf_counter()
    
    e2e_ms = int((t1 - t0) * 1000)
    return e2e_ms

# -------------------- 메인 --------------------
if __name__ == "__main__":
    if not os.path.exists(STATE_FILE):
        raise SystemExit(f"[오류] {STATE_FILE} 없음 -> `python auth_setup.py` 먼저 실행")

    with sync_playwright() as p:
        # 기존의 고속 실행 옵션 및 리소스 차단은 그대로 유지
        browser = p.chromium.launch(
            headless=HEADLESS,
            args=[
                "--disable-dev-shm-usage", "--disable-extensions",
                "--disable-background-networking", "--disable-sync",
                "--no-first-run", "--no-default-browser-check",
                "--metrics-recording-only", "--disable-features=TranslateUI",
            ],
        )
        context = browser.new_context(
            ignore_https_errors=True,
            storage_state=STATE_FILE,
            reduced_motion="reduce",
        )
        
        # 리소스 차단 (속도 향상)
        block = [
            "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp", "**/*.gif", "**/*.svg",
            "**/*.woff", "**/*.woff2", "**/*.ttf", "**/*.eot",
            "**/analytics/**", "**/gtag/**", "**/ga.js", "**/collect?**",
            "**/beacon/**", "**/rum/**", "**/hotjar/**",
        ]
        for ptn in block:
            context.route(ptn, lambda route: route.abort())
            
        page = context.new_page()
        page.set_default_timeout(7000)
        page.add_init_script("navigator.sendBeacon = () => true")
        page.add_style_tag(content="*{animation:none!important;transition:none!importan} html{scroll-behavior:auto!important}")

        e2e_list = []
        print(f"총 {N}회 클릭 응답 속도 측정을 시작합니다...")
        
        for i in range(N):
            try:
                # 첫 실행 시 로그인 페이지 리다이렉트 확인
                if i == 0:
                    page.goto(MAIN_URL, wait_until="domcontentloaded", timeout=10000)
                    if "/member/login" in page.url:
                        raise RuntimeError("LOGIN_REDIRECT")
                
                e2e, = do_one_run(page)
                e2e_list.append(e2e)
                print(f"{i+1}/{N} 회차: E2E={e2e} ms")
                
            except RuntimeError as e:
                if str(e) == "LOGIN_REDIRECT":
                    print(f"{i+1}/{N} 실패: 로그인 세션 없음 → auth_setup.py 재실행 필요")
                    e2e_list.append(0)
                    break # 로그인 실패 시 중단
                else:
                    print(f"{i+1}/{N} 실패: {e}")
                    e2e_list.append(0)
            except Exception as e:
                print(f"{i+1}/{N} 실패: {e}")
                e2e_list.append(0)

        # --- 통계 요약 ---
        ok = [d for d in e2e_list if d > 0]
        if ok:
            ok.sort()
            p50 = ok[int(0.5*(len(ok)-1))]
            p95 = ok[int(0.95*(len(ok)-1))]
            avg = round(sum(ok)/len(ok))
            print("\n--- 🚀 측정 결과 ---")
            print(f"  - n={len(ok)}, avg_ms={avg}, p50_ms={p50}, p95_ms={p95}, max_ms={ok[-1]}")
        else:
            print("모든 시도 실패")

        # --- CSV 저장 ---
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["iter", "e2e_ms"])
            for i in range(len(e2e_list)):
                w.writerow([i+1, e2e_list[i]])
        print(f"\n✅ 전체 결과를 '{OUTPUT_CSV}' 파일에 저장했습니다.")

        try:
            page.close(); context.close(); browser.close()
        except Exception:
            pass