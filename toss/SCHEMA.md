# SCHEMA.md

## 목적

현재 `localStorage` 기반 데이터를 Supabase Postgres로 이관하기 위한 기준 스키마입니다.

핵심 원칙:

- 토스 로그인 검증은 Cloud Run auth 서버가 담당
- Supabase는 매장 운영 데이터 저장소 역할을 담당
- 현재 단계에서는 서버 전용 접근을 기본으로 두고, RLS는 활성화하되 정책은 아직 열지 않음

## 테이블 개요

### `stores`

매장과 점주 로그인 메타데이터를 저장합니다.

주요 컬럼:

- `id uuid primary key`
- `toss_user_key bigint unique`
- `store_name text`
- `owner_nickname text`
- `auth_source store_auth_source`
- `agreed_scopes text[]`
- `agreed_terms text[]`
- `auth_verified_at timestamptz`

설명:

- `toss_user_key` 는 토스 로그인 이후 받은 고유 식별자입니다.
- 브라우저 데모 로그인 환경을 고려해 nullable 로 둡니다.

### `workers`

매장별 직원 목록입니다.

주요 컬럼:

- `id text primary key`
- `store_id uuid references stores(id)`
- `name text`
- `added_at timestamptz`
- `archived_at timestamptz`

설명:

- 현재 프런트가 `nanoid()` 문자열을 쓰고 있어 `text` 키를 유지합니다.
- 초대 링크로 들어온 직원도 동일한 worker id를 발급받아 담당자 선택에 합류합니다.

### `store_memberships`

토스 로그인 사용자와 매장 연결 정보입니다.

주요 컬럼:

- `id uuid primary key`
- `store_id uuid references stores(id)`
- `toss_user_key bigint`
- `role store_membership_role`
- `nickname text`
- `worker_id text null references workers(id)`

설명:

- 점주와 직원 모두 자신의 `toss_user_key` 기준으로 매장에 연결됩니다.
- `nickname` 은 매장 안에서 보이는 표시 이름입니다.
- 직원은 `worker_id` 를 통해 체크리스트 담당자 선택과 연결됩니다.

### `checklist_items`

매장별 오픈/마감 체크 항목입니다.

주요 컬럼:

- `id text primary key`
- `store_id uuid references stores(id)`
- `label text`
- `type checklist_type`
- `sort_order integer`
- `is_active boolean`

설명:

- 활성 항목 기준으로 `(store_id, type, sort_order)` unique 인덱스를 둡니다.
- 삭제 대신 `is_active=false` 로 비활성화하는 방향을 열어둡니다.

### `completion_records`

하루 오픈/마감 완료 기록입니다.

주요 컬럼:

- `id text primary key`
- `store_id uuid references stores(id)`
- `record_date date`
- `checklist_type checklist_type`
- `completed_at timestamptz`
- `checked_item_ids text[]`
- `actor_kind completion_actor_kind`
- `actor_worker_id text null`
- `actor_name_snapshot text`

설명:

- 현재 로컬 구조는 하루에 타입별 1건만 유지하므로 `(store_id, record_date, checklist_type)` unique 제약을 둡니다.
- 직원이 나중에 삭제돼도 이력을 잃지 않도록 `actor_name_snapshot` 을 함께 저장합니다.

## enum 타입

- `store_auth_source`
  - `toss`
  - `sandbox`
  - `browser-demo`
- `store_membership_role`
  - `owner`
  - `staff`
- `checklist_type`
  - `open`
  - `close`
- `completion_actor_kind`
  - `owner`
  - `worker`

## 인덱스

- `stores_toss_user_key_idx`
- `workers_store_id_idx`
- `store_memberships_toss_user_key_idx`
- `checklist_items_store_type_order_idx`
- `completion_records_store_date_idx`
- `completion_records_actor_worker_id_idx`

## RLS 방침

현재 마이그레이션은 모든 테이블에 대해 `enable row level security` 까지만 적용합니다.

이유:

- 아직 Supabase Auth 또는 커스텀 JWT 매핑이 연결되지 않았습니다.
- 당장은 Cloud Run 또는 서버 전용 service role 경유 접근이 더 안전합니다.

다음 단계에서 검토할 정책:

- `toss_user_key` 와 앱 사용자 매핑 테이블 설계
- 매장 소유자와 직원 권한 분리
- 읽기 전용 이력 조회와 설정 수정 권한 분리

## 로컬 -> DB 매핑

- `store_profile` -> `stores`
- `store_profile.membershipRole/memberNickname/memberWorkerId` -> `store_memberships`
- `workers` -> `workers`
- `checklist_items` -> `checklist_items`
- `completion_history` -> `completion_records`

## 다음 확장 후보

- `users`
  - `toss_user_key` 기반 사용자 마스터
- `store_invites`
  - 초대 코드, 만료 시간, 초대 상태 관리
- `store_memberships.role` 확장
  - `manager` 같은 중간 권한 추가

현재 스키마는 MVP 저장/복원 기준이고, 초대코드 자체 검증은 이후 `store_invites` 도입 시점에 강화하는 것이 자연스럽습니다.
