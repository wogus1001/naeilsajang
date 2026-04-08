# CHANGELOG.md

## 2026-03-20

- 토스 로그인 교환 로직을 Vite 내부 프록시에서 별도 auth 서버 구조로 분리
- `scripts/toss-auth-server.mjs` 추가
- `vite.tossAuthProxy.ts` 제거
- Vite dev/preview 프록시를 auth 서버 포트 기반으로 재구성
- auth 서버에 mTLS 인증서 경로, CORS, 쿠키 설정 옵션 추가
- `Dockerfile.auth-server`, `cloudbuild.auth.yaml`, `cloudrun/deploy-auth.ps1` 추가
- `cloudrun/service.template.yaml` 추가
- Supabase 초기 스키마 `supabase/migrations/20260320100000_initial_schema.sql` 추가
- Supabase 멤버십 스키마 `supabase/migrations/20260320113000_store_memberships.sql` 추가
- `supabase/README.md` 추가
- 콘솔 등록 기준 이름을 `오픈마감체크 / Open Close Check / open-close-check` 로 고정
- 점주가 설정에서 초대코드와 초대 링크를 발급할 수 있도록 추가
- 초대 링크로 들어온 직원이 닉네임을 설정하고 매장에 합류하는 온보딩 추가
- 직원 닉네임을 체크리스트 기본 담당자와 최근 30일 기록 표시에 연결
- `scripts/store-data-service.mjs` 추가
- auth 서버에 Supabase store restore/setup/join/sync API 추가
- 로그인 직후 기존 매장을 자동 복원하고, 항목/직원/이력을 Supabase와 비동기 동기화하도록 연결
- `storeId`, `actorNameSnapshot` 로컬 모델 추가
- `SCHEMA.md`, `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` 문서 동기화
