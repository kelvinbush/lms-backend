# KYC/KYB Verification API Documentation

## Overview

The KYC/KYB verification endpoints allow admins and members to manage document verification for loan applications. These endpoints are part of the loan applications workflow and handle the transition from `kyc_kyb_verification` to `eligibility_check` status.

## Authentication & Authorization

All KYC/KYB endpoints require:
- **Authentication**: Valid Clerk JWT token
- **Authorization**: Admin or Member role (`"admin" | "member"`)

## Base URL
```
/api/loan-applications/:id/kyc-kyb
```

## Endpoints

### 1. Get Documents for Verification

**Endpoint**: `GET /:id/kyc-kyb-documents`

**Description**: Retrieves all personal and business documents for a loan application with their verification status.

**Parameters**:
- `id` (path, required): Loan application ID

**Response**:
```typescript
interface GetDocumentsResponse {
  personalDocuments: DocumentItem[];
  businessDocuments: DocumentItem[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

interface DocumentItem {
  id: string;
  docType: string;
  docUrl: string;
  docYear?: number;
  docBankName?: string;
  createdAt: string;
  verificationStatus: "pending" | "approved" | "rejected";
  verifiedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  verifiedAt?: string;
  rejectionReason?: string;
  notes?: string;
  lockedAt?: string;
}
```

### 2. Verify Single Document

**Endpoint**: `POST /:id/documents/:documentId/verify`

**Description**: Approve or reject a single document.

**Parameters**:
- `id` (path, required): Loan application ID
- `documentId` (path, required): Document ID
- `documentType` (query, required): `"personal"` or `"business"`

**Request Body**:
```typescript
interface VerifyDocumentBody {
  status: "approved" | "rejected";
  rejectionReason?: string; // Required when status is "rejected"
  notes?: string;
}
```

**Response**:
```typescript
interface VerifyDocumentResponse {
  documentId: string;
  documentType: "personal" | "business";
  verificationStatus: "pending" | "approved" | "rejected";
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  verifiedAt: string;
  rejectionReason?: string;
  notes?: string;
  lockedAt: string;
}
```

### 3. Bulk Verify Documents

**Endpoint**: `POST /:id/kyc-kyb/bulk-verify`

**Description**: Verify multiple documents in a single request.

**Parameters**:
- `id` (path, required): Loan application ID

**Request Body**:
```typescript
interface BulkVerifyDocumentsBody {
  verifications: Array<{
    documentId: string;
    documentType: "personal" | "business";
    status: "approved" | "rejected";
    rejectionReason?: string; // Required when status is "rejected"
    notes?: string;
  }>;
}
```

**Response**:
```typescript
interface BulkVerifyDocumentsResponse {
  successful: number;
  failed: number;
  results: Array<{
    documentId: string;
    success: boolean;
    error?: string;
  }>;
}
```

### 4. Complete KYC/KYB Verification

**Endpoint**: `POST /:id/kyc-kyb/complete`

**Description**: Mark KYC/KYB verification as complete and move loan application to eligibility check. Optionally sends email notification to next approver.

**Parameters**:
- `id` (path, required): Loan application ID

**Request Body**:
```typescript
interface CompleteKycKybRequestBody {
  nextApprover?: {
    nextApproverEmail: string; // Required to send notification
    nextApproverName?: string; // Optional display name
  };
}
```

**Response**:
```typescript
interface CompleteKycKybResponse {
  loanApplicationId: string;
  status: "eligibility_check";
  completedAt: string;
  completedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}
```

## Status Flow

```
kyc_kyb_verification → eligibility_check
```

The `complete` endpoint transitions the loan application from `kyc_kyb_verification` to `eligibility_check` status.

## Email Notifications

When completing KYC/KYB verification with a `nextApprover`, an email is automatically sent to the specified email address containing:

- Approver's name (if provided)
- Stage name ("Eligibility Check")
- Company name
- Applicant details (name, email, phone)
- Loan details (type, amount, tenure, use of funds)
- Login link to admin portal

## Error Handling

All endpoints return standard HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (loan application or document not found)
- `500`: Internal Server Error

Error Response Format:
```typescript
{
  error: string; // Human-readable error message
  code: string; // Machine-readable error code
}
```

## Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication
- `FORBIDDEN`: Insufficient permissions
- `LOAN_APPLICATION_NOT_FOUND`: Loan application doesn't exist
- `INVALID_STATUS`: Loan application not in expected status
- `NO_DOCUMENTS_REVIEWED`: At least one document must be reviewed
- `MISSING_DOCUMENT_TYPE`: Document type query parameter required
- `VERIFY_DOCUMENT_FAILED`: Document verification failed
- `BULK_VERIFY_DOCUMENTS_FAILED`: Bulk verification failed
- `COMPLETE_KYC_KYB_FAILED`: Completion failed

## Validation Rules

### Document Verification
- `documentType` must be `"personal"` or `"business"`
- `status` must be `"approved"` or `"rejected"`
- `rejectionReason` is required when `status` is `"rejected"`
- `rejectionReason` max length: 1000 characters
- `notes` max length: 2000 characters

### Bulk Verification
- `verifications` array: 1-100 items
- Each item must include `documentId`, `documentType`, and `status`

### Completion
- At least one document must be reviewed (approved or rejected)
- Loan application must be in `kyc_kyb_verification` status
- `nextApproverEmail` must be valid email format (if provided)

## Rate Limiting

No specific rate limits are applied to KYC/KYB endpoints beyond standard API rate limiting.

## Pagination

The `GET /:id/kyc-kyb-documents` endpoint does not use pagination as it returns all documents for a single loan application.
