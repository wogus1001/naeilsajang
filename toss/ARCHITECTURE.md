# ARCHITECTURE.md

## 1. 목표

매장 점주와 직원이 오픈/마감 루틴을 빠르게 확인하고, 매일 기록을 남길 수 있는 앱인토스 미니앱 MVP를 만든다.

현재 우선순위는 다음과 같다.

- 프런트 UX 완성
- 토스 로그인 실연동
- 체크리스트 데이터 영속화 준비

## 2. 시스템 구성

### 프런트

- React 19
- TypeScript
- Vite
- `@apps-in-toss/web-framework`

역할:

- `appLogin()` 호출
- 매장 등록/체크리스트 UI 렌더링
- 검증된 로그인 메타데이터와 체크리스트 상태를 보관
- Supabase 복원 결과를 받아 로컬 상태를 재구성

### 토스 로그인 auth 서버

- 런타임: Node.js
- 로컬 실행 파일: `scripts/toss-auth-server.mjs`
- 배포 권장: Cloud Run

역할:

- `authorizationCode` 수신
- mTLS 인증서로 토스 API 호출
- `generate-token` → `login-me` 교환
- 세션 쿠키 관리
- 로그아웃 시 access token 연결 해제
- Supabase admin API로 매장/직원/기록 상태 조회와 업서트 처리

### 데이터 영속화 계층

- 현재: `localStorage`
- 다음 단계 권장: Supabase

권장 역할 분리:

- Cloud Run: 토스 로그인/민감한 서버 통신
- Supabase: 매장, 직원, 체크리스트, 완료 이력 저장

## 3. 인증 경계

토스 로그인은 프런트 단독으로 끝나지 않는다.

1. 프런트에서 `appLogin()` 호출
2. 토스 앱이 `authorizationCode` 와 `referrer` 반환
3. 프런트가 `/api/auth/toss/login` 호출
4. auth 서버가 mTLS 인증서를 사용해 토스 API 호출
5. 서버가 `userKey`, `scope`, `agreedTerms` 반환
6. 프런트가 아래 메타데이터만 저장

저장 대상:

- `authSource`
- `tossUserKey`
- `agreedScopes`
- `agreedTerms`
- `authVerifiedAt`

저장하지 않는 것:

- `authorizationCode`
- access token
- refresh token
- mTLS 인증서/키

## 4. 도메인 모델

`src/types/index.ts`

```ts
export interface ChecklistItem {
  id: string;
  label: string;
  type: 'open' | 'close';
  order: number;
}

export interface CompletionRecord {
  id: string;
  date: string;
  type: 'open' | 'close';
  completedAt: string;
  totalItems: number;
  checkedItems: string[];
  workerId: string;
  actorNameSnapshot: string | null;
}

export type AuthSource = 'toss' | 'sandbox' | 'browser-demo';

export interface StoreProfile {
  storeId: string | null;
  storeName: string;
  ownerNickname: string;
  memberNickname: string;
  membershipRole: 'owner' | 'staff';
  memberWorkerId: string | null;
  joinedWithInviteCode: string | null;
  authSource: AuthSource;
  tossUserKey: number | null;
  agreedScopes: string[];
  agreedTerms: string[];
  authVerifiedAt: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  addedAt: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

export interface StoreDataBundle {
  profile: StoreProfile;
  workers: Worker[];
  items: ChecklistItem[];
  history: CompletionRecord[];
}
```

## 5. 클라이언트 저장소

현재 `localStorage` 키:

- `store_profile`
- `workers`
- `checklist_items`
- `completion_history`

보조 세션 저장:

- `pending_auth_identity`

## 6. 주요 훅

### `useStore()`

책임:

- 로그인 시작
- 로그인 직후 원격 매장 복원 시도
- 로그인 에러 상태 관리
- setup 이후 `StoreProfile` 저장
- 로그아웃 및 세션 정리

핵심 API:

```ts
profile: StoreProfile | null
isLoggedIn: boolean
isLoggingIn: boolean
loginError: string | null
pendingAuthIdentity: AuthIdentity | null
login(nextPath?: string): Promise<void>
setupStore(input: {
  storeName: string
  ownerNickname: string
  memberNickname: string
  membershipRole: 'owner' | 'staff'
  joinedWithInviteCode?: string | null
}): Promise<void>
logout(): void
```

