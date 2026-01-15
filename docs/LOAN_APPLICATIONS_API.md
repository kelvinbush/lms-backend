# Loan Applications API Documentation

## Overview

The loan applications API manages the entire lifecycle of loan applications, from creation through approval, disbursement, and cancellation. This is the core API for loan management workflows.

## Authentication & Authorization

Different endpoints have different authorization requirements:

- **Entrepreneurs**: Can create applications for themselves, view their own applications, and cancel pending applications
- **Admins/Members**: Full access to all applications, can create for any business, and can perform all operations
- **Super Admins**: All admin/member permissions plus additional system-level operations

## Base URL
```
/api/loan-applications
```

## Common Response Patterns

### Success Response
```typescript
interface SuccessResponse<T> {
  // Most endpoints return the specific type directly
  // Some wrap in pagination objects
}
```

### Error Response
```typescript
interface ErrorResponse {
  error: string; // Human-readable error message
  code: string; // Machine-readable error code
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created (for POST operations)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Endpoints

### 1. Create Loan Application

**Endpoint**: `POST /`

**Authorization**: Admin/Member OR Entrepreneur

**Request Body**:
```typescript
interface CreateLoanApplicationBody {
  businessId?: string; // Optional for entrepreneurs, required for admins
  entrepreneurId?: string; // Optional for entrepreneurs, required for admins
  loanProductId: string; // Required
  fundingAmount: number; // Required
  fundingCurrency: string; // Required - ISO currency code
  convertedAmount?: number; // Optional
  convertedCurrency?: string; // Optional
  exchangeRate?: number; // Optional
  repaymentPeriod: number; // Required
  intendedUseOfFunds: string; // Required - max 100 chars
  interestRate: number; // Required - percentage
  loanSource?: string; // Optional
}
```

**Response**:
```typescript
interface CreateLoanApplicationResponse {
  id: string;
  loanId: string; // Auto-generated (e.g., "LN-48291")
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
  status: LoanApplicationStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}
```

### 2. List Loan Applications

**Endpoint**: `GET /`

**Authorization**: Any authenticated user

**Query Parameters**:
```typescript
interface ListLoanApplicationsQuery {
  // Pagination
  page?: string; // Default: "1"
  limit?: string; // Default: "20", Max: "100"
  
  // Search
  search?: string; // Searches across: loanId, businessName, applicant name, email, loanProduct, loanSource
  
