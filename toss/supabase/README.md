# Supabase Setup

이 디렉터리는 매장 체크리스트 앱의 운영 데이터를 Supabase로 옮기기 위한 초기 기준을 담고 있습니다.

## 현재 포함된 항목

- `migrations/20260320100000_initial_schema.sql`
- `migrations/20260320113000_store_memberships.sql`

## 적용 순서

1. Supabase 프로젝트 생성
2. `supabase/migrations/20260320100000_initial_schema.sql` 적용
3. `supabase/migrations/20260320113000_store_memberships.sql` 적용
4. `stores`, `store_memberships`, `workers`, `checklist_items`, `completion_records` 테이블 생성 확인
5. 이후 Cloud Run 또는 별도 API 서버에서 service role로 연결

## 초기 운영 원칙

- 토스 로그인 검증은 Cloud Run auth 서버가 담당
- Supabase는 앱 데이터 저장 역할을 담당
- 현재 단계에서는 RLS를 활성화만 하고 정책은 열지 않습니다
- 프런트는 `localStorage`를 유지하되, auth 서버를 통해 Supabase와 동기화합니다

## 다음 구현 대상

1. `POST /api/store/restore`
2. `POST /api/store/setup-owner`
3. `POST /api/store/join-invite`
4. `POST /api/store/sync/profile`
5. `POST /api/store/sync/workers`
6. `POST /api/store/sync/items`
7. `POST /api/store/sync/history`
