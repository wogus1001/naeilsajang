# Changelog / 변경 이력

All notable changes to this project will be documented in this file.
이 프로젝트의 주요 변경 사항은 이 파일에 기록됩니다.

## [v1.0.0] - 2026-01-16

### Added (추가됨)
- **Customer Management System Upgrade (고객 관리 시스템 고도화)**
  - **Excel Batch Upload**: Support for uploading 3 files (Main, Promoted, History) to bulk create/update customers.
    - **엑셀 일괄 업로드**: 3종 파일(기본정보, 추진물건, 상담이력)을 통한 고객 데이터 대량 등록/수정 지원.
  - **DB Sync**: Synchronization between Customer History and Calendar Schedules.
    - **DB 동기화**: 고객 상담 이력과 일정(캘린더) 간 자동 동기화.
  - **Bidirectional Sync (Customer)**: Automatic linking of Customer Work History to Properties; adds history to Property records.
    - **양방향 동기화 (고객)**: 고객 상담 이력에 물건이 태그되면, 해당 물건의 상세 페이지에도 작업 이력이 자동 추가됨.
  - **Bidirectional Sync (Business Card)**: Automatic linking of Business Card Work History to Properties; adds history to Property records.
    - **양방향 동기화 (명함)**: 명함 상담 이력에 물건이 태그되면, 해당 물건의 작업 이력에도 자동 반영됨.
  - **New Data Fields**: Added store-specific fields (Wanted Area, Deposit, Rent Ranges, etc.) and `progressSteps`.
    - **신규 데이터 필드**: 점포 관련 필드(희망 면적/보증금/임대료 범위 등) 및 진행 단계(`progressSteps`) 필드 추가.

### Changed (변경됨)
- **Mobile Support Improvements (모바일 지원 개선)**:
  - Enhanced responsive layout for Customer List and Modals.
    - 고객 목록 및 모달 창의 반응형 레이아웃 개선.
  - Fixed drawer resizing and mobile visibility.
    - 모바일 환경에서 드로어 크기 조절 및 표시 문제 해결.
- **Data Integrity (데이터 무결성)**:
  - Improved fuzzy search (`ilike`) -> reverted to Strict Search (`eq`) for Property linking safety as per user request.
    - 물건 연결 시 검색 정확도를 위해 퍼지 검색(`ilike`) 대신 정확한 일치(`eq`) 방식 적용 (사용자 요청).
  - Corrected database column mapping for `work_date` and `worker_name`.
    - DB 컬럼 매핑 오류 수정 (`work_date`, `worker_name`).
  - Added robust null-safety checks for list rendering to prevent Application Errors on empty data fields.
    - 빈 데이터 필드로 인한 앱 크래시(오류) 방지를 위해 목록 렌더링 시 안전장치(Null Check) 강화.

### Fixed (수정됨)
- **Application Error (Crash)**: Fixed client-side exception caused by null array fields (`progressSteps`, etc.) in the customer list.
  - **앱 실행 오류**: 고객 목록 진입 시 `null` 배열 필드로 인해 발생하던 클라이언트 오류 수정.
- **Sync Logic**: Fixed issue where re-syncing would fail or not update property history if `targetId` was missing.
  - **동기화 로직**: `targetId`가 누락된 경우 재동기화 시 물건 이력이 갱신되지 않던 문제 해결.
- **UI Interaction**: Fixed event bubbling issue where clicking a related property link would simultaneously open the edit modal.
  - **UI 동작**: 관련 물건 링크 클릭 시 작업 편집 창이 동시에 열리는 이벤트 충돌 문제 해결.
