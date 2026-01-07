# Loan Applications API

## Base URL
```
Development: http://localhost:8081
Production: {API_URL from environment}
```

## Authentication
All endpoints require authentication via Clerk Bearer token in the Authorization header:
```
Authorization: Bearer <clerk_session_token>
```

### Authorization by Endpoint

- **Create Loan Application** (`POST /loan-applications`): 
  - ✅ **Admins/Members**: Can create applications for any business/entrepreneur
  - ✅ **Entrepreneurs**: Can create applications only for themselves (automatically uses their business profile)
  
- **List, Get, Stats, Timeline, Update Status**: 
  - ✅ **Admins/Members**: Full access to all applications
  - ✅ **Entrepreneurs**: Can only access their own applications (where they are the entrepreneur)

---

## Endpoints

### 1. Create Loan Application

**POST** `/loan-applications`

Creates a new loan application with all required details. Initial status is set to `kyc_kyb_verification`.

**Accessible to**: Admins/Members (can create for any business) OR Entrepreneurs (can only create for themselves)

#### Request Body

```typescript
{
  businessId?: string;             // Optional - Required for admins, auto-set for entrepreneurs
                                   // If provided by entrepreneur, must match their business
  entrepreneurId?: string;         // Optional - Required for admins, auto-set for entrepreneurs
                                   // If provided by entrepreneur, must match their user ID
  loanProductId: string;           // Required - ID of the selected loan product
  fundingAmount: number;           // Required - Amount requested (primary currency)
  fundingCurrency: string;         // Required - ISO currency code (e.g., "EUR", "USD", "KES")
  convertedAmount?: number;        // Optional - Converted amount in secondary currency
  convertedCurrency?: string;      // Optional - Secondary currency code
  exchangeRate?: number;           // Optional - Exchange rate used for conversion
  repaymentPeriod: number;         // Required - Preferred repayment period (unit must match loan product's termUnit: days, weeks, months, quarters, or years)
  intendedUseOfFunds: string;      // Required - Description of intended use (max 100 characters)
  interestRate: number;            // Required - Interest rate per annum (percentage, e.g., 10 for 10%)
  loanSource?: string;             // Optional - Auto-set to "SME Platform" for entrepreneurs, "Admin Platform" for admins
}
```

#### Behavior by User Type

**For Entrepreneurs:**
- `entrepreneurId` is automatically set to the authenticated user's ID
- `businessId` is automatically set to the entrepreneur's business profile ID
- `loanSource` is automatically set to "SME Platform" (cannot be overridden)
- Must have a valid business profile to create applications
- Cannot create applications for other entrepreneurs
- If `entrepreneurId` or `businessId` are provided, they must match the entrepreneur's own ID/business

**For Admins/Members:**
- Full control over `businessId` and `entrepreneurId`
- `loanSource` defaults to "Admin Platform" if not specified
- Can create applications for any business/entrepreneur

#### Response (201 Created)

```typescript
{
  id: string;
  loanId: string;                  // Auto-generated loan application ID (e.g., "LN-48291")
  businessId: string;
  entrepreneurId: string;
  loanProductId: string;
  fundingAmount: number;
  fundingCurrency: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  exchangeRate?: number;
  repaymentPeriod: number;
  intendedUseOfFunds: string;
  interestRate: number;
  loanSource: string;
  status: LoanApplicationStatus;   // Initial status: "kyc_kyb_verification"
  createdAt: string;               // ISO 8601 timestamp
  createdBy: string;               // User ID of the creator
  updatedAt: string;               // ISO 8601 timestamp
}
```

#### Validation Rules

- Business ID must reference an existing business/SME
- Entrepreneur ID must reference an existing entrepreneur and be associated with the business
- **For Entrepreneurs**: Must have a valid business profile associated with their account
- **For Entrepreneurs**: Cannot create applications for other users (entrepreneurId must match authenticated user)
- Loan Product ID must reference an existing, active loan product
- Funding amount must be within the loan product's min/max amount range
- Repayment period must be within the loan product's min/max term range (unit must match the loan product's termUnit: days, weeks, months, quarters, or years)
- Currency must match the loan product currency
- Intended use of funds: max 100 characters

#### Error Responses

