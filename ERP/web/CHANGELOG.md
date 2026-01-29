# Changelog / 변경 이력

All notable changes to this project will be documented in this file.
이 프로젝트의 주요 변경 사항은 이 파일에 기록됩니다.



## [v1.1.17] - 2026-01-29

### Fixed (수정됨)
- **Contract Builder Mobile Layout (계약서 빌더 모바일 레이아웃 수정)**
  - **Header Structure**: Refactored header to use CSS/Flexbox (removed inline styles) for better responsiveness.
    - 헤더 레이아웃을 CSS/Flexbox 기반으로 리팩토링하여 모바일 가독성을 개선했습니다 (인라인 스타일 제거).
  - **Button Spacing**: Optimized button placement and wrapping on small screens. Renamed "Template Save" to "Save" (`저장`).
    - 모바일 화면에서 버튼이 겹치지 않도록 줄바꿈 처리를 적용하고, "템플릿 저장" 버튼명을 "저장"으로 단축했습니다.
  - **Lint Fix**: Resolved duplicate `inlineStyles` declaration error.
    - 중복 선언된 스타일 코드(Lint 오류)를 제거했습니다.

- **Contract Selection Layout (계약 탬플릿 선택 화면 개선)**
  - **Title Wrapping**: Applied `keep-all` to "Contract Template Selection" and "Service Integration Needed" texts to prevent awkward truncation.
    - "계약 템플릿 선택" 및 "서비스 연동이 필요합니다" 텍스트에 줄바꿈 방지 스타일을 적용했습니다 (`keep-all`).
  - **Container Padding**: Adjusted padding for the "Login Required" card to fit better on mobile screens.
    - "서비스 연동" 안내 카드의 여백(Padding)을 줄여 모바일 화면 공간 효율을 높였습니다.

## [v1.1.13] - 2026-01-23

### Fixed (수정됨)
- **Print Format Map Rendering (인쇄물 지도 표시 수정)**
  - Fixed map rendering issue in Print Formats 3, 5, and 6 by restoring specific geocoding logic (`coords` state) for address-based locations.
    - 인쇄 형식 3, 5, 6번에서 지도가 나오지 않던 문제를 수정했습니다. (주소를 좌표로 변환하는 로직 복구)
- **Print Format Layouts (인쇄물 레이아웃 개선)**
  - **Format 4**: Adjusted 'Memo' section height and increased 'Lease Rights' table column widths for better readability. Added truncation to prevent overflow.
    - 형식 4번: 메모란 높이를 조정하고 임대차 권리 분석 표의 컬럼 너비를 넓혔습니다. 내용이 길어질 경우 말줄임표(...) 처리.
  - **Format 5 & 6**: Applied 5-line truncation to 'Features' (`특징`) and 'Location Analysis' (`상권현황`) fields to maintain layout stability.
    - 형식 5, 6번: 특징 및 상권현황 텍스트가 길어질 경우 5줄까지만 표시하고 말줄임표로 처리하여 레이아웃 깨짐을 방지했습니다.

### Changed (변경됨)
- **Maintenance Fee Display (관리비 단위 변경)**
  - Removed the "Won" (`만원`) unit text from the "Maintenance Fee" field in all Print Formats (1~6). Now displays as a standalone number (e.g., "30").
    - 인쇄 형식 1~6번의 관리비 항목에서 "만원" 글자를 삭제하고 숫자만 표시하도록 변경했습니다.

## [v1.1.12] - 2026-01-23

### Fixed (수정됨)
- **Property Batch Upload Geocoding (점포 일괄 업로드 지오코딩 복구)**
  - Implemented client-side geocoding using Kakao Maps API in the upload modal. Automatically converts addresses to `lat`/`lng` coordinates during Excel upload.
    - 엑셀 업로드 시 브라우저의 카카오 지도 API를 사용하여 주소를 좌표(위도/경도)로 자동 변환 및 저장하도록 기능을 복구했습니다.
- **Property Card Map Rendering (점포 상세 지도 표시 수정)**
  - Fixed map rendering logic to support flat `lat`/`lng` database columns, ensuring maps display correctly even without nested `coordinates` objects.
    - 좌표 데이터가 있어도 지도가 나오지 않던 문제를 수정하였습니다. (기존 객체 구조와 새로운 플랫 구조 호환성 확보)
  - Added "Generate Coordinates" button (`좌표생성`) for properties with missing location data.
    - 좌표가 없는 경우 "위치 정보 없음" 알림과 함께 즉시 좌표를 생성할 수 있는 버튼을 추가했습니다.

