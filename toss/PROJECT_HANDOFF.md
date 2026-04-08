# PROJECT HANDOFF — 매장 체크리스트 미니앱

> 세션 간 컨텍스트 전달용. 맥북에서 작업 재개 시 이 파일을 먼저 읽어주세요.

## 현재 상태: MVP 프런트 완성, 맥북 이전 준비 완료

**마지막 작업일:** 2026-04-08
**Git 브랜치:** `feature/toss-checklist`
**리포:** `github.com/wogus1001/naeilsajang`

---

## 이번 세션에서 한 일

### 1. 프로젝트 기획 & 계획 수립
- 앱인토스 개발자센터 문서 조사 (llms.txt, WebView 튜토리얼, Granite SDK)
- TDS Mobile 컴포넌트 API 확인 (Button, Checkbox 등)
- Figma MCP 연동 완료 (TDS Mobile for Apps-in-Toss UI Kit)
- 상세 구현 계획 작성 → ARCHITECTURE.md, README.md

### 2. 주요 설계 결정

**토스 로그인:**
- `appLogin()` → authorizationCode 반환 (클라이언트)
- 서버 측 mTLS 토큰 교환 필수 → `scripts/toss-auth-server.mjs`
- 브라우저 환경에서는 데모 로그인으로 폴백

**데이터 저장:**
- 1차: localStorage / 2차: Supabase 동기화 (auth 서버 경유)
- 스키마: `supabase/migrations/`

**직원 관리:**
- 점주가 초대코드/링크 발급 → 직원 토스 로그인 → 닉네임 입력 → 합류
- MVP는 자체 인코딩 초대코드 (추후 서버 검증 전환)

**게이미피케이션:**
- 마감(close) 연속 완료 일수 추적 (🔥 스트릭)
- `src/lib/streak.ts` → calcStreak()

### 3. MCP 연동 상태
- **Figma**: `claude mcp add --transport http figma https://mcp.figma.com/mcp`
  - TDS Mobile UI Kit fileKey: `NF92wLpk0ks0IQqDYXnMxm`
- **apps-in-toss**: 설치됨 (ax mcp start)
  - search_docs, get_tds_web_doc, list_examples 등 사용 가능

### 4. Git Push
- `feature/toss-checklist` 브랜치에 51개 파일 커밋/push 완료
- 민감 파일(mTLS 인증서, .env.local) 제외 확인

---

## 맥북에서 작업 시작

```bash
# 클론 또는 fetch
git clone https://github.com/wogus1001/naeilsajang.git  # 또는 git fetch
cd naeilsajang && git checkout feature/toss-checklist
cd toss && npm install

# 환경변수
# .env.local 수동 생성 (README.md 참조)

# 실행
npm run auth:server  # 터미널 1
npm run dev          # 터미널 2
# → http://localhost:5173

# MCP 세팅 (맥북)
claude mcp add --transport http figma https://mcp.figma.com/mcp
brew tap toss/tap && brew install ax
claude mcp add --transport stdio apps-in-toss ax mcp start
```

---

## 프로젝트 구조

```
toss/
├── src/
│   ├── pages/          ← Login, Setup, Home, Checklist, History, Settings
│   ├── hooks/          ← useStore, useChecklist, useWorkers
│   ├── lib/            ← storage, streak, tossAuth, inviteCode, remoteStore
│   ├── components/     ← BottomTabBar, ProtectedRoute
│   └── types/
├── scripts/            ← toss-auth-server.mjs
├── supabase/           ← 마이그레이션 SQL
├── cloudrun/           ← Cloud Run 배포 설정
└── [설정 파일]         ← granite.config.ts, vite.config.ts, tsconfig 등
```

---

## 다음 작업 (TODO)

- [ ] 맥북에서 npm install + npm run dev 정상 확인
- [ ] TDS Mobile 컴포넌트 import 테스트
- [ ] Playwright 6페이지 스크린샷 검증
- [ ] 토스 샌드박스 `intoss://open-close-check` 테스트
- [ ] Supabase 프로젝트 생성 + 마이그레이션 적용
- [ ] Cloud Run auth 서버 배포 (mTLS Secret Manager)
- [ ] 실제 토스 로그인 E2E 검증

---

## 알려진 이슈

- `@toss/tds-mobile`: 로컬 브라우저에서 일부 컴포넌트 미동작 가능
- `appLogin()`: 토스 앱/샌드박스 내에서만 동작
- mTLS 인증서: git 미포함 → 맥북에서 별도 복사 필요
- 초대코드: MVP 자체 인코딩 → 추후 서버 검증 전환

---

## 주요 문서

| 문서 | 설명 |
|------|------|
| README.md | 프로젝트 개요 + 실행법 |
| ARCHITECTURE.md | 아키텍처 + 도메인 모델 |
| SCHEMA.md | DB 스키마 |
| ROADMAP.md | 진행 현황 |
| CHANGELOG.md | 변경 이력 |
