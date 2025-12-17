# API Requirements: Loan Applications

## Overview
This document outlines the API requirements for creating and listing loan applications. These APIs are essential for the loan applications listing page and creation modal functionality.

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

---

## 1. Create Loan Application

### Endpoint
**POST** `/loan-applications`

Creates a new loan application with all required details.

### Request Payload

```typescript
interface CreateLoanApplicationRequest {
  // Business/Entrepreneur Selection
  businessId: string;              // Required - ID of the selected business/SME
  entrepreneurId: string;          // Required - ID of the entrepreneur/business owner
  
  // Loan Product Selection
  loanProductId: string;           // Required - ID of the selected loan product
  
  // Funding Details
  fundingAmount: number;           // Required - Amount requested (primary currency)
  fundingCurrency: string;         // Required - ISO currency code (e.g., "EUR", "USD", "KES")
  convertedAmount?: number;        // Optional - Converted amount in secondary currency
  convertedCurrency?: string;      // Optional - Secondary currency code
  exchangeRate?: number;           // Optional - Exchange rate used for conversion (e.g., 150.90)
  
  // Repayment Terms
  repaymentPeriod: number;        // Required - Preferred repayment period (in months)
  
  // Additional Details
  intendedUseOfFunds: string;     // Required - Description of intended use (max 100 characters)
  interestRate: number;            // Required - Interest rate per annum (percentage, e.g., 10 for 10%)
  
  // Metadata
  loanSource?: string;            // Optional - Source of loan application (e.g., "Admin Platform", "SME Platform")
}
```

### Response

