# auth_setup.py
from playwright.sync_api import sync_playwright

URL = "http://sajang.opentest.kr/member/login?url=http://sajang.opentest.kr/ai/matching"
STATE_FILE = "auth_state.json"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # 눈으로 보고 로그인
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    print("\n[안내] 브라우저에서 정상 로그인해 주세요. (휴대폰/OTP 등 포함)")
    input("[완료 후 Enter]를 누르면 현재 로그인 상태를 저장합니다... ")
    context.storage_state(path=STATE_FILE)
    print(f"[저장 완료] {STATE_FILE}")
    browser.close()