- `400 Bad Request`: Invalid request data or validation errors
  - Missing business profile (for entrepreneurs)
  - Invalid entrepreneur/business combination
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Entrepreneur attempting to create application for another user
- `404 Not Found`: Business, entrepreneur, or loan product not found
- `500 Internal Server Error`: Server error

#### Example Requests

**Entrepreneur creating their own application:**
```json
{
  "loanProductId": "prod_123",
  "fundingAmount": 50000,
  "fundingCurrency": "KES",
  "repaymentPeriod": 12,
  "intendedUseOfFunds": "Expanding production capacity",
  "interestRate": 10
}
```
Note: `businessId` and `entrepreneurId` are automatically set, `loanSource` is set to "SME Platform"

**Admin creating application for an entrepreneur:**
```json
{
  "businessId": "biz_456",
  "entrepreneurId": "user_789",
  "loanProductId": "prod_123",
  "fundingAmount": 100000,
  "fundingCurrency": "KES",
  "repaymentPeriod": 24,
  "intendedUseOfFunds": "Working capital for inventory",
  "interestRate": 12,
  "loanSource": "Admin Platform"
}
```

---

### 2. List Loan Applications

**GET** `/loan-applications`

Retrieves a paginated, searchable, and filterable list of loan applications.

#### Query Parameters

```typescript
{
  // Pagination
  page?: string;                  // Default: 1
  limit?: string;                 // Default: 20, Max: 100
  
  // Search
  search?: string;                // Search across: loanId, businessName, applicant name, applicant email, loanProduct, loanSource
  
  // Filters
  status?: LoanApplicationStatus;  // Filter by status
  loanProduct?: string;            // Filter by loan product name (case-insensitive exact match)
  loanSource?: string;             // Filter by loan source (case-insensitive exact match)
  
  // Date Filters
  applicationDate?: "today" | "this_week" | "this_month" | "last_month" | "this_year";
  createdAtFrom?: string;          // ISO 8601 date string (YYYY-MM-DD)
  createdAtTo?: string;           // ISO 8601 date string (YYYY-MM-DD)
  
  // Sorting
  sortBy?: "createdAt" | "applicationNumber" | "applicantName" | "amount";
  sortOrder?: "asc" | "desc";     // Default: "desc"
}
```

#### Response (200 OK)

```typescript
{
  data: LoanApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LoanApplication {
  id: string;
  loanId: string;                 // Display ID (e.g., "LN-48291")
  loanSource: string;
  businessName: string;
  entrepreneurId: string;          // Required for navigation
  businessId: string;              // Required for navigation
  applicant: {
    name: string;                  // Full name of entrepreneur/business owner
    email: string;
    phone: string;
    avatar?: string;
  };
  loanProduct: string;             // Loan product name
  loanProductId: string;           // Loan product ID
  loanRequested: number;           // Funding amount
  loanCurrency: string;            // Currency of loanRequested
  loanTenure: number;              // Repayment period (unit matches loan product's termUnit)
  status: LoanApplicationStatus;
  createdAt: string;               // ISO 8601 timestamp
  createdBy: string;               // Creator name or ID
  lastUpdated: string;             // ISO 8601 timestamp
}
```

#### Filtering Logic

- **Search**: Case-insensitive search across loanId, businessName, applicant name, applicant email, loanProduct, loanSource
- **Status Filter**: Exact match on status field
- **Loan Product Filter**: Case-insensitive exact match on loan product name
- **Loan Source Filter**: Case-insensitive exact match on loan source
- **Date Filters**: Supports predefined periods (today, this_week, etc.) or custom date ranges
- **Sorting**: Default sort by `createdAt` descending (newest first)

#### Error Responses

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

---

### 3. Get Loan Application Statistics

**GET** `/loan-applications/stats`

Get aggregated statistics for loan applications dashboard. Supports the same filters as the list endpoint.

#### Query Parameters

```typescript
{
  // Filters (same as list endpoint)
  status?: LoanApplicationStatus;
  loanProduct?: string;
  loanSource?: string;
  applicationDate?: "today" | "this_week" | "this_month" | "last_month" | "this_year";
  createdAtFrom?: string;          // ISO 8601 date string (YYYY-MM-DD)
  createdAtTo?: string;           // ISO 8601 date string (YYYY-MM-DD)
}
```

#### Response (200 OK)