#### Success Response (201 Created)
```typescript
interface CreateLoanApplicationResponse {
  id: string;
  loanId: string;                 // Auto-generated loan application ID (e.g., "LN-48291")
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
  status: LoanApplicationStatus;   // Initial status (typically "kyc_kyb_verification")
  createdAt: string;              // ISO 8601 timestamp
  createdBy: string;               // User ID of the creator
  updatedAt: string;               // ISO 8601 timestamp
}

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

#### Error Response (400 Bad Request)
```typescript
interface ErrorResponse {
  error: string;
  message: string;
  details?: {
    field: string;
    message: string;
  }[];
}
```

### Validation Rules

1. **Business ID**: Must reference an existing business/SME
2. **Entrepreneur ID**: Must reference an existing entrepreneur and be associated with the business
3. **Loan Product ID**: Must reference an existing, active loan product
4. **Funding Amount**: Must be a positive number
5. **Funding Currency**: Must be a valid ISO 4217 currency code
6. **Repayment Period**: Must be a positive integer (typically 1-60 months)
7. **Intended Use of Funds**: Required, max 100 characters
8. **Interest Rate**: Must be a positive number (typically 0-100)
9. **Amount Validation**: If loan product has min/max amount constraints, funding amount must be within range
10. **Repayment Period Validation**: If loan product has min/max term constraints, repayment period must be within range

### Example Request

```json
{
  "businessId": "biz-001",
  "entrepreneurId": "ent-001",
  "loanProductId": "lp-001",
  "fundingAmount": 10000.00,
  "fundingCurrency": "EUR",
  "convertedAmount": 1509000.00,
  "convertedCurrency": "KES",
  "exchangeRate": 150.90,
  "repaymentPeriod": 3,
  "intendedUseOfFunds": "To purchase more solar panels for my business",
  "interestRate": 10,
  "loanSource": "Admin Platform"
}
```

### Example Response

```json
{
  "id": "la-001",
  "loanId": "LN-48291",
  "businessId": "biz-001",
  "entrepreneurId": "ent-001",
  "loanProductId": "lp-001",
  "fundingAmount": 10000.00,
  "fundingCurrency": "EUR",
  "convertedAmount": 1509000.00,
  "convertedCurrency": "KES",
  "exchangeRate": 150.90,
  "repaymentPeriod": 3,
  "intendedUseOfFunds": "To purchase more solar panels for my business",
  "interestRate": 10,
  "loanSource": "Admin Platform",
  "status": "kyc_kyb_verification",
  "createdAt": "2025-01-28T10:30:00.000Z",
  "createdBy": "user_123",
  "updatedAt": "2025-01-28T10:30:00.000Z"
}
```

---

## 2. Supporting APIs for Loan Application Creation

### 2.1. Search Businesses/SMEs

**Endpoint:** `GET /businesses/search` or `GET /admin/businesses/search`

**Purpose:** Search and select businesses/SMEs when creating a loan application. 

**Note:** There is an existing endpoint `GET /user-groups/:groupId/businesses/search` (documented in `docs/user-groups-business-search-api.md`) that provides business search functionality scoped to a user group. For loan application creation, we need a **general business search endpoint** that is **not scoped to a user group**. This should reuse the same search logic but return all eligible businesses.

**Query Parameters:**
- `search?: string` - Search by business name, owner email, owner first name, or owner last name
- `page?: number` - Page number (default: 1)
- `limit?: number` - Items per page (default: 20, max: 100)

**Response:**
```typescript
interface BusinessSearchResponse {
  success: boolean;
  message: string;
  data: BusinessSearchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BusinessSearchItem {
  id: string;
  name: string;
  description?: string | null;
  sector?: string | null;
  city?: string | null;
  country?: string | null;
  owner: {
    id: string;                    // This is the entrepreneurId
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}
```

**Example Request:**
```
GET /businesses/search?search=agribora&page=1&limit=20
```

**Example Response:**
```json
{
  "success": true,
  "message": "Businesses retrieved successfully",
  "data": [
    {
      "id": "biz-001",
      "name": "Agribora Ventures Limited",
      "description": "Agricultural products and services",
      "sector": "Agriculture",
      "city": "Kampala",
      "country": "Uganda",
      "owner": {
        "id": "ent-001",
        "firstName": "Alice",
        "lastName": "Johnson",
        "email": "alice.johnson@agribora.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Notes:**
- This endpoint should be **searchable** and **paginated**
- Search should match against business name, owner email, owner first name, and owner last name (same logic as user groups search)
- Results should be ordered by relevance or name alphabetically
- Should return businesses that are active/eligible for loan applications
- **Key difference from user groups endpoint**: This is a general search (not scoped to a group), so it doesn't need the `isAlreadyInGroup` field
- The `owner.id` field should be used as the `entrepreneurId` when creating the loan application

---

### 2.2. Search Loan Products

**Endpoint:** `GET /loan-products/search` or `GET /loan-products`

**Purpose:** Search and select loan products when creating a loan application. Loan products are paginated, so this needs to be a searchable, paginated endpoint.

**Query Parameters:**
- `search?: string` - Search by loan product name
- `page?: number` - Page number (default: 1)
- `limit?: number` - Items per page (default: 20, max: 100)
- `isActive?: boolean` - Filter by active status (default: true) - only show active products

**Response:**
```typescript
interface LoanProductSearchResponse {
  data: LoanProductItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LoanProductItem {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  organizationName?: string;  // Optional - resolved organization name
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  termUnit: 'days' | 'weeks' | 'months' | 'quarters' | 'years';
  isActive: boolean;
}
```

**Example Request:**
```
GET /loan-products/search?search=invoice&page=1&limit=20&isActive=true
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "lp-001",
      "name": "Invoice Discount Facility",
      "description": "Facility for discounting invoices",
      "organizationId": "org-001",
      "organizationName": "MK Green Facility (Ecobank)",
      "currency": "EUR",
      "minAmount": 5000,
      "maxAmount": 50000,
      "minTerm": 1,
      "maxTerm": 12,
      "termUnit": "months",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

**Notes:**
- This endpoint **MUST be searchable** and **paginated** (as loan products can be numerous)
- Search should match against loan product name
- Should only return active loan products by default
- Results should be ordered by name alphabetically or by relevance

---

## 3. List Loan Applications

### Endpoint
**GET** `/loan-applications`

Get a paginated, searchable, and filterable list of loan applications.

### Query Parameters

```typescript
interface ListLoanApplicationsQuery {
  // Pagination
  page?: number;                  // Default: 1
  limit?: number;                 // Default: 20, Max: 100
  
  // Search
  search?: string;                // Search across: loanId, businessName, applicant name, applicant email, loanProduct, loanSource
  
  // Filters
  status?: LoanApplicationStatus; // Filter by status
  loanProduct?: string;           // Filter by loan product name (case-insensitive exact match)
  loanSource?: string;            // Filter by loan source (case-insensitive exact match)
  
  // Date Filters
  applicationDate?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year';
  createdAtFrom?: string;         // ISO 8601 date string (YYYY-MM-DD)
  createdAtTo?: string;           // ISO 8601 date string (YYYY-MM-DD)
  
  // Sorting
  sortBy?: 'createdAt' | 'applicationNumber' | 'applicantName' | 'amount';
  sortOrder?: 'asc' | 'desc';     // Default: 'desc'
}
```

### Response

```typescript
interface ListLoanApplicationsResponse {
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

### Example Request

```
GET /loan-applications?page=1&limit=20&search=LN-48291&status=kyc_kyb_verification&sortBy=createdAt&sortOrder=desc
```

### Example Response

```json
{
  "data": [
    {
      "id": "la-001",
      "loanId": "LN-48291",
      "loanSource": "SME Platform",
      "businessName": "DMA Limited",
      "entrepreneurId": "ent-001",
      "businessId": "biz-001",
      "applicant": {
        "name": "Robert Mugabe",
        "email": "robert.mugabe@gmail.com",
        "phone": "+255712345678"
      },
      "loanProduct": "LPO Financing",
      "loanProductId": "lp-001",
      "loanRequested": 50000,
      "loanCurrency": "EUR",
      "loanTenure": 3,
      "status": "kyc_kyb_verification",
      "createdAt": "2025-01-28T10:30:00.000Z",
      "createdBy": "Robert Mugabe",
      "lastUpdated": "2025-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Filtering Logic

1. **Search**: Case-insensitive search across:
   - `loanId` (exact or partial match)
   - `businessName` (partial match)
   - `applicant.name` (partial match)
   - `applicant.email` (partial match)
   - `loanProduct` (partial match)
   - `loanSource` (partial match)

2. **Status Filter**: Exact match on status field

3. **Loan Product Filter**: Case-insensitive exact match on loan product name

4. **Loan Source Filter**: Case-insensitive exact match on loan source

5. **Date Filters**:
   - `today`: Applications created today
   - `this_week`: Applications created in the last 7 days
   - `this_month`: Applications created in the current month
   - `last_month`: Applications created in the previous month
   - `this_year`: Applications created in the current year
   - `createdAtFrom` / `createdAtTo`: Custom date range (ISO 8601 format: YYYY-MM-DD)

6. **Sorting**: 
   - `createdAt`: Sort by creation timestamp
   - `applicationNumber`: Sort by loanId alphabetically
   - `applicantName`: Sort by applicant name alphabetically
   - `amount`: Sort by loanRequested amount

### Notes

- All filters can be combined (AND logic)
- Search is applied across multiple fields (OR logic within search)
- Default sort: `createdAt` descending (newest first)
- Results should be paginated for performance
- Empty search string should return all results (no search filter applied)

---

## 4. Loan Application Statistics

### Endpoint
**GET** `/loan-applications/stats`

Get aggregated statistics for loan applications dashboard.

### Query Parameters

Optional filters (same as list endpoint):
- `status?: LoanApplicationStatus`
- `loanProduct?: string`
- `loanSource?: string`
- `applicationDate?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year'`
- `createdAtFrom?: string`
- `createdAtTo?: string`

### Response

```typescript
interface LoanApplicationStatsResponse {
  totalApplications: number;
  totalAmount: number;                    // Sum of all loanRequested amounts
  averageAmount: number;                  // Average loanRequested amount
  pendingApproval: number;               // Count of applications in pending states
  approved: number;                       // Count of approved applications
  rejected: number;                       // Count of rejected applications
  disbursed: number;                     // Count of disbursed applications
  cancelled: number;                     // Count of cancelled applications
  
  // Percentage changes (compared to previous period)
  totalApplicationsChange?: number;        // Percentage change (e.g., 15.5 for +15.5%)
  totalAmountChange?: number;            // Percentage change
  pendingApprovalChange?: number;        // Percentage change
  approvedChange?: number;                // Percentage change
  rejectedChange?: number;                // Percentage change
  disbursedChange?: number;              // Percentage change
  cancelledChange?: number;              // Percentage change
}
```

### Example Request

```
GET /loan-applications/stats
```

### Example Response

```json
{
  "totalApplications": 1250,
  "totalAmount": 12500000.00,
  "averageAmount": 10000.00,
  "pendingApproval": 450,
  "approved": 320,
  "rejected": 180,
  "disbursed": 250,
  "cancelled": 50,
  "totalApplicationsChange": 15.5,
  "totalAmountChange": 22.3,
  "pendingApprovalChange": 8.2,
  "approvedChange": 12.5,
  "rejectedChange": -5.3,
  "disbursedChange": 18.7,
  "cancelledChange": -2.1
}
```

### Notes

- Statistics should be calculated based on current filter parameters (if provided)
- Percentage changes compare current period to previous equivalent period (e.g., this month vs last month)
- All amounts should be in the same currency or provide currency breakdown if needed
- Stats should be calculated efficiently (consider caching for large datasets)

---

## Error Handling

All endpoints should return appropriate HTTP status codes:

- **200 OK**: Successful GET request
- **201 Created**: Successful POST request (create)
- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

Error response format:
```typescript
interface ErrorResponse {
  error: string;                    // Error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
  message: string;                  // Human-readable error message
  details?: {                       // Optional field-level errors
    field: string;
    message: string;
  }[];
}
```

---

## Implementation Notes

### Field Mappings (UI → API)

1. **Create Loan Application Modal**:
   - `selectedBusiness.id` → `businessId`
   - `selectedBusiness.id.replace("biz-", "ent-")` → `entrepreneurId` (or use actual relationship)
   - `selectedLoanProduct.id` → `loanProductId`
   - `fundingAmount` (string) → `fundingAmount` (number)
   - `fundingCurrency` → `fundingCurrency`
   - `repaymentPeriod` (string) → `repaymentPeriod` (number)
   - `intendedUse` → `intendedUseOfFunds`
   - `interestRate` (string) → `interestRate` (number)

2. **List Loan Applications**:
   - Tab filters map to status filters:
     - "All" → No status filter
     - "Approved" → `status=approved`
     - "Pending Approval" → `status=kyc_kyb_verification` (or multiple pending statuses)
     - "Rejected" → `status=rejected`
     - "Disbursed" → `status=disbursed`
     - "Cancelled" → `status=cancelled`

### Future Requirements

1. **Loan Product Search API**: Must support pagination and search (as noted in modal requirements)
2. **Business Search API**: Should reuse existing business search logic from user groups
3. **Detail Page APIs**: Will be documented separately for loan application detail page functionality

### Performance Considerations

- List endpoint should support pagination (default limit: 20)
- Search should be optimized with proper indexing
- Stats endpoint may benefit from caching for frequently accessed data
- Consider implementing rate limiting for search endpoints
