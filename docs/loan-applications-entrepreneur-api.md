# Loan Applications API - Entrepreneur Endpoints

## Overview

This document describes the API endpoints available to entrepreneurs (SMEs) for managing their own loan applications. All endpoints require authentication and enforce that entrepreneurs can only access their own applications.

**Base URL**: `/loan-applications/my-applications`

---

## Authentication

All endpoints require Clerk authentication. Include the Clerk session token in the Authorization header:

```
Authorization: Bearer <clerk_session_token>
```

---

## Endpoints

### 1. Get My Loan Applications List

**GET** `/loan-applications/my-applications`

Retrieves a paginated list of loan applications for the authenticated entrepreneur.

#### Query Parameters

```typescript
{
  page?: string;      // Page number (default: 1)
  limit?: string;    // Items per page (default: 20, max: 100)
  status?: string;    // Filter by status (optional)
}
```

#### Response (200 OK)

```typescript
{
  success: boolean;
  message: string;
  data: {
    applications: Array<{
      id: string;
      loanId: string;              // Display ID (e.g., "LN-48291")
      product: string;             // Loan product name
      requestedAmount: string;      // Formatted amount
      currency: string;             // ISO currency code
      tenure: string;               // Formatted tenure
      status: string;               // Current status
      appliedOn: string;            // ISO 8601 timestamp
    }>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

---

### 2. Get My Loan Application Detail

**GET** `/loan-applications/my-applications/:id`

Retrieves detailed information about a specific loan application.

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  success: boolean;
  message: string;
  data: {
    id: string;
    loanId: string;                // Display ID (e.g., "LN-48291")
    product: string;                // Loan product name
    requestedAmount: string;         // Formatted amount
    currency: string;               // ISO currency code
    tenure: string;                 // Formatted tenure
    status: string;                 // Current status (mapped to public status: "pending", "approved", "rejected", "disbursed", or "cancelled") (mapped to public status: "pending", "approved", "rejected", "disbursed", or "cancelled")
    appliedOn: string;              // ISO 8601 timestamp
    fundingAmount: number;          // Numeric amount
    repaymentPeriod: number;         // Repayment period
    termUnit: string;               // Unit (days, weeks, months, etc.)
    intendedUseOfFunds: string;      // Description
    interestRate: number;            // Interest rate percentage
    submittedAt?: string;            // ISO 8601 timestamp
    approvedAt?: string;            // ISO 8601 timestamp
    rejectedAt?: string;            // ISO 8601 timestamp
    disbursedAt?: string;          // ISO 8601 timestamp
    cancelledAt?: string;           // ISO 8601 timestamp
    rejectionReason?: string;        // Rejection reason if applicable
  };
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

---

### 3. Get Loan Application Timeline

**GET** `/loan-applications/my-applications/:id/timeline`

Retrieves the complete audit trail timeline for a loan application, showing all status changes and events.

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  data: Array<{
    id: string;                     // Event ID
    type:                           // Event type (masked for entrepreneurs - internal events hidden)
      | "submitted"
      | "cancelled"
      | "review_in_progress"        // Generic "under review" - masks internal workflow stages
      | "rejected"
      | "approved"
      | "awaiting_disbursement"
      | "disbursed";
    title: string;                  // Event title
    description?: string;           // Optional description
    date: string;                   // ISO date string or formatted date
    time?: string;                  // Optional time string (e.g., "6:04PM")
    updatedDate?: string;           // Optional: Last update date
    updatedTime?: string;           // Optional: Last update time
    performedBy?: string;           // Optional: Name of person who performed action
    performedById?: string;         // Optional: ID of user who performed action
    lineColor?: "green" | "orange" | "grey";  // Optional: Visual indicator color
  }>;
}
```

#### Example Response

```json
{
  "data": [
    {
      "id": "evt_123",
      "type": "submitted",
      "title": "Application Submitted",
      "description": "Your loan application has been submitted for review",
      "date": "2025-01-15",
      "time": "10:30AM",
      "performedBy": "John Doe",
      "lineColor": "green"
    },
    {
      "id": "evt_124",
      "type": "review_in_progress",
      "title": "Under Review",
      "description": "Application is being reviewed by our team",
      "date": "2025-01-16",
      "time": "2:15PM",
      "updatedDate": "2025-01-17",
      "updatedTime": "4:00PM",
      "lineColor": "orange"
    }
  ]
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

---

### 4. Get Contract Timeline

**GET** `/loan-applications/my-applications/:id/contract-timeline`

Retrieves contract-specific events and the current contract signing status.

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  currentStatus: string | null;     // Current contract status (see Contract Status Values below)
  events: Array<{
    id: string;                     // Event ID
    type: string;                   // Event type (see Contract Event Types below)
    title: string;                  // Event title
    description?: string;           // Optional description
    createdAt: string;              // ISO 8601 timestamp
    performedBy?: string;           // Optional: Name of person who performed action
    performedById?: string;         // Optional: ID of user who performed action
  }>;
}
```

