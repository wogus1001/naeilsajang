# ROADMAP.md

## Phase 1

- React/Vite 기반 MVP UI 완성
- localStorage 기반 오픈/마감 체크리스트 구현
- Toss `appLogin()` 브라우저 폴백 정리

상태: 완료

## Phase 2

- 토스 로그인 교환을 별도 auth 서버로 분리
- mTLS 인증서 경로와 환경변수 정리
- Cloud Run 배포 파일 추가
- 콘솔 등록 기준 앱 이름과 배포 식별자 정리
- Supabase 기반 매장 복원/동기화 API 추가

상태: 진행 중

다음 할 일:

1. Supabase 프로젝트에 마이그레이션 2개 적용
2. Cloud Run에 auth 서버 실제 배포
3. Secret Manager에 mTLS cert/key 와 Supabase service role 등록
4. Toss Sandbox 앱에서 로그인 E2E 검증
5. 콘솔 앱 등록 시 `오픈마감체크 / Open Close Check / open-close-check` 기준으로 입력

## Phase 3

- localStorage 우선 저장을 서버 기준 복원/동기화 모델로 고도화
- 체크리스트/직원/이력 CRUD를 서버 진실원본 기준으로 전환
- 초대코드를 `store_invites` 기반 짧은 코드 방식으로 전환
- Cloud Run API와 Supabase 저장소 연결 강화

상태: 진행 가능

## Phase 4

- 권한 모델과 RLS 설계
- 멀티 디바이스 동기화
- 운영 로그와 장애 대응 플로우 정리

상태: 예정
