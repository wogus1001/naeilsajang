# MAC_CONTEXT

## 목적
- 맥북에서 ERP/web 작업을 이어갈 때 필요한 운영 규칙, 폴더 구조, 배포 방식, 최근 상태를 한 문서에 정리한다.
- 새 Codex 세션은 이 문서와 [AGENTS.md](/C:/Users/awmve/OneDrive/바탕%20화면/my_project/ERP/web/AGENTS.md), [ROADMAP.md](/C:/Users/awmve/OneDrive/바탕%20화면/my_project/ERP/web/ROADMAP.md)를 먼저 읽고 시작한다.

## 현재 운영 방식
- 로컬 개발: `my_project`
- dev 배포용 worktree: `my_project_dev_deploy`
- 실서버 배포용 worktree: `my_project_main_release`
- 깨끗한 기준 확인용 worktree: `my_project_clean_main`

## 윈도우 기준 worktree 상태
- `C:/Users/awmve/OneDrive/바탕 화면/my_project` -> `main` at `8171138e`
- `C:/Users/awmve/OneDrive/바탕 화면/my_project_dev_deploy` -> `dev` at `0564333e`
- `C:/Users/awmve/OneDrive/바탕 화면/my_project_main_release` -> `release-main-20260324` at `b6f4c653`
- `C:/Users/awmve/OneDrive/바탕 화면/my_project_clean_main` -> `clean-main-20260324` at `a8258ccb`

## 맥북 권장 폴더 구조
- 권장 루트: `/Users/kimjaehyun/Documents/project/erp_workspace`
- 권장 구조:

```text
/Users/kimjaehyun/Documents/project/erp_workspace
├─ my_project
├─ my_project_dev_deploy
├─ my_project_main_release
└─ my_project_clean_main
```

## 중요한 주의사항
- `my_project*` 폴더들은 `git worktree`이므로 Finder에서 그냥 드래그 이동하지 않는다.
- ERP 관련 폴더를 한곳에 모으고 싶으면, 기존 폴더를 수동 이동하지 말고 새 위치에 clone/worktree를 다시 구성한 뒤 검증 후 교체한다.
- `node_modules`, `.next`는 플랫폼 종속이 있으므로 복사하지 않는다.
- `.env.local`은 git에 올리지 않는다.
- `handoff.md`는 단일 작성자 규칙 때문에 Codex가 수정하지 않는다.

## 맥에서 ERP 전용 폴더로 재구성하는 안전한 순서
- 이미 `/Users/kimjaehyun/Documents/project` 아래에 작업 폴더가 있는 상태를 기준으로 한다.
- 아래 방식은 기존 현재 상태를 유지한 채, 새 `erp_workspace`를 만들고 그 안에서 다시 구성하는 방식이다.

```bash
mkdir -p /Users/kimjaehyun/Documents/project/erp_workspace
cd /Users/kimjaehyun/Documents/project/erp_workspace

git clone https://github.com/wogus1001/naeilsajang.git my_project
cd my_project
git fetch origin

git worktree add ../my_project_dev_deploy dev
git worktree add -b release-main-$(date +%Y%m%d) ../my_project_main_release origin/main
git worktree add -b clean-main-$(date +%Y%m%d) ../my_project_clean_main origin/main
```

- 환경변수는 기존 위치에서 복사:

```bash
cp /Users/kimjaehyun/Documents/project/my_project/ERP/web/.env.local /Users/kimjaehyun/Documents/project/erp_workspace/my_project/ERP/web/.env.local
cp /Users/kimjaehyun/Documents/project/my_project/ERP/web/.env.local /Users/kimjaehyun/Documents/project/erp_workspace/my_project_dev_deploy/ERP/web/.env.local
cp /Users/kimjaehyun/Documents/project/my_project/ERP/web/.env.local /Users/kimjaehyun/Documents/project/erp_workspace/my_project_main_release/ERP/web/.env.local
cp /Users/kimjaehyun/Documents/project/my_project/ERP/web/.env.local /Users/kimjaehyun/Documents/project/erp_workspace/my_project_clean_main/ERP/web/.env.local
```