#### Contract Status Values

```typescript
type ContractStatus =
  | "contract_uploaded"           // Contract document has been uploaded
  | "contract_sent_for_signing"    // Contract sent to signers via SignRequest
  | "contract_in_signing"          // At least one signer has viewed the contract
  | "contract_partially_signed"    // Some but not all signers have signed
  | "contract_fully_signed"        // All signers have completed signing
  | "contract_voided"              // Contract was cancelled or declined
  | "contract_expired";            // Contract expired without being fully signed
```

#### Contract Event Types

- `contract_uploaded` - Contract document uploaded
- `contract_sent_for_signing` - Contract sent to signers
- `contract_signer_opened` - Signer viewed the contract
- `contract_signed_by_signer` - Individual signer completed signing
- `contract_fully_signed` - All signers completed signing
- `contract_voided` - Contract cancelled or declined
- `contract_expired` - Contract expired

#### Example Response

```json
{
  "currentStatus": "contract_partially_signed",
  "events": [
    {
      "id": "evt_200",
      "type": "contract_uploaded",
      "title": "Contract Uploaded",
      "description": "Contract document has been uploaded",
      "createdAt": "2025-01-20T10:00:00Z",
      "performedBy": "Admin User"
    },
    {
      "id": "evt_201",
      "type": "contract_sent_for_signing",
      "title": "Contract Sent for Signing",
      "description": "Contract has been sent to all signers",
      "createdAt": "2025-01-20T10:05:00Z"
    },
    {
      "id": "evt_202",
      "type": "contract_signed_by_signer",
      "title": "Contract Signed by Signer",
      "description": "Successfully signed by John Doe",
      "createdAt": "2025-01-20T14:30:00Z",
      "performedBy": "John Doe"
    }
  ]
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

---

### 5. Get Loan Documents

**GET** `/loan-applications/my-applications/:id/documents`

Retrieves all documents associated with a loan application, including the term sheet and all uploaded documents.

#### Path Parameters

```typescript
{
  id: string;  // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  termSheetUrl: string | null;      // URL to the term sheet document (if available)
  documents: Array<{
    id: string;                     // Document ID
    documentType: string;           // Document type (see Document Types below)
    docUrl: string;                 // URL to the document
    docName?: string | null;        // Optional display name
    notes?: string | null;          // Optional notes about the document
    uploadedBy: string;             // User ID who uploaded the document
    createdAt: string;              // ISO 8601 timestamp
  }>;
}
```

#### Document Types

```typescript
type LoanDocumentType =
  | "eligibility_assessment_support"    // Supporting documents for eligibility assessment
  | "credit_analysis_report"            // Credit analysis report
  | "approval_memo"                     // Approval memo
  | "committee_decision_document"       // Committee decision document
  | "offer_letter"                      // Offer letter
  | "contract"                          // Loan contract
  | "disbursement_authorization";        // Disbursement authorization