  // Filters
  status?: string; // Loan application status
  businessId?: string; // Business ID
  entrepreneurId?: string; // Entrepreneur user ID
  loanProductId?: string; // Loan product ID
  createdBy?: string; // Creator user ID
  dateFrom?: string; // ISO date filter
  dateTo?: string; // ISO date filter
  sortBy?: string; // Field to sort by
  sortOrder?: "asc" | "desc"; // Default: "desc"
}
```

**Response**:
```typescript
interface ListLoanApplicationsResponse {
  applications: LoanApplicationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface LoanApplicationSummary {
  id: string;
  loanId: string;
  businessId: string;
  businessName: string;
  entrepreneurId: string;
  entrepreneurName: string;
  entrepreneurEmail: string;
  loanProductId: string;
  loanProductName: string;
  fundingAmount: number;
  fundingCurrency: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  repaymentPeriod: number;
  intendedUseOfFunds: string;
  interestRate: number;
  status: LoanApplicationStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy?: string;
}
```

### 3. Get Loan Application Details

**Endpoint**: `GET /:id`

**Authorization**: Any authenticated user (with ownership/permission checks)

**Parameters**:
- `id` (path, required): Loan application ID

**Response**:
```typescript
interface LoanApplicationDetail {
  // All fields from LoanApplicationSummary plus:
  businessDetails?: BusinessDetails;
  entrepreneurDetails?: EntrepreneurDetails;
  loanProductDetails?: LoanProductDetails;
  documents?: ApplicationDocuments;
  timeline?: TimelineEvent[];
  auditTrail?: AuditTrailEntry[];
  fees?: LoanFee[];
  offerLetter?: OfferLetter;
  snapshots?: ApplicationSnapshot[];
}
```

### 4. Update Loan Application

**Endpoint**: `PATCH /:id`

**Authorization**: Admin/Member OR Entrepreneur (own applications only, and only in certain statuses)

**Request Body**:
```typescript
interface UpdateLoanApplicationBody {
  fundingAmount?: number;
  fundingCurrency?: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  exchangeRate?: number;
  repaymentPeriod?: number;
  intendedUseOfFunds?: string;
  interestRate?: number;
}
```

**Response**: Updated `LoanApplicationDetail`

### 5. Cancel Loan Application

**Endpoint**: `POST /:id/cancel`

**Authorization**: Admin/Member OR Entrepreneur (own applications only)

**Request Body**:
```typescript
interface CancelLoanApplicationBody {
  reason?: string; // Optional cancellation reason
}
```

**Response**: Updated `LoanApplicationDetail`

### 6. Get Loan Application Timeline

**Endpoint**: `GET /:id/timeline`

**Authorization**: Admin/Member OR Entrepreneur (own applications only)

**Response**:
```typescript
interface TimelineEvent {
  id: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  status?: LoanApplicationStatus;
  previousStatus?: LoanApplicationStatus;
  newStatus?: LoanApplicationStatus;
  createdAt: string;
  createdBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  details?: Record<string, any>;
}
```

### 7. Get Loan Application Statistics

**Endpoint**: `GET /stats`

**Authorization**: Admin/Member

**Query Parameters**:
```typescript
interface StatsQuery {
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  businessId?: string;
  status?: string;
}
```

**Response**:
```typescript
interface LoanApplicationStats {
  totalApplications: number;
  applicationsByStatus: Record<LoanApplicationStatus, number>;
  totalFundingRequested: number;
  averageLoanAmount: number;
  approvalRate: number;
  rejectionRate: number;
  monthlyTrends: MonthlyTrend[];
  topBusinesses: BusinessStats[];
  topLoanProducts: ProductStats[];
}
```

## Loan Application Statuses

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

## Status Flow

```
kyc_kyb_verification → eligibility_check → credit_analysis → head_of_credit_review → internal_approval_ceo → committee_decision → sme_offer_approval → document_generation → signing_execution → awaiting_disbursement → approved/disbursed
                    ↓
                 rejected (any stage)
```

## Permission Matrix

| Operation | Entrepreneur | Admin/Member | Super Admin |
|-----------|-------------|---------------|-------------|
| Create Application | Own business only | Any business | Any business |
| View Applications | Own only | All | All |
| Update Application | Own only, limited | All | All |
| Cancel Application | Own only, pending only | All | All |
| View Timeline | Own only | All | All |
| View Statistics | No | Yes | Yes |
| KYC/KYB Operations | No | Yes | Yes |

## Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication
- `FORBIDDEN`: Insufficient permissions
- `LOAN_APPLICATION_NOT_FOUND`: Application doesn't exist
- `INVALID_STATUS`: Application not in expected status for operation
- `VALIDATION_ERROR`: Request validation failed
- `DUPLICATE_LOAN_ID`: Loan ID already exists
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `BUSINESS_NOT_FOUND`: Business doesn't exist
- `ENTREPRENEUR_NOT_FOUND`: Entrepreneur doesn't exist
- `LOAN_PRODUCT_NOT_FOUND`: Loan product doesn't exist
- `CANCEL_NOT_ALLOWED`: Application cannot be cancelled in current status

## Rate Limiting

Standard API rate limits apply. No specific limits for loan applications endpoints.

## Data Relationships

- **Business**: Each application belongs to one business
- **Entrepreneur**: Each application has one entrepreneur (user)
- **Loan Product**: Each application uses one loan product
- **Documents**: Applications have associated personal and business documents
- **Timeline**: Each application has a timeline of events
- **Audit Trail**: Each application has an audit trail of changes
- **Fees**: Applications may have associated loan fees
- **Offer Letters**: Approved applications generate offer letters
- **Snapshots**: Applications maintain snapshots at key stages

## Search Functionality

The `search` parameter searches across multiple fields:
- Loan ID (e.g., "LN-48291")
- Business name
- Entrepreneur name (first + last)
- Entrepreneur email
- Loan product name
- Loan source

Search is case-insensitive and performs partial matching.

## Currency Handling

- Primary currency: `fundingCurrency` (required)
- Secondary currency: `convertedCurrency` (optional)
- Exchange rate: `exchangeRate` (optional)
- All amounts are stored as numbers in the smallest currency unit

## Date Handling

All dates use ISO 8601 format:
- `createdAt`: Application creation timestamp
- `updatedAt`: Last update timestamp
- `dateFrom/dateTo`: Query filters (inclusive)
- Timeline events: Event timestamps

### 8. Complete Eligibility Assessment

**Endpoint**: `POST /:id/eligibility-assessment/complete`

**Authorization**: Admin/Member

**Request Body**:
```typescript
interface CompleteEligibilityAssessmentBody {
  comment: string; // Required - assessment comments
  supportingDocuments?: Array<{
    docUrl: string; // Required - document URL
    docName?: string; // Optional - document name (max 255 chars)
    notes?: string; // Optional - document notes (max 2000 chars)
  }>;
  nextApprover?: {
    nextApproverEmail: string; // Required - next approver email
    nextApproverName?: string; // Optional - next approver name (max 255 chars)
  };
}
```

**Response**:
```typescript
interface CompleteEligibilityAssessmentResponse {
  loanApplicationId: string;
  status: "credit_analysis"; // Always moves to credit_analysis
  completedAt: string;
  completedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  eligibilityAssessmentComment: string;
  supportingDocuments: Array<{
    id: string;
    docUrl: string;
    docName?: string;
    notes?: string;
  }>;
}
```

## Pagination

List endpoints support cursor-based pagination:
- `page`: Page number (1-based)
- `limit`: Items per page (max 100)
- Response includes pagination metadata with navigation helpers