```typescript
{
  totalApplications: number;
  totalAmount: number;                    // Sum of all loanRequested amounts
  averageAmount: number;                  // Average loanRequested amount
  pendingApproval: number;               // Count of applications in pending states
  approved: number;                       // Count of approved applications
  rejected: number;                       // Count of rejected applications
  disbursed: number;                     // Count of disbursed applications
  cancelled: number;                     // Count of cancelled applications
  
  // Percentage changes (compared to previous period)
  totalApplicationsChange?: number;      // Percentage change (e.g., 15.5 for +15.5%)
  totalAmountChange?: number;            // Percentage change
  pendingApprovalChange?: number;        // Percentage change
  approvedChange?: number;               // Percentage change
  rejectedChange?: number;              // Percentage change
  disbursedChange?: number;              // Percentage change
  cancelledChange?: number;             // Percentage change
}
```

#### Notes

- Statistics are calculated based on current filter parameters (if provided)
- Percentage changes compare current period to previous equivalent period (e.g., this month vs last month)
- If no date filter is provided, defaults to comparing this month vs last month

#### Error Responses

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

---

### 4. Search Loan Products

**GET** `/loan-products/search`

Simplified search endpoint for loan products, optimized for loan application creation. Returns only active products by default.

#### Query Parameters

```typescript
{
  search?: string;                // Search by loan product name
  page?: string;                  // Page number (default: 1)
  limit?: string;                 // Items per page (default: 20, max: 100)
  isActive?: "true" | "false";    // Filter by active status (default: "true")
}
```

#### Response (200 OK)

```typescript
{
  data: LoanProductSearchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LoanProductSearchItem {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  termUnit: "days" | "weeks" | "months" | "quarters" | "years";
  isActive: boolean;
}
```

#### Notes

- Defaults to `isActive=true` and `status=active` (only active products)
- Results are sorted by name alphabetically (ascending)
- Search matches against loan product name
- This endpoint is optimized for loan application creation workflows

#### Error Responses

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

---

### 5. Get Loan Application by ID

**GET** `/loan-applications/:id`

Retrieves a specific loan application by its ID with all related data.

#### Path Parameters

```typescript
{
  id: string; // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  // Core application data
  id: string;
  loanId: string;                  // Display ID (e.g., "LN-48291")
  businessId: string;
  entrepreneurId: string;
  loanProductId: string;
  
  // Funding details
  fundingAmount: number;
  fundingCurrency: string;
  convertedAmount?: number;         // Optional - if currency conversion was done
  convertedCurrency?: string;      // Optional
  exchangeRate?: number;           // Optional
  
  // Terms
    repaymentPeriod: number;         // Unit matches loan product's termUnit (days, weeks, months, quarters, or years)
  interestRate: number;            // percentage (e.g., 10 for 10%)
  intendedUseOfFunds: string;
  
  // Metadata
  loanSource: string;
  status: LoanApplicationStatus;
  
  // Timeline (optional - only set when status changes)
  submittedAt?: string;            // ISO 8601 timestamp
  approvedAt?: string;             // ISO 8601 timestamp
  rejectedAt?: string;             // ISO 8601 timestamp
  disbursedAt?: string;            // ISO 8601 timestamp
  cancelledAt?: string;            // ISO 8601 timestamp
  rejectionReason?: string;       // Only present if rejected
  
  // Audit fields
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
  lastUpdatedAt?: string;         // ISO 8601 timestamp
  createdBy: string;               // User ID
  lastUpdatedBy?: string;          // User ID
  
  // Convenience fields (for easy frontend access)
  businessName: string;            // Business name
  sector?: string | null;          // Business sector
  applicantName: string;            // Full name of entrepreneur/applicant
  organizationName: string;        // Name of organization providing the loan
  creatorName: string;             // Full name of creator
  
  // Related data - Business
  business: {
    id: string;
    name: string;
    description?: string | null;
    sector?: string | null;
    country?: string | null;
    city?: string | null;
  };
  
  // Related data - Entrepreneur
  entrepreneur: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phoneNumber?: string | null;
    imageUrl?: string | null;
  };
  
  // Related data - Loan Product
  loanProduct: {
    id: string;
    name: string;
    currency: string;
    minAmount: number;
    maxAmount: number;
  };
  
  // Related data - Creator
  creator: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  
  // Related data - Last Updated By (optional)
  lastUpdatedByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}
```