- 의존성 재설치:

```bash
cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project/ERP/web && npm ci
cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project_dev_deploy/ERP/web && npm ci
cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project_main_release/ERP/web && npm ci
cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project_clean_main/ERP/web && npm ci
```

- 최종 확인:

```bash
cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project
git status
git worktree list

cd /Users/kimjaehyun/Documents/project/erp_workspace/my_project/ERP/web
npm run build
```

## 맥북 배포 방식
- 로컬에서 먼저 수정/확인
- dev로 올릴 때는 `my_project_dev_deploy`에서 필요한 파일만 반영 후 `dev`로 push
- 실서버는 `my_project_main_release`에서 필요한 파일만 반영 후 `HEAD:main`으로 push
- 최근 운영 원칙:
  - 실사용 확인이 필요한 작업은 `dev` 먼저
  - 확인 후 `main`
  - 예외적으로 사용자가 실서버 먼저 요청한 경우만 `main` 우선

## 최근 배포 이력 기준점
- `dev` 최신 확인 커밋: `0564333e` `fix: align property report header meta layout`
- `main` 최신 확인 커밋: `b6f4c653` `fix: align property report header meta layout`

## 최근 중요 작업 요약
- 매물 상세 리포트 인쇄형식 헤더 정리
  - `발행일` 옆에 `담당자`
  - 기존 담당자 위치에 `주소`
  - 오른쪽 상단에는 매장명만 유지
- 매물 상세 리포트 면적 표시 수정
  - 저장값 `평` 기준을 리포트에서 올바른 `㎡`로 변환
- 인쇄형식1 상세 내용 영역 항상 표시
  - 값이 없어도 박스 유지, 비어 있으면 `-`
- 계약 양식 편집기 표 기능 확장
  - 행/열 삭제
  - 가로/세로 병합 및 해제
  - 폭 조절 개선
- 점포 신규등록 주소 검색 표시 문제 수정
- 리포트 형식 1~4 레이아웃 다수 조정

## 현재 로컬 main 미커밋 변경 파일
- `.gitignore`
- `ERP/web/src/app/(main)/business-cards/page.tsx`
- `ERP/web/src/app/(main)/contracts/builder/page.tsx`
- `ERP/web/src/app/(main)/contracts/project/[id]/page.tsx`
- `ERP/web/src/app/(main)/customers/page.tsx`
- `ERP/web/src/app/(main)/properties/page.tsx`
- `ERP/web/src/app/(main)/properties/register/page.module.css`
- `ERP/web/src/app/(main)/properties/register/page.tsx`
- `ERP/web/src/components/properties/PropertyCard.tsx`
- `ERP/web/src/components/properties/reports/PropertyReportPrint.tsx`

## 현재 로컬 미커밋 변경 중 눈에 띄는 항목
- `PropertyCard.tsx`
  - 영업/임대차 커스텀 추가 행에 삭제 버튼을 붙인 상태
- `PropertyReportPrint.tsx`
  - 리포트 헤더 메타 배치 및 인쇄형식 관련 조정이 누적된 상태
- 위 변경들은 모두 로컬 main의 WIP일 수 있으므로, 맥에서 작업 시작 전 `git status`로 실제 상태를 다시 확인한다.

## 환경변수 / 외부 서비스
- 핵심 env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
- 실서버 Supabase는 dev와 별도 프로젝트로 분리되어 있음
- 실서버 Vercel 프로젝트와 dev 프로젝트의 env는 다를 수 있으므로 배포 전 확인 필요

## 새 Codex 세션 시작 체크리스트
1. 이 문서 읽기
2. `git worktree list`
3. `git status`
4. `ERP/web/AGENTS.md` 확인
5. 필요한 경우 `ERP/web/ROADMAP.md` 확인
6. 변경 범위가 리포트면 `PropertyReportPrint.tsx`, 매물 입력이면 `PropertyCard.tsx` / `properties/register/page.tsx`부터 확인

