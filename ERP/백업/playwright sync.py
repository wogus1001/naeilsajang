# 예) playwright sync
# pip install playwright; playwright install
from playwright.sync_api import sync_playwright
import time, pandas as pd

def now_ms(): return int(time.time()*1000)

with sync_playwright() as p:
    b = p.chromium.launch(headless=False)
    c = b.new_context()
    page = c.new_page()

    # 0) 진입
    page.goto("https://sajang.opentest.kr/ai", wait_until="networkidle")
    page.click('a[href="/ai/matching"]')  # 자동매칭 진입 (확정된 안정 선택자)

    # 1) 입력
    # 총 예산 (라벨-연결 or placeholder 없을 경우를 대비해 순차 시도)
    try:
        page.getByLabel("총 예산").fill("5000")
    except:
        page.getByPlaceholder("총 예산").fill("5000")  # placeholder가 존재하면
    except:
        page.locator("input").first.fill("5000")       # 최후 fallback

    # 최소 면적
    try:
        page.getByLabel("최소 면적").fill("33")
    except:
        page.getByPlaceholder("최소 면적").fill("33")
    except:
        page.locator("input").nth(1).fill("33")        # 두 번째 인풋 가정 fallback

    # 희망 업종(커피)
    try:
        page.getByRole("button", name="커피").click()
    except:
        page.getByText("커피", exact=True).click()

    # 희망 시/군/구
    page.getByPlaceholder("동(읍/면)으로 검색해주세요").fill("방배동")
    page.keyboard.press("Enter")  # 자동완성 확정

    # 2) 응답시간 측정: [다음] 클릭 → 다음 단계 핵심 요소 등장까지
    start = now_ms()
    page.getByRole("button", name="다음").click()
    page.waitForSelector = page.wait_for_selector  # alias

    # 다음 단계에서 항상 보이는 지표/문구/리스트의 고정 요소로 대기
    page.waitForSelector("text=추천" , timeout=30000)  # 예: “추천 …” 텍스트 등 (화면에 맞게 교체)
    end = now_ms()

    print(f"자동매칭 E2E 응답시간: {(end-start)/1000:.3f}s")
    b.close()