```

#### Example Response

```json
{
  "termSheetUrl": "https://storage.example.com/term-sheets/loan-123.pdf",
  "documents": [
    {
      "id": "doc_123",
      "documentType": "contract",
      "docUrl": "https://storage.example.com/contracts/loan-123-contract.pdf",
      "docName": "Loan Agreement - LN-48291",
      "notes": "Final contract document",
      "uploadedBy": "user_456",
      "createdAt": "2025-01-20T10:00:00Z"
    },
    {
      "id": "doc_124",
      "documentType": "offer_letter",
      "docUrl": "https://storage.example.com/offer-letters/loan-123-offer.pdf",
      "docName": null,
      "notes": null,
      "uploadedBy": "user_456",
      "createdAt": "2025-01-18T14:30:00Z"
    }
  ]
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

---

### 6. Cancel Loan Application

**POST** `/loan-applications/my-applications/:id/cancel`

Cancels a loan application that is in a pending status. Only accessible to entrepreneurs for their own applications.

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

Returns the updated loan application detail (same format as `GET /loan-applications/my-applications/:id`).

#### Business Logic

- **Status Validation**: 
  - Only applications in pending statuses can be cancelled
  - Pending statuses: `kyc_kyb_verification`, `eligibility_check`, `credit_analysis`, `head_of_credit_review`, `internal_approval_ceo`, `committee_decision`, `sme_offer_approval`, `document_generation`, `signing_execution`, `awaiting_disbursement`
  - Cannot cancel applications that are already in terminal states (`approved`, `rejected`, `disbursed`, `cancelled`)

- **Authorization**: 
  - Entrepreneurs can only cancel their own applications
  - The application's `entrepreneurId` must match the authenticated user's ID

- **Automatic Updates**:
  - Sets status to `cancelled`
  - Sets `cancelledAt` timestamp
  - Clears `rejectionReason` if it exists
  - Updates `lastUpdatedBy` and `lastUpdatedAt`

- **Audit Trail**: Automatically logs the cancellation to the audit trail

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

## Loan Application Detail Structure (Full Response)

When accessing loan application details via the admin endpoint (`GET /loan-applications/:id`), the response includes additional fields not present in the entrepreneur-specific endpoint. Here's the complete structure:

### Full Loan Application Detail

```typescript
{
  id: string;
  loanId: string;                    // Display ID (e.g., "LN-48291")
  businessId: string;
  entrepreneurId: string;
  loanProductId: string;
  fundingAmount: number;
  fundingCurrency: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  exchangeRate?: number;
  repaymentPeriod: number;           // Repayment period
  intendedUseOfFunds: string;
  interestRate: number;
  loanSource: string;
  status: LoanApplicationStatus;     // See Status Values below
  contractStatus?: ContractStatus | null;  // See Contract Status Values above
  submittedAt?: string;              // ISO 8601 timestamp
  approvedAt?: string;               // ISO 8601 timestamp
  rejectedAt?: string;               // ISO 8601 timestamp
  disbursedAt?: string;              // ISO 8601 timestamp
  cancelledAt?: string;              // ISO 8601 timestamp
  rejectionReason?: string;
  
  // Stage comments (NEW)
  eligibilityAssessmentComment?: string | null;
  creditAssessmentComment?: string | null;
  headOfCreditReviewComment?: string | null;
  internalApprovalCeoComment?: string | null;
  
  // Timestamps
  createdAt: string;                 // ISO 8601 timestamp
  updatedAt: string;                 // ISO 8601 timestamp
  lastUpdatedAt?: string;            // ISO 8601 timestamp
  createdBy: string;                 // User ID
  lastUpdatedBy?: string;            // User ID
  
  // Convenience fields
  businessName: string;
  sector?: string | null;
  applicantName: string;             // Full name of entrepreneur/applicant
  organizationName: string;          // Name of organization providing the loan
  creatorName: string;               // Full name of creator
  
  // Related data
  business: {
    id: string;
    name: string;
    description?: string | null;
    sector?: string | null;
    country?: string | null;
    city?: string | null;
    entityType?: string | null;
  };
  entrepreneur: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phoneNumber?: string | null;
    imageUrl?: string | null;
  };
  loanProduct: {
    id: string;
    name: string;
    currency: string;
    minAmount: number;
    maxAmount: number;
  };
  creator: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  lastUpdatedByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  activeVersion?: {
    id: string;
    status: "original" | "counter_offer";
    fundingAmount: number;
    repaymentPeriod: number;
    returnType: "interest_based" | "revenue_sharing";
    interestRate: number;
    repaymentStructure: "principal_and_interest" | "bullet_repayment";
    repaymentCycle: "daily" | "weekly" | "bi_weekly" | "monthly" | "quarterly";
    gracePeriod?: number;
    firstPaymentDate?: string;
    customFees?: Array<{
      name: string;
      amount: number;
      type: "flat" | "percentage";
    }>;
  };
}
```

### Loan Application Status Values (Public - For Entrepreneurs)

**Important**: Internal status values are masked from entrepreneurs. All internal workflow statuses are mapped to generic public statuses.

```typescript
type PublicLoanApplicationStatus =
  | "pending"      // All in-progress statuses map to this
  | "approved"     // Application approved
  | "rejected"     // Application rejected
  | "disbursed"    // Funds disbursed
  | "cancelled";   // Application cancelled
```

#### Status Mapping

The following internal statuses are **masked** and shown as `"pending"` to entrepreneurs:

- `kyc_kyb_verification` → `"pending"`
- `eligibility_check` → `"pending"`
- `credit_analysis` → `"pending"`
- `head_of_credit_review` → `"pending"`
- `internal_approval_ceo` → `"pending"`
- `committee_decision` → `"pending"`
- `sme_offer_approval` → `"pending"`
- `document_generation` → `"pending"`
- `signing_execution` → `"pending"`
- `awaiting_disbursement` → `"pending"`

Terminal statuses are exposed as-is:
- `approved` → `"approved"`
- `rejected` → `"rejected"`
- `disbursed` → `"disbursed"`
- `cancelled` → `"cancelled"`

**Note**: This masking ensures that internal workflow details are not exposed to entrepreneurs, providing a cleaner and simpler user experience while maintaining privacy of internal processes.

---

## Notes

### Authorization

- All `/my-applications/*` endpoints are **entrepreneur-only** and will return `403 Forbidden` if accessed by admin/member users
- Entrepreneurs can only access their own applications (enforced by checking `entrepreneurId`)
- The general endpoints (`/:id/*`) also work for entrepreneurs but include additional authorization checks

### Contract Status Tracking

- `contractStatus` is automatically updated via SignRequest webhooks:
  - When contract is sent: `contract_sent_for_signing`
  - When signer views: `contract_in_signing`
  - When some signers sign: `contract_partially_signed`
  - When all signers sign: `contract_fully_signed` (also moves loan status to `awaiting_disbursement`)
  - If cancelled/declined: `contract_voided`
  - If expired: `contract_expired`

### Status Masking

**Important**: Internal loan application statuses are masked from entrepreneurs for privacy and simplicity.

All internal workflow statuses (e.g., `kyc_kyb_verification`, `eligibility_check`, `credit_analysis`, `head_of_credit_review`, `internal_approval_ceo`, `committee_decision`, `sme_offer_approval`, `document_generation`, `signing_execution`, `awaiting_disbursement`) are mapped to the generic `"pending"` status.

Only terminal statuses (`approved`, `rejected`, `disbursed`, `cancelled`) are exposed as-is.

This ensures:
- **Privacy**: Internal workflow details are not exposed
- **Simplicity**: Entrepreneurs see a cleaner, easier-to-understand status
- **Consistency**: All in-progress applications show as "pending" regardless of internal stage

### Timeline Event Masking

**Important**: Internal workflow events in the timeline are also masked from entrepreneurs.

**Hidden Events** (not shown to entrepreneurs):
- `document_verified_approved` / `document_verified_rejected` - KYC/KYB document verification details
- `kyc_kyb_completed` - KYC/KYB verification completion
- `eligibility_assessment_completed` - Eligibility assessment completion
- `credit_assessment_completed` - Credit assessment completion
- `head_of_credit_review_completed` - Head of credit review completion
- `internal_approval_ceo_completed` - CEO approval completion
- `counter_offer_proposed` - Counter-offer proposals
- `status_changed` - Generic status changes

**Mapped Events** (shown as generic "Application under review"):
- Internal workflow completion events → `"review_in_progress"` with generic title "Application under review"
- Contract events (uploaded, sent, opened, signed) → `"review_in_progress"`
- Contract fully signed → `"awaiting_disbursement"`

**Visible Events** (shown as-is):
- `submitted` - "Loan application submitted"
- `cancelled` - "Loan application cancelled"
- `review_in_progress` - "Application under review" (generic)
- `rejected` - "Loan application rejected"
- `approved` - "Loan application approved"
- `awaiting_disbursement` - "Awaiting disbursement"
- `disbursed` - "Loan disbursed"

**Additional Privacy Measures**:
- Event descriptions are hidden for entrepreneurs
- Performer names (`performedBy`) are hidden for entrepreneurs
- Only generic titles are shown (e.g., "Application under review" instead of "Eligibility assessment completed")

### Stage Comments

The following comment fields are now exposed in the loan application detail:
- `eligibilityAssessmentComment` - Comments from eligibility assessment stage
- `creditAssessmentComment` - Comments from credit analysis stage
- `headOfCreditReviewComment` - Comments from head of credit review stage
- `internalApprovalCeoComment` - Comments from CEO approval stage

These fields are `null` if no comment has been added at that stage.

---

## Error Response Format

All error responses follow this format:

```typescript
{
  error: string;    // Error message
  code: string;     // Error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
}
```

---

## Example Frontend Integration

### TypeScript Types

```typescript
// Public Loan Application Status (for entrepreneurs)
// Internal statuses are masked - all in-progress statuses map to "pending"
type PublicLoanApplicationStatus =
  | "pending"      // All internal workflow statuses map to this
  | "approved"     // Application approved
  | "rejected"     // Application rejected
  | "disbursed"    // Funds disbursed
  | "cancelled";   // Application cancelled

// Contract Status
type ContractStatus =
  | "contract_uploaded"
  | "contract_sent_for_signing"
  | "contract_in_signing"
  | "contract_partially_signed"
  | "contract_fully_signed"
  | "contract_voided"
  | "contract_expired";

// Loan Application Detail (for entrepreneurs)
interface LoanApplicationDetail {
  id: string;
  loanId: string;
  status: PublicLoanApplicationStatus;  // Masked status - internal statuses map to "pending"
  contractStatus?: ContractStatus | null;
  eligibilityAssessmentComment?: string | null;
  creditAssessmentComment?: string | null;
  headOfCreditReviewComment?: string | null;
  internalApprovalCeoComment?: string | null;
  // ... other fields
}

// Timeline Event (for entrepreneurs - internal events are masked)
interface TimelineEvent {
  id: string;
  type: PublicTimelineEventType;  // Only public event types are shown
  title: string;                   // Generic titles (e.g., "Application under review")
  description?: string;             // Hidden for entrepreneurs
  date: string;
  time?: string;
  performedBy?: string;            // Hidden for entrepreneurs
  lineColor?: "green" | "orange" | "grey";
}

// Public Timeline Event Type (internal workflow events are masked)
type PublicTimelineEventType =
  | "submitted"
  | "cancelled"
  | "review_in_progress"  // Generic "under review" - masks internal workflow stages
  | "rejected"
  | "approved"
  | "awaiting_disbursement"
  | "disbursed";

// Contract Timeline Event
interface ContractTimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  createdAt: string;
  performedBy?: string;
}

// Documents Response
interface LoanDocumentsResponse {
  termSheetUrl: string | null;
  documents: Array<{
    id: string;
    documentType: string;
    docUrl: string;
    docName?: string | null;
    notes?: string | null;
    uploadedBy: string;
    createdAt: string;
  }>;
}
```

### API Client Example

```typescript
// Fetch loan application detail
const getLoanApplication = async (id: string): Promise<LoanApplicationDetail> => {
  const response = await fetch(`/api/loan-applications/my-applications/${id}`, {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch loan application');
  const data = await response.json();
  return data.data;
};

// Fetch timeline
const getTimeline = async (id: string): Promise<TimelineEvent[]> => {
  const response = await fetch(`/api/loan-applications/my-applications/${id}/timeline`, {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch timeline');
  const data = await response.json();
  return data.data;
};

// Fetch contract timeline
const getContractTimeline = async (id: string) => {
  const response = await fetch(`/api/loan-applications/my-applications/${id}/contract-timeline`, {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch contract timeline');
  return response.json();
};

// Fetch documents
const getDocuments = async (id: string): Promise<LoanDocumentsResponse> => {
  const response = await fetch(`/api/loan-applications/my-applications/${id}/documents`, {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch documents');
  return response.json();
};

// Cancel loan application
const cancelLoanApplication = async (id: string, reason?: string) => {
  const response = await fetch(`/api/loan-applications/my-applications/${id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error('Failed to cancel loan application');
  return response.json();
};
```

---

## Summary

All entrepreneur-facing routes are now available:

1. ✅ **List Applications**: `GET /loan-applications/my-applications`
2. ✅ **Get Application Detail**: `GET /loan-applications/my-applications/:id`
3. ✅ **Get Timeline**: `GET /loan-applications/my-applications/:id/timeline`
4. ✅ **Get Contract Timeline**: `GET /loan-applications/my-applications/:id/contract-timeline`
5. ✅ **Get Documents**: `GET /loan-applications/my-applications/:id/documents`
6. ✅ **Cancel Application**: `POST /loan-applications/my-applications/:id/cancel`

All routes enforce proper authorization and return appropriate error responses.
