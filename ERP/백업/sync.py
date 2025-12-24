# measure_auto_match_local.py
import time, pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "https://sajang.opentest.kr/ai"
HEADLESS  = True
RUNS      = 10    # 먼저 소량 테스트 후 200으로 올리세요
WARMUP    = 2
TIMEOUT   = 30000

# ===== 대표님이 주신 선택자 =====
SEL_BUDGET    = '#__next > div > div > div > article > form > dl:nth-child(1) > dd > div > input'
SEL_AREA_MIN  = '#__next > div > div > div > article > form > dl:nth-child(2) > dd > div > input'
SEL_INDUSTRY  = '#__next > div > div > div > article > form > dl:nth-child(3) > dd > div > label:nth-child(30)'  # 업종(커피 등)
SEL_REGION    = '#__next > div > div > div > article > form > dl:nth-child(4) > dd > div > input[type=text]'
SEL_REGION_MODAL_INPUT = '#__next > div > div > div > article > form > dl > dd > div > input[type=text]'          # 모달 내부 검색창
SEL_NEXT_1    = '#__next > div > div > div > div > div > a'  # 1단계 '다음' (페이지 구조상 첫 번째 a 버튼)

# ===== 결과(응답 완료) 판정 후보 =====
RESULT_CANDIDATES = [
    'text=검색결과',  # 지역 모달/결과 화면 공통 텍스트 예시
    'text=추천',      # 추천 문구가 있다면
    '#matchResultList'
]

def now_ms(): return int(time.time()*1000)

def wait_one(page, sels, timeout=TIMEOUT):
    for s in sels:
        try:
            page.wait_for_selector(s, timeout=timeout)
            return
        except PWTimeout:
            continue
    page.wait_for_load_state("domcontentloaded", timeout=timeout)

def reset_home(page):
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=TIMEOUT)
    page.wait_for_selector('a[href="/ai/matching"]', timeout=TIMEOUT)

def run_once(page):
    per = {"home_ms":0,"enter_match_ms":0,"fill_ms":0,"next_ms":0,"total_ms":None,"error":None}
    try:
        # 홈
        t0=now_ms(); reset_home(page); t1=now_ms(); per["home_ms"]=t1-t0

        # 자동매칭 진입
        t0=now_ms()
        page.click('a[href="/ai/matching"]')
        page.wait_for_selector(SEL_BUDGET, timeout=TIMEOUT)  # 폼 로드 보장
        t1=now_ms(); per["enter_match_ms"]=t1-t0

        # 기본조건 입력
        t0=now_ms()
        page.fill(SEL_BUDGET, '5000')
        page.fill(SEL_AREA_MIN, '33')
        page.locator(SEL_INDUSTRY).click()

        # 지역 검색 (입력칸 클릭 → 모달 입력 → 첫 항목 선택)
        page.click(SEL_REGION)
        page.wait_for_selector('text=지역을 검색해주세요', timeout=TIMEOUT)
        page.fill(SEL_REGION_MODAL_INPUT, '방배')
        page.wait_for_selector('text=검색결과', timeout=TIMEOUT)
        # 첫 번째 결과 클릭 (a 링크가 결과 항목이라고 가정)
        page.locator('text=방배').first.click()
        t1=now_ms(); per["fill_ms"]=t1-t0

        # 다음 → 다음화면(응답완료)까지
        t0=now_ms()
        page.locator(SEL_NEXT_1).first.click()
        wait_one(page, RESULT_CANDIDATES, timeout=TIMEOUT)
        t1=now_ms(); per["next_ms"]=t1-t0

        per["total_ms"]=per["home_ms"]+per["enter_match_ms"]+per["fill_ms"]+per["next_ms"]
        return per
    except Exception as e:
        per["error"]=str(e)
        return per

def main():
    rows=[]
    with sync_playwright() as p:
        b=p.chromium.launch(headless=HEADLESS, args=["--disable-cache"])
        c=b.new_context(ignore_https_errors=True, java_script_enabled=True)
        page=c.new_page()

        for _ in range(WARMUP):
            try: run_once(page)
            except: pass

        for i in range(1, RUNS+1):
            r=run_once(page); r["iter"]=i; rows.append(r)
            print(f"[auto_match {i}/{RUNS}] total={r['total_ms']} error={r['error']}")

        b.close()

    df=pd.DataFrame(rows)
    df.to_csv("auto_match_times.csv", index=False, encoding="utf-8-sig")
    v=df.dropna(subset=["total_ms"])
    if len(v)>0:
        summary=v["total_ms"].agg(count="count", avg_ms="mean",
                                  p95_ms=lambda s:s.quantile(0.95),
                                  max_ms="max", min_ms="min")
        pd.DataFrame([summary]).to_csv("auto_match_summary.csv", index=False, encoding="utf-8-sig")
        print("\n=== SUMMARY ===\n", pd.DataFrame([summary]))
    else:
        print("\n유효한 측정이 없습니다. 셀렉터를 확인하세요.")

if __name__=="__main__":
    main()