## [v1.1.11] - 2026-01-23

### Fixed (수정됨)
- **Promoted Customer Feature Sync (추진고객 특징 동기화 우선순위 수정)**
  - Fixed logic to prioritize "Customer Info - Features" (`feature`) over "Store Customer - Features" (`wantedFeature`) during both Push and Pull syncs.
    - 추진고객 동기화 시 '점포고객 정보'의 특징이 '고객 정보'의 특징을 덮어쓰던 문제를 수정했습니다. 이제 고객 정보의 특징을 최우선으로 표시합니다.
- **Real-time Property Card Sync (물건 카드 실시간 동기화)**
  - Added auto-refresh logic to `PropertyCard` when closing Customer/Business Card modals after editing.
    - 물건 카드에서 고객/명함 팝업을 열어 수정한 후 닫았을 때, 즉시 변경사항("6" 등)이 물건 카드 목록에 반영되도록 개선했습니다.
- **Table Layout & Truncation (테이블 레이아웃 및 텍스트 말줄임)**
  - **Property Card**: Fixed "Features" column width (150px) with ellipsis truncation to prevent indefinite table expansion.
    - 물건 카드의 추진고객 '특징' 컬럼 너비를 150px로 고정하고 말줄임표(...) 처리를 적용했습니다.
  - **Customer Card**: Fixed "Work History" layout.
    - Work Content (`내역`) column width fixed to 180px with ellipsis.
    - Worker (`작업자`) and Related Property (`관련물건`) columns forced to single-line display (`nowrap`).
    - 고객 카드의 작업 내역 컬럼을 180px로 고정하고, 작업자 및 관련 물건 컬럼이 줄바꿈 없이 한 줄로 나오도록 수정했습니다.

## [v1.1.10] - 2026-01-23

### Fixed (수정됨)
- **Dashboard API Call Logic (대시보드 호출 로직 수정)**
  - Fixed client-side logic to use `user.uid` (UUID) instead of `user.id` when fetching dashboard data.
    - 대시보드 데이터 요청 시 로그인 ID가 아닌 고유 식별자(UUID)를 사용하도록 수정하여, 회사 데이터 필터링이 정확하게 동작하도록 개선했습니다.

## [v1.1.9] - 2026-01-23

### Fixed (수정됨)
- **Dashboard Data Visibility (대시보드 데이터 미표시 수정)**
  - Fixed an issue where the "Total Customers" count was 0 for Admin users or when Company ID fallback failed.
    - 관리자(Admin) 계정 접속 시 특정 회사가 선택되지 않아 고객 수가 0명으로 뜨던 문제를 수정했습니다. 관리자는 이제 전체 통계를 볼 수 있습니다.
- **Dashboard Widget Layout (대시보드 위젯 레이아웃 수정)**
  - Fixed text overflow/wrapping issues in the "Scheduled Schedule" widget by removing detailed description text from the time column.
    - 예정된 일정 위젯에서 날짜(시간) 컬럼에 긴 설명글이 포함되어 레이아웃이 깨지던 현상을 수정했습니다.
- **Customer Card Date Format (고객카드 날짜 형식 수정)**
  - Fixed ISO Date string display (e.g., `2026-01-12T...`) in Work History and Promoted Properties tables.
    - 고객 작업내역 및 추진물건 목록에서 날짜가 읽기 어려운 형식으로 나오던 버그를 `YYYY-MM-DD (요일)` 형식으로 개선했습니다.

## [v1.1.8] - 2026-01-22

### Changed (변경됨)
- **Promoted Customer Sync (추진 고객 동기화 방식 원복)**
  - Reverted the "Real-time Query" approach back to **"Bidirectional Data Sync"** as per user request.
    - 추진 고객/명함 리스트를 실시간 조회하는 방식에서, 다시 **물건 데이터에 직접 저장(복사)하는 동기화 방식**으로 원복했습니다.
  - Restored logic in `customers/sync` and `business-cards/sync` to copy Promoted Data into `properties` table.
    - 동기화 버튼 클릭 시 추진 내역이 물건 상세 정보에 확실하게 저장되도록 로직을 복구했습니다.

### Fixed (수정됨)
- **PropertyCard Runtime Error (물건 상세 런타임 오류 수정)**
  - Fixed `id is not defined` error in `PropertyCard.tsx` by removing the unstable real-time fetch effect.
    - 실시간 조회 코드 제거를 통해 특정 상황에서 발생하던 앱 크래시(ID 참조 오류)를 해결했습니다.

## [v1.1.7] - 2026-01-22