### `useChecklist()`

책임:

- 항목 CRUD
- 오늘 오픈/마감 기록 저장
- 최근 기록 조회
- 연속 마감 streak 계산
- Supabase checklist/history 비동기 동기화

### `useWorkers()`

책임:

- 직원 추가/삭제
- 초대 링크로 합류한 직원 닉네임을 worker 목록과 동기화
- 완료 담당자 선택 기반 데이터 제공
- Supabase workers 비동기 동기화

## 7. 라우팅

```text
/login
/setup
/
/checklist/:type
/history
/settings
```

보호 라우트:

- `ProtectedRoute` 가 `store_profile` 존재 여부를 기준으로 접근 제어

## 8. 로컬 개발 토폴로지

### 프런트 개발 서버

- `npm run dev`
- Vite dev server
- `/api/auth/toss/*`, `/api/store/*` 요청을 `http://127.0.0.1:8787` 로 프록시

### auth 서버

- `npm run auth:server`
- `GET /healthz`
- `POST /api/auth/toss/login`
- `POST /api/auth/toss/logout`
- `POST /api/store/restore`
- `POST /api/store/setup-owner`
- `POST /api/store/join-invite`
- `POST /api/store/sync/profile`
- `POST /api/store/sync/workers`
- `POST /api/store/sync/items`
- `POST /api/store/sync/history`

## 9. 배포 방향

### Cloud Run

토스 로그인용 auth 서버를 Cloud Run에 배포한다.

이유:

- mTLS 인증서/키를 Secret Manager와 함께 다루기 좋음
- 컨테이너 기반이라 Node auth 서버를 그대로 올릴 수 있음
- 토스 로그인처럼 서버 간 통신이 필요한 기능에 적합

### Supabase

앱 데이터 저장소와 운영 콘솔 역할로 사용한다.

예정 테이블:

- `stores`
- `store_memberships`
- `workers`
- `checklist_items`
- `completion_records`

## 10. 현재 리스크

- 로컬에서는 브라우저 폴백 로그인으로 UI 검증만 가능
- 실제 `appLogin()` 결과는 Toss 앱 또는 Sandbox 앱에서 재검증 필요
- auth 서버는 현재 메모리 세션 기반이라 다중 인스턴스 운영 전 단계
- 초대코드는 아직 자체 인코딩 기반이라 서버 만료/회수 로직이 없음

## 11. 다음 작업

1. Supabase 프로젝트에 마이그레이션 적용
2. Cloud Run 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 등록
3. mTLS 인증서 경로를 Secret Manager 마운트 방식으로 정리
4. Toss/Sandbox 실제 로그인 E2E 검증

## 12. 권장 매장 로그인 모델

현재 MVP는 한 기기 안에서 점주와 직원을 선택해 기록하는 방식입니다.

정식 운영에서는 공용 "매장 계정"보다 아래 방식이 더 적합합니다.

1. 모든 사용자는 각자 Toss 로그인으로 앱에 들어온다.
2. 점주가 첫 로그인 후 매장을 생성한다.
3. 점주는 초대 코드 또는 QR로 직원을 매장에 초대한다.
4. 직원은 자신의 Toss 계정으로 로그인한 뒤, 초대 링크에서 닉네임을 설정하고 매장에 가입한다.
5. 기록은 `누가`, `어느 매장`, `언제` 처리했는지 사용자 기준으로 남긴다.

이 방식을 권장하는 이유:

- 담당자 이력이 정확하게 남음
- 직원 교체나 기기 변경에 강함
- 공용 비밀번호 공유가 필요 없음
- 푸시, 알림, 이후 권한 관리로 확장하기 쉬움

공용 매장 태블릿이 필요한 경우에는 보조 수단으로만 사용합니다.

- 권장: 개인 Toss 로그인 + 매장 멤버십
- 선택: 공용 기기에서는 4자리 매장 PIN으로 빠른 재진입

즉, "매장 로그인"보다는 "개인 로그인 후 매장 합류" 모델이 기본이 되어야 합니다.
