# Changelog

All notable changes to this project will be documented in this file.

## [v1.0.0] - 2026-01-16

### Added
- **Customer Management System Upgrade**
  - **Excel Batch Upload**: Support for uploading 3 files (Main, Promoted, History) to bulk create/update customers.
  - **DB Sync**: Synchronization between Customer History and Calendar Schedules.
  - **Bidirectional Sync (Customer)**: Automatic linking of Customer Work History to Properties; adds history to Property records.
  - **Bidirectional Sync (Business Card)**: Automatic linking of Business Card Work History to Properties; adds history to Property records.
  - **New Data Fields**: Added store-specific fields (Wanted Area, Deposit, Rent Ranges, etc.) and `progressSteps`.

### Changed
- **Mobile Support Improvements**:
  - Enhanced responsive layout for Customer List and Modals.
  - Fixed drawer resizing and mobile visibility.
- **Data Integrity**:
  - Improved fuzzy search (`ilike`) -> reverted to Strict Search (`eq`) for Property linking safety as per user request.
  - Corrected database column mapping for `work_date` and `worker_name`.
  - Added robust null-safety checks for list rendering to prevent Application Errors on empty data fields.

### Fixed
- **Application Error (Crash)**: Fixed client-side exception caused by null array fields (`progressSteps`, etc.) in the customer list.
- **Sync Logic**: Fixed issue where re-syncing would fail or not update property history if `targetId` was missing.
- **UI Interaction**: Fixed event bubbling issue where clicking a related property link would simultaneously open the edit modal.
