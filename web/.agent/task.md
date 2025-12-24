# Project Status and Tasks

## Completed Tasks
### Phase 1: Customer Contracts and Document Management (Completed)
- **Customer Contracts Tab**:
  - Implemented `PersonSelectorModal` to support both Customer and Business Card selection.
  - Developed "Promoted Customers" section:
    - Added ability to add customers/business cards.
    - Implemented visual classification badges.
    - Added "Budget" field with fallback display.
    - Integrated Schedule Sync: Automatically adds a blue `[추진등록]` event to the calendar upon addition.
  - Developed "Contract History" section:
    - Supported various contract types (Sale, Jeonse, Monthly, Yearly).
    - Made "Monthly Rent" (임대료) editable for all types.
    - Added fields for Deposit, Premium, and Contractor details.
    - Integrated Schedule Sync: Automatically adds a red `[계약]` event to the calendar upon addition.

- **Related Documents Tab**:
  - Added new `docs` tab to `PropertyCard`.
  - Implemented File Upload:
    - **limitation**: Max 10MB per file.
    - **feature**: Automatic uploader name tagging based on logged-in user.
  - Implemented Document List:
    - Displays file type icons (PDF, Excel, Word, Image, etc.).
    - Shows file size and upload date.
  - Implemented Delete functionality for selected documents.

## Upcoming Tasks
- (To be defined by user)
