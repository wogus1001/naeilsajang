# -*- coding: utf-8 -*-
"""
내일사장 - 자동매칭 E2E 응답시간 측정 (HTTP 버전 / Playwright)
- 홈(http) → 자동매칭 진입 → 기본조건 입력 → [다음] → 다음 단계 도착까지
- 회차별 로그: auto_match_times.csv
- 요약 통계: auto_match_summary.csv

사전 준비:
  pip install playwright pandas
  python -m playwright install

실행:
  python measure_auto_match_http.py
"""

import time
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Any
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# =========================
# 설정
# =========================
BASE_URL = "http://sajang.opentest.kr/ai"   # ← HTTPS(443) 이슈로 HTTP 사용
HEADLESS  = True
RUNS      = 10      # 먼저 소량 테스트 후 200으로 올리세요
WARMUP    = 2
TIMEOUT   = 30000   # ms

OUT_DETAIL = "auto_match_times.csv"
OUT_SUMMARY = "auto_match_summary.csv"

# =========================
# 대표님이 주신 선택자 (1단계)
# =========================
SEL_BUDGET    = '#__next > div > div > div > article > form > dl:nth-child(1) > dd > div > input'
SEL_AREA_MIN  = '#__next > div > div > div > article > form > dl:nth-child(2) > dd > div > input'
SEL_INDUSTRY  = '#__next > div > div > div > article > form > dl:nth-child(3) > dd > div > label:nth-child(30)'  # 업종(예: 커피)
SEL_REGION    = '#__next > div > div > div > article > form > dl:nth-child(4) > dd > div > input[type=text]'
SEL_REGION_MODAL_INPUT = '#__next > div > div > div > article > form > dl > dd > div > input[type=text]'          # 지역 모달 내부 검색창
SEL_NEXT_1    = '#__next > div > div > div > div > div > a'  # 1단계 '다음' (해당 레이아웃의 첫 a버튼)

# 결과(응답 완료) 판정 후보 - 화면 고정 요소/텍스트로 교체 가능
RESULT_CANDIDATES: List[str] = [
    'text=검색결과',     # 텍스트 예시
    'text=추천',        # 텍스트 예시
    '#matchResultList'  # 고정 ID가 있다면 가장 좋음
]

# =========================
# 유틸
# =========================
def now_ms() -> int:
    return int(time.time() * 1000)

def wait_one(page, candidates: List[str], timeout: int = TIMEOUT):
    """후보 셀렉터/텍스트 중 하나가 보일 때까지 대기"""
    for sel in candidates:
        try:
            page.wait_for_selector(sel, timeout=timeout)
            return
        except PWTimeout:
            continue
    # 마지막 방어
    page.wait_for_load_state("domcontentloaded", timeout=timeout)

def reset_home(page):
    """
    HTTP로 이동 + 고정 요소 대기 + 3회 재시도
    networkidle 대신 domcontentloaded + 앵커 존재 확인으로 안정화
    """
    page.set_default_timeout(TIMEOUT)
    page.set_default_navigation_timeout(TIMEOUT)
    for i in range(3):
        try:
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=TIMEOUT)
            page.wait_for_selector('a[href="/ai/matching"]', timeout=TIMEOUT)
            return
        except Exception:
            if i == 2:
                raise
            time.sleep(2 * (i + 1))  # 2s, 4s backoff

# =========================
# 1회 측정 (자동매칭)
# =========================
def run_once(page) -> Dict[str, Optional[int]]:
    """
    반환: {total_ms, home_ms, enter_match_ms, fill_ms, next_ms, error}
    실패 시 total_ms=None + error 메시지 포함
    """
    per: Dict[str, Optional[int]] = {
        "home_ms": None,
        "enter_match_ms": None,
        "fill_ms": None,
        "next_ms": None,
        "total_ms": None,
        "error": None,
    }

    try:
        # 0) 홈
        t0 = now_ms()
        reset_home(page)
        t1 = now_ms()
        per["home_ms"] = t1 - t0

        # 1) 자동매칭 진입
        t0 = now_ms()
        page.click('a[href="/ai/matching"]')
        page.wait_for_selector(SEL_BUDGET, timeout=TIMEOUT)  # 폼 로드 보장
        t1 = now_ms()
        per["enter_match_ms"] = t1 - t0

        # 2) 기본조건 입력
        t0 = now_ms()
        # 총 예산 / 최소 면적
        page.fill(SEL_BUDGET, '5000')
        page.fill(SEL_AREA_MIN, '33')

        # 업종(커피 등)
        page.locator(SEL_INDUSTRY).click()

        # 지역 검색: 입력칸 클릭 → 모달 열림 → 검색 → 결과 선택
        page.click(SEL_REGION)
        page.wait_for_selector('text=지역을 검색해주세요', timeout=TIMEOUT)
        page.fill(SEL_REGION_MODAL_INPUT, '방배')
        page.wait_for_selector('text=검색결과', timeout=TIMEOUT)
        page.locator('text=방배').first.click()  # 첫 결과 클릭(필요 시 더 구체화)
        t1 = now_ms()
        per["fill_ms"] = t1 - t0

        # 3) [다음] → 다음 화면(응답 완료) 판정
        t0 = now_ms()
        page.locator(SEL_NEXT_1).first.click()
        wait_one(page, RESULT_CANDIDATES, timeout=TIMEOUT)
        t1 = now_ms()
        per["next_ms"] = t1 - t0

        per["total_ms"] = per["home_ms"] + per["enter_match_ms"] + per["fill_ms"] + per["next_ms"]
        return per

    except Exception as e:
        per["error"] = str(e)
        return per

# =========================
# 메인
# =========================
def main():
    rows: List[Dict[str, Any]] = []
    Path(".").mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, args=["--disable-cache"])
        context = browser.new_context(ignore_https_errors=True, java_script_enabled=True)
        page = context.new_page()

        # 워밍업
        for _ in range(WARMUP):
            try:
                run_once(page)
            except Exception:
                pass

        # 본 측정
        for i in range(1, RUNS + 1):
            r = run_once(page)
            r["iter"] = i
            rows.append(r)
            print(f"[auto_match {i}/{RUNS}] total={r['total_ms']} ms  error={r['error']}")

        browser.close()

    # 저장
    df = pd.DataFrame(rows)
    df.to_csv(OUT_DETAIL, index=False, encoding="utf-8-sig")

    valid = df.dropna(subset=["total_ms"])
    if len(valid) > 0:
        summary = valid["total_ms"].agg(
            count="count",
            avg_ms="mean",
            p95_ms=lambda s: s.quantile(0.95),
            max_ms="max",
            min_ms="min",
        )
        pd.DataFrame([summary]).to_csv(OUT_SUMMARY, index=False, encoding="utf-8-sig")
        print("\n=== SUMMARY ===\n", pd.DataFrame([summary]))
    else:
        print("\n유효한 측정이 없습니다. 셀렉터/화면요소를 확인하세요.")

    print(f"\nCSV 저장: {OUT_DETAIL}, {OUT_SUMMARY}")

if __name__ == "__main__":
    main()
