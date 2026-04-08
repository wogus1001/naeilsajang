# 오픈마감체크

토스 앱인토스 WebView 미니앱으로, 매장 오픈/마감 체크리스트를 빠르게 기록하는 MVP입니다.

## 핵심 기능

- 토스 로그인: `appLogin()` 이후 서버 교환으로 사용자 식별
- 매장 등록: 매장명과 점주 닉네임 등록
- 직원 초대: 설정에서 초대코드와 초대 링크 발급
- 직원 합류: 초대 링크로 들어온 직원이 내 닉네임을 설정하고 바로 매장에 합류
- 체크리스트 실행: 오픈/마감 항목 체크 후 오늘 기록 저장
- 담당자 관리: 점주/직원별 완료 이력과 설정 관리
- 연속 마감 스트릭: 마감 완료 streak 표시
- 기록 조회: 최근 완료 이력 확인

## 현재 아키텍처

- 프런트엔드: React 19 + TypeScript + Vite
- 앱인토스 SDK: `@apps-in-toss/web-framework`
- 로컬 데이터: `localStorage`
- 토스 로그인 서버: 별도 Node auth 서버
- 배포 권장:
  - 토스 로그인 auth 서버: Cloud Run
  - 앱 데이터 영속화: Supabase

토스 로그인은 공식 문서상 `mTLS` 기반 서버 간 통신이 필수라서, 프런트에서 토스 API를 직접 호출하지 않습니다.

## 로그인 흐름

1. 프런트에서 `appLogin()` 호출
2. 토스가 `authorizationCode` 와 `referrer` 반환
3. 프런트가 `/api/auth/toss/login` 호출
4. auth 서버가 mTLS 인증서로 아래 API 호출
   - `POST /api-partner/v1/apps-in-toss/user/oauth2/generate-token`
   - `GET /api-partner/v1/apps-in-toss/user/oauth2/login-me`
5. 서버가 `userKey`, `scope`, `agreedTerms` 를 프런트에 반환
6. 프런트는 검증된 메타데이터만 `localStorage` 에 저장

브라우저 개발 환경에서는 `appLogin()` 브리지가 없으므로 데모 로그인으로 폴백합니다.

## 매장 합류 흐름

1. 점주가 로그인 후 매장 이름과 점주 닉네임을 설정합니다.
2. 설정 화면에서 초대코드 또는 초대 링크를 발급합니다.
3. 직원은 초대 링크로 로그인한 뒤 자기 닉네임을 입력합니다.
4. 입력한 닉네임은 체크리스트 기본 담당자와 최근 30일 기록 표시에 그대로 사용됩니다.

현재 초대코드는 MVP용 자체 인코딩 방식으로 동작합니다. 정식 운영에서는 Supabase의 `store_invites`, `store_memberships` 테이블과 연결해 만료 시간, 사용 상태, 권한을 서버에서 검증하는 구조로 전환하는 것이 안전합니다.

## Supabase 연동 상태

- 점주 매장 생성 시 `stores`, `checklist_items` 를 Supabase에 업서트
- 직원 초대 합류 시 `store_memberships`, `workers` 를 Supabase에 업서트
- 로그인 직후 `tossUserKey` 기준으로 기존 매장을 찾아 자동 복원
- 체크리스트 항목, 직원 목록, 완료 기록은 변경 시 서버로 비동기 동기화
- Supabase가 설정되지 않은 환경에서는 기존 `localStorage` 흐름으로 자동 폴백

## 로컬 실행

```bash
cd toss
npm install
```

터미널 1:

```bash
npm run auth:server
```

터미널 2:

```bash
npm run dev
```

브라우저 주소:

```text
http://localhost:5173
```

샌드박스 딥링크:

```text
intoss://open-close-check
```

## 환경변수

`.env.local`

```env
VITE_TOSS_AUTH_API_BASE_URL=
TOSS_AUTH_SERVER_PORT=8787
TOSS_API_BASE_URL=https://apps-in-toss-api.toss.im
TOSS_AUTH_ALLOWED_ORIGIN=
TOSS_AUTH_COOKIE_SAMESITE=Lax
TOSS_AUTH_COOKIE_SECURE=false
TOSS_MTLS_CERT_PATH=
TOSS_MTLS_KEY_PATH=
TOSS_MTLS_CA_PATH=
TOSS_DECRYPTION_KEY=
TOSS_DECRYPTION_AAD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

설명:

- `VITE_TOSS_AUTH_API_BASE_URL`
  - 외부 auth 서버를 따로 둘 때만 사용
  - 비워두면 프런트는 같은 오리진의 `/api/auth/toss/*`, `/api/store/*` 를 호출
- `TOSS_MTLS_CERT_PATH`, `TOSS_MTLS_KEY_PATH`
  - 토스 API 호출에 필요한 mTLS 인증서와 키 파일 경로
- `TOSS_AUTH_ALLOWED_ORIGIN`
  - Cloud Run auth 서버를 다른 프런트엔드 오리진에서 직접 호출할 때 허용할 Origin
- `TOSS_AUTH_COOKIE_SAMESITE`, `TOSS_AUTH_COOKIE_SECURE`
  - 외부 오리진과 쿠키를 주고받을 때 사용하는 세션 쿠키 설정
- `TOSS_MTLS_CA_PATH`
  - 필요할 때만 추가 CA 파일 경로 지정
- `TOSS_DECRYPTION_KEY`, `TOSS_DECRYPTION_AAD`
  - 암호화된 개인정보 복호화가 필요한 경우에만 사용
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - auth 서버가 Supabase를 service role로 호출할 때 사용
  - 프런트에는 직접 노출하지 않고 서버에서만 사용

## 프로젝트 구조

```text
toss/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   └── tossAuth.ts
│   ├── pages/
│   └── types/
├── scripts/
│   └── toss-auth-server.mjs
├── Dockerfile.auth-server
├── cloudrun/
│   ├── deploy-auth.ps1
│   ├── service.template.yaml
│   └── README.md
├── supabase/
│   ├── migrations/
│   └── README.md
├── SCHEMA.md
├── ROADMAP.md
├── CHANGELOG.md
├── granite.config.ts
├── vite.config.ts
├── ARCHITECTURE.md
└── README.md
```

## Auth 서버 메모

- 로컬에서는 `scripts/toss-auth-server.mjs` 를 직접 실행
- 배포 시에는 `Dockerfile.auth-server` 기준으로 Cloud Run에 올리는 것을 권장
- 현재 auth 서버는 세션을 메모리에 저장하므로 MVP 수준입니다
- 앱 데이터는 `localStorage`를 기준 저장소로 유지하면서 Supabase와 동기화합니다
- Cloud Run 템플릿은 `cloudrun/` 아래에, Supabase 스키마는 `supabase/migrations/` 아래에 정리되어 있습니다

## 참고 문서

- [토스 로그인 소개](https://developers-apps-in-toss.toss.im/login/intro.html)
- [토스 로그인 개발 가이드](https://developers-apps-in-toss.toss.im/login/develop.html)
- [앱인토스 mTLS 통합 가이드](https://developers-apps-in-toss.toss.im/development/integration-process.html)
- [appLogin 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%A1%9C%EA%B7%B8%EC%9D%B8/appLogin.html)