#### Notes

- All timestamps are in ISO 8601 format
- Timeline fields (`submittedAt`, `approvedAt`, etc.) are only present when the corresponding status change occurred
- `rejectionReason` is only present if the application was rejected
- `lastUpdatedByUser` is only present if the application was updated by a different user than the creator
- Related data (business, entrepreneur, loanProduct, creator) is always included
- Optional fields in nested objects may be `null` or `undefined`

#### Error Responses

- `400 Bad Request`: Invalid ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Loan application or related entity not found
- `500 Internal Server Error`: Server error

---

### 6. Update Loan Application Status

**PUT** `/loan-applications/:id/status`

Updates the status of a loan application with validation, timestamp updates, and automatic audit trail logging.

#### Path Parameters

```typescript
{
  id: string; // Loan application ID
}
```

#### Request Body

```typescript
{
  status: LoanApplicationStatus;  // Required - New status to set
  reason?: string;                 // Optional - Reason for the status change (max 500 characters)
  rejectionReason?: string;         // Required if status = "rejected" - Reason for rejection (max 1000 characters)
}
```

#### Response (200 OK)

Returns the updated loan application detail (same format as `GET /loan-applications/:id`).

#### Business Logic

- **Status Validation**: 
  - Cannot change status if it's already set to the same value
  - Cannot change status from terminal states (`approved`, `rejected`, `disbursed`, `cancelled`)
  - Rejection reason is required when status is set to `rejected`

- **Automatic Timestamp Updates**:
  - Sets `approvedAt` when status changes to `approved`
  - Sets `rejectedAt` when status changes to `rejected`
  - Sets `disbursedAt` when status changes to `disbursed`
  - Sets `cancelledAt` when status changes to `cancelled`

- **Audit Trail**: Automatically logs the status change to the audit trail with:
  - Event type mapped from status
  - Title and description
  - Previous and new status
  - User who performed the change
  - Timestamp
  - Request metadata (IP address, user agent)

#### Example Request

```json
{
  "status": "approved",
  "reason": "Application meets all requirements and has been approved by the committee"
}
```

```json
{
  "status": "rejected",
  "rejectionReason": "Credit score below minimum threshold",
  "reason": "Application rejected after credit analysis"
}
```

```json
{
  "status": "credit_analysis",
  "reason": "Moving to credit analysis phase"
}
```

#### Error Responses

- `400 Bad Request`: 
  - Invalid status transition
  - Status already set to requested value
  - Missing rejection reason when status is "rejected"
  - Attempting to change from terminal state
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

#### Notes

- Only users with `member` role (admin/super-admin/member) can update loan application status
- Status changes are automatically logged to the audit trail
- The timeline endpoint (`GET /loan-applications/:id/timeline`) will show all status changes
- Terminal states (`approved`, `rejected`, `disbursed`, `cancelled`) cannot be changed once set

---

## 7. Cancel Loan Application

### 7.1 Cancel My Loan Application (Entrepreneurs)

**POST** `/loan-applications/my-applications/:id/cancel`

Cancels a loan application that is in a pending status. Only accessible to entrepreneurs for their own applications.

**Accessible to**: Entrepreneurs (can only cancel their own applications)

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Request Body

```typescript
{
  reason?: string;  // Optional - Reason for cancellation (max 500 characters)
}
```

#### Response (200 OK)

Returns the updated loan application detail (same format as `GET /loan-applications/:id`).

#### Business Logic

- **Status Validation**: 
  - Only applications in pending statuses can be cancelled
  - Pending statuses: `kyc_kyb_verification`, `eligibility_check`, `credit_analysis`, `head_of_credit_review`, `internal_approval_ceo`, `committee_decision`, `sme_offer_approval`, `document_generation`, `signing_execution`, `awaiting_disbursement`
  - Cannot cancel applications that are already in terminal states (`approved`, `rejected`, `disbursed`, `cancelled`)
  - Cannot cancel an application that is already cancelled

- **Authorization**: 
  - Entrepreneurs can only cancel their own applications
  - The application's `entrepreneurId` must match the authenticated user's ID

