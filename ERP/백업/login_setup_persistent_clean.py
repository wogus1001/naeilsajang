# login_setup_persistent_clean.py
from playwright.sync_api import sync_playwright

URL = "http://sajang.opentest.kr/ai/matching"  # http 고정

if __name__ == "__main__":
    with sync_playwright() as p:
        # ⚠️ 성능 플래그/리소스 차단/초기 스크립트 전혀 없음 (로그인 안정화 목적)
        browser = p.chromium.launch_persistent_context(
            "user_profile",       # 세션이 저장될 프로필 폴더
            headless=False,       # 창 띄워서 직접 로그인
            viewport={"width": 1280, "height": 800},
        )
        page = browser.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=30000)

        print("\n[알림] 브라우저 창에서 로그인 후, '매칭 입력 폼 첫 화면'까지 진입하세요.")
        input("완료되면 여기 터미널에 엔터를 눌러 창을 닫습니다...")

        browser.close()
        print("✅ 로그인 세션이 user_profile/ 에 저장되었습니다.")
