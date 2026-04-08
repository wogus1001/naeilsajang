# PROJECT_HANDOFF.md

## 프로젝트
- 이름: 매장 체크리스트
- 형태: Toss 앱 내 WebView 미니앱 MVP
- 목적: 점주가 매일 오픈/마감 체크리스트를 수행하고, 완료 이력과 담당자를 간단히 관리할 수 있게 한다.
- 기준 문서: `README.md`, `ARCHITECTURE.md`

## 현재 상태
- 단계: MVP 1차 구현 완료
- 마지막 완료 작업:
  - React + TypeScript + Vite 앱 골격 생성
  - localStorage 기반 상태 관리와 체크리스트 훅 구현
  - 로그인, 셋업, 홈, 체크리스트, 이력, 설정 화면 구현
  - 브라우저용 데모 로그인 폴백 추가
  - `npm run build` 통과 및 Playwright 스크린샷 확보
- 현재 코드 상태:
  - 앱 소스와 기본 스타일 구현 완료
  - 로컬 저장 기반 MVP 흐름 동작
  - Toss 실제 런타임 로그인 브리지는 후속 검증 필요

## 이번 프로젝트의 다음 실행 작업
- Toss 런타임에서 실제 `appLogin` 브리지 동작 확인
- Figma/TDS 기준으로 UI 디테일 보정
- 필요 시 서버 연동을 위한 인증/저장 구조 확장

## 확정된 구현 범위
- 인증:
  - Toss `appLogin()` 성공을 세션 시작 기준으로 사용
  - MVP에서는 사용자 실명 조회 없이 `authCode`를 로컬 세션 마커로 저장
- 데이터:
  - `store_profile`
  - `workers`
  - `checklist_items`
  - `completion_history`
- 화면:
  - `/login`
  - `/setup`
  - `/`
  - `/checklist/:type`
  - `/history`
  - `/settings`
- 핵심 기능:
  - 매장 정보 등록
  - 오픈/마감 체크리스트 실행
  - 완료자 선택
  - 최근 완료 이력 조회
  - 스트릭 계산
  - 체크리스트 항목/알바생 관리

## 다음 TODO
1. Toss 실제 앱 환경에서 로그인 브리지 경로 점검 및 연결
2. Figma 링크 기준으로 카드/간격/타이포 디테일 보정
3. Playwright 시나리오를 로그인 외 홈/체크리스트까지 확대
4. 체크리스트 항목 순서 변경 기능 필요 여부 결정
5. 백엔드 연동 전제의 인증 토큰 교환 구조 설계

## 검증 기준
- 필수:
  - `npm run build`
  - 주요 화면 진입 가능 여부 확인
  - localStorage 저장/복원 동작 확인
- UI 변경 시:
  - 로그인
  - 설정
  - 홈
  - 체크리스트 실행
  - 이력 확인
  - 각 흐름별 스크린샷 확보
- 현재 확보한 증거:
  - Playwright 스크린샷: `.playwright-mcp/store-checklist-login.png`

## 리스크와 주의사항
- Toss `appLogin()`은 실제 앱 환경 의존성이 있어 일반 브라우저 개발 환경에서는 직접 동작하지 않을 수 있다.
- 현재 구현은 브라우저용 데모 로그인 폴백을 사용한다.
- 서버가 없으므로 사용자 실명/전화번호 등 실제 프로필 연동은 MVP 범위 밖이다.
- `handoff.md`는 워크스페이스 규칙상 Claude가 최종 작성하는 파일이므로, 이 문서는 프로젝트 전용 작업 handoff로 유지한다.

## 다음 작업자가 바로 보면 좋은 체크포인트
- 우선 문서 구현 일치 여부를 유지할 것
- TypeScript에서 `any` 없이 진행할 것
- UI는 모바일 우선, 체크리스트 조작은 한 손 사용을 고려할 것
- 설계 변경이 생기면 `README.md`와 `ARCHITECTURE.md`를 함께 갱신할 것

## Codex 증거 패키지 형식
- 변경 파일 목록
- 실행한 명령어
- 빌드/테스트 결과
- 스크린샷 경로
- 남은 리스크