### Added (추가됨)
- **Detailed Card Navigation (상세 카드 내비게이션)**
  - Added 'First', 'Prev', 'Next', 'Last' (`<<`, `<`, `>`, `>>`) buttons to the footer of Business, Customer, and Property Cards.
    - 명함, 고객, 점포 상세 카드 하단에 목록 이동 버튼을 추가하여 창을 닫지 않고 연속 열람이 가능해졌습니다.
  - Integration with List Filters: Navigation respects current search terms and active filters.
    - 현재 적용된 검색 및 필터 상태를 유지하며 목록 순서대로 이동합니다.
- **Property Data Schema (점포 데이터 스키마)**
  - Added `videoUrls` field (Array of Strings) to Property data structure.
    - 점포 상세 정보에 동영상 URL을 최대 6개까지 저장할 수 있는 필드를 추가했습니다 (기존 JSON 데이터 확장).
- **Property Related Videos (물건 관련 영상)**
  - Added a video input section to the 'Related Documents' tab in Property Card.
    - 관련문서 탭 하단에 유튜브 등 동영상 링크를 6개까지 등록하고 바로 열어볼 수 있는 섹션을 추가했습니다.

### Fixed (수정됨)
- **Business Card API Schema (명함 API 스키마 수정)**
  - Fixed an issue where `homePhone` (자택전화) was missing in the API response mapping.
    - 명함 상세 조회 시 자택전화 데이터가 누락되던 API 매핑 오류를 수정했습니다.

## [v1.1.6] - 2026-01-22

### Fixed (수정됨)
- **Customer Batch Upload Mappings (고객 일괄 업로드 매핑 수정)**
  - Fixed property type detection for 'Estate' (`부동산`) records by checking additional columns (`물건종류`, `분류`, `구분`).
    - '부동산' 분류가 `타겟타입` 외에 다른 컬럼(`물건종류` 등)에 있을 경우에도 정확히 인식하도록 수정했습니다.
  - Corrected column mappings for Deposit/Rent/Price/Yield across all property types (Building, Hotel, Apartment, Estate), adding robust fallbacks (e.g., checking `부동산_보증금` then `보증금`).
    - 빌딩, 호텔, 아파트, 부동산 등 모든 물건 종류에 대해 보증금/임대료/매매가/수익률 컬럼 매핑을 수정하고, 컬럼명 변형(예: `부동산_보증금` vs `보증금`)에 대한 예외 처리를 추가했습니다.
  - Resolved "Missing Data" issue where empty database columns (Store-specific) were overriding valid JSONB data for other property types.
    - 점포 외 물건(호텔 등)의 데이터가 빈 점포용 DB 컬럼 값으로 덮어씌워져 보이지 않던 문제를 해결했습니다.
  - Fixed 'NaN' error in Promoted Properties Price by stripping commas from the source Excel field.
    - 추진물건 금액의 쉼표(,)로 인해 `NaN` 오류가 발생하는 문제를 수정했습니다.

### Changed (변경됨)
- **Customer Card UI (고객 카드 UI 개선)**
  - **Unit Suffixes**: Added unit indicators (평, 층, 만원, %) inside input fields for all property types.
    - 모든 물건 종류의 입력 필드 내부에 단위(평, 층, 만원 등)를 표시하여 가독성을 높였습니다.
  - **Table Formatting**: Enforced single-line display for Date and Selection columns in History and Promoted Properties tables.
    - 고객 내역 및 추진물건 테이블의 날짜/선택 컬럼이 줄바꿈 없이 한 줄로 나오도록 고정했습니다.
  - **Promoted Properties Display**:
    - Truncated long Item Names with ellipsis and added hover tooltip.
      - 추진물건명이 길 경우 말줄임표(...)로 표시하고, 마우스 오버 시 전체 이름을 확인할 수 있게 했습니다.
    - Removed '万' suffix from Price display (numeric only).
      - 추진물건 금액 표시에서 "만" 글자를 제거하고 숫자만 표시하도록 변경했습니다.

## [v1.1.5] - 2026-01-21

### Added (추가됨)
- **Contract History Batch Upload (계약 내역 일괄 업로드)**
  - Support for uploading contract history via Excel (`store_contracts_v2.xlsx`) in the Property Upload Modal.
    - 매물 상세의 '계약' 탭에서 엑셀 파일로 계약 내역을 일괄 등록하는 기능을 추가했습니다.