- **Automatic Updates**:
  - Sets status to `cancelled`
  - Sets `cancelledAt` timestamp
  - Clears `rejectionReason` if it exists
  - Updates `lastUpdatedBy` and `lastUpdatedAt`

- **Audit Trail**: Automatically logs the cancellation to the audit trail with:
  - Event type: `cancelled`
  - Title and description (includes reason if provided)
  - Previous and new status
  - User who performed the cancellation
  - Timestamp
  - Request metadata (IP address, user agent)

#### Example Request

```json
{
  "reason": "Found a better loan product elsewhere"
}
```

#### Error Responses

- `400 Bad Request`: 
  - Application is already cancelled
  - Application is in a terminal state (cannot be cancelled)
  - Application status is not in pending stages
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

---

### 7.2 Cancel Loan Application (Admins/Members)

**POST** `/loan-applications/:id/cancel`

Cancels a loan application that is in a pending status. Accessible to admins/members for any application.

**Accessible to**: Admins/Members (can cancel any application)

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Request Body

```typescript
{
  reason?: string;  // Optional - Reason for cancellation (max 500 characters)
}
```

#### Response (200 OK)

Returns the updated loan application detail (same format as `GET /loan-applications/:id`).

#### Business Logic

- **Status Validation**: 
  - Only applications in pending statuses can be cancelled
  - Pending statuses: `kyc_kyb_verification`, `eligibility_check`, `credit_analysis`, `head_of_credit_review`, `internal_approval_ceo`, `committee_decision`, `sme_offer_approval`, `document_generation`, `signing_execution`, `awaiting_disbursement`
  - Cannot cancel applications that are already in terminal states (`approved`, `rejected`, `disbursed`, `cancelled`)
  - Cannot cancel an application that is already cancelled

- **Authorization**: 
  - Admins/Members can cancel any application

- **Automatic Updates**:
  - Sets status to `cancelled`
  - Sets `cancelledAt` timestamp
  - Clears `rejectionReason` if it exists
  - Updates `lastUpdatedBy` and `lastUpdatedAt`

- **Audit Trail**: Automatically logs the cancellation to the audit trail with:
  - Event type: `cancelled`
  - Title and description (includes reason if provided)
  - Previous and new status
  - User who performed the cancellation
  - Timestamp
  - Request metadata (IP address, user agent)

#### Example Request

```json
{
  "reason": "Applicant requested cancellation"
}
```

#### Error Responses

- `400 Bad Request`: 
  - Application is already cancelled
  - Application is in a terminal state (cannot be cancelled)
  - Application status is not in pending stages
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

#### Notes

- Both endpoints (`/my-applications/:id/cancel` for entrepreneurs and `/:id/cancel` for admins) have the same business logic for status validation
- Cancellations are automatically logged to the audit trail
- The timeline endpoint (`GET /loan-applications/:id/timeline`) will show the cancellation event
- Once cancelled, an application cannot be uncancelled or changed to another status

---

## Loan Application Status Values

```typescript
type LoanApplicationStatus =
  | "kyc_kyb_verification"
  | "eligibility_check"
  | "credit_analysis"
  | "head_of_credit_review"
  | "internal_approval_ceo"
  | "committee_decision"
  | "sme_offer_approval"
  | "document_generation"
  | "signing_execution"
  | "awaiting_disbursement"
  | "approved"
  | "rejected"
  | "disbursed"
  | "cancelled";
```

---

## Error Response Format

All error responses follow this format:

```typescript
{
  error: string;                  // Error message
  code: string;                   // Error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
}
```

---

## Notes

- **Authorization**: 
  - Create endpoint is accessible to both admins/members and entrepreneurs
  - Cancel endpoint is accessible to both admins/members and entrepreneurs (entrepreneurs can only cancel their own)
  - Other endpoints (list, get, stats, timeline, update status) require `member` role (admin/super-admin/member)
  - Entrepreneurs can access timeline for their own applications
- All timestamps are in ISO 8601 format
- Pagination defaults: page=1, limit=20, max limit=100
- Search is case-insensitive
- Date filters support both predefined periods and custom date ranges
- Statistics percentage changes can be `undefined` if previous period had no data
- For entrepreneurs: `businessId` and `entrepreneurId` are automatically set based on their profile
- `loanSource` is automatically set: "SME Platform" for entrepreneurs, "Admin Platform" for admins
