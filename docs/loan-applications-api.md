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

All endpoints require `member` role (admin/super-admin/member).

---

## Endpoints

### 1. Create Loan Application

**POST** `/loan-applications`

Creates a new loan application with all required details. Initial status is set to `kyc_kyb_verification`.

#### Request Body

```typescript
{
  businessId: string;              // Required - ID of the selected business/SME
  entrepreneurId: string;          // Required - ID of the entrepreneur/business owner
  loanProductId: string;           // Required - ID of the selected loan product
  fundingAmount: number;           // Required - Amount requested (primary currency)
  fundingCurrency: string;         // Required - ISO currency code (e.g., "EUR", "USD", "KES")
  convertedAmount?: number;        // Optional - Converted amount in secondary currency
  convertedCurrency?: string;      // Optional - Secondary currency code
  exchangeRate?: number;           // Optional - Exchange rate used for conversion
  repaymentPeriod: number;         // Required - Preferred repayment period (in months)
  intendedUseOfFunds: string;      // Required - Description of intended use (max 100 characters)
  interestRate: number;            // Required - Interest rate per annum (percentage, e.g., 10 for 10%)
  loanSource?: string;             // Optional - Source of loan application (e.g., "Admin Platform", "SME Platform")
}
```

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
- Loan Product ID must reference an existing, active loan product
- Funding amount must be within the loan product's min/max amount range
- Repayment period must be within the loan product's min/max term range
- Currency must match the loan product currency
- Intended use of funds: max 100 characters

#### Error Responses

- `400 Bad Request`: Invalid request data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Business, entrepreneur, or loan product not found
- `500 Internal Server Error`: Server error

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
  loanTenure: number;              // Repayment period in months
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

- All endpoints require `member` role authorization
- All timestamps are in ISO 8601 format
- Pagination defaults: page=1, limit=20, max limit=100
- Search is case-insensitive
- Date filters support both predefined periods and custom date ranges
- Statistics percentage changes can be `undefined` if previous period had no data