### Changed (변경됨)
- **Customer Classification Input (고객 분류 입력 방식 변경)**
  - Changed the 'Classification' field in Customer Card from a dropdown to a text input for flexible entry.
    - 고객 카드의 '분류' 필드를 고정된 드롭다운(A/B/C 등)에서 자유롭게 입력 가능한 텍스트 필드로 변경했습니다.

### Fixed (수정됨)
- **Customer Search Scope (고객 검색 범위 수정)**
  - Fixed an issue where the "Add Customer" search would include customers from other companies when the property context was incomplete.
    - 매물 정보가 불완전할 때 타사 고객까지 검색되던 문제를 수정하여, 항상 로그인한 사용자의 회사 소속 고객만 조회되도록 조치했습니다.

## [v1.1.4] - 2026-01-21

### Added (추가됨)
- **Batch Upload Image Integration (일괄 업로드 사진 연동)**
  - Added "Photos Folder" upload support to the Batch Upload Modal.
    - 일괄 업로드 창에 '사진 저장 폴더' 선택 기능을 추가하여, 엑셀과 함께(또는 사진만 단독으로) 로컬 폴더의 사진을 매물에 자동 연동할 수 있게 되었습니다.
  - Implemented Server-side Proxy (`/api/upload`) to bypass client-side RLS restrictions for reliable uploads.
    - 클라이언트 권한 문제(RLS) 해결을 위해 서버 사이드 프록시 업로드 방식을 도입하여 안정성을 확보했습니다.

- **Consulting Report Integration (컨설팅 리포트 연동)**
  - Mapped Excel column `컨설팅리포트` to populate the "Consulting Proposal" field in the Report tab automatically.
    - 엑셀의 `컨설팅리포트` 컬럼이 리포트 탭의 제안서 작성란에 자동 매핑되도록 기능을 추가했습니다.

### Fixed (수정됨)
- **Revenue History Data Parsing (매출 내역 데이터 파싱)**
  - Fixed `TypeError` caused by unstructured Excel data in `revenueHistory`. Now parses list-type data correctly.
    - `revenueHistory` 데이터 구조 불일치로 인한 오류를 수정하고, 엑셀의 리스트형 매출 데이터를 차트/테이블에 맞게 파싱하도록 개선했습니다.

## [v1.1.1] - 2026-01-19

### Fixed (수정됨)
- **Business Card Manager Assignment Fix (명함카드 담당자 지정 오류 수정)**
  - Resolved "Unassigned" manager issue whereby managers were not displaying correctly in the Business Card modal.
    - 명함카드 모달에서 담당자가 "미지정"으로 표시되던 문제를 해결했습니다.
  - Implemented robust fallback logic to handle both Legacy IDs (Email/ID) and UUIDs for manager matching, ensuring compatibility with mixed data sources.
    - 기존 ID(이메일 등)와 UUID가 혼용된 데이터에서도 담당자를 정확히 인식하도록 매칭 로직을 개선했습니다.

## [v1.1.0] - 2026-01-16

### Added (추가됨)
- **Property Memo Tab (물건메모 탭 추가)**
  - Added a dedicated "Property Memo" section to both the Property Detail Card and fixed the New Property Registration page.
    - 점포 상세카드 및 신규등록 페이지에 독립적인 '물건메모' 섹션을 추가했습니다.
  - Added `memo` field to the global Data Schema (TypeScript Interface) for consistent storage.
    - 데이터 스키마(TypeScript Interface)에 `memo` 필드를 추가하여 데이터 일관성을 확보했습니다.

### Changed (변경됨)
- **Custom Category UI Refinement (업종 직접 입력 UI 개선)**
  - Integrated the "+ Direct Input" option directly into the Industry Detail dropdown.
    - '업종 소분류' 드롭다운 내부에 '+ 직접 입력' 옵션을 통합하여 UI 동선을 간소화했습니다.
  - Implemented a centered modal for adding new categories instead of an inline popover.
    - 업종 추가 시 인라인 팝오버 대신 화면 중앙 모달(알럿형) UI를 적용했습니다.
  - Improved category persistence logic: Newly added categories now appear correctly in the dropdown without text suffixes like "(사용자)".
    - 신규 추가된 업종이 즉시 드롭다운에 반영되도록 로직을 개선하고, 불필요한 접미사("(사용자)")를 제거했습니다.

### Fixed (수정됨)
- **Runtime TypeError Fix (런타임 오류 수정)**: Fixed `item.deposit.replace is not a function` error in the property list mobile view by adding proper type safety for numeric fields.
  - 물건 목록 모바일 뷰에서 숫자형 데이터 처리 시 발생하던 `item.deposit.replace` 런타임 오류를 수정했습니다.

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
