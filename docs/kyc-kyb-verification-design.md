# KYC/KYB Verification System Design

## Overview

This document outlines the design for the KYC/KYB verification workflow in the loan approval process. The system allows admins to verify individual documents (personal and business) for each loan application, with documents being immutable once verified.

## Key Requirements

1. **Document Isolation**: Documents cannot be reused across multiple loan applications - each loan requires its own verification
2. **Document Immutability**: Once a document is verified (approved/rejected), users cannot update it
3. **Rejection Handling**: If rejected, users upload a NEW document (new record), not update existing
4. **Version Tracking**: System may track document versions for audit purposes
5. **Flexible Progression**: Admins can proceed to next step even with some documents rejected
6. **No Loan Product Linkage**: Documents are not tied to specific loan products

## Architecture

### Core Tables

#### 1. `loan_application_document_verifications`
Links loan applications to specific document instances with verification status.

**Schema:**
- `id` (PK) - Unique identifier
- `loan_application_id` (FK) - References loan application
- `document_type` (enum) - 'personal' | 'business'
- `document_id` (FK) - References either personal_documents.id or business_documents.id
- `verification_status` (enum) - 'pending' | 'approved' | 'rejected'
- `verified_by` (FK) - Admin user who performed verification
- `verified_at` (timestamp) - When verification occurred
- `rejection_reason` (text, nullable) - Reason if rejected
- `notes` (text, nullable) - Admin notes
- `created_at`, `updated_at` - Audit timestamps

**Indexes:**
- `idx_verifications_loan_app` on `(loan_application_id)`
- `idx_verifications_document` on `(document_type, document_id)`
- `idx_verifications_status` on `(verification_status)`
- `idx_verifications_loan_app_status` on `(loan_application_id, verification_status)`

#### 2. Document Table Modifications

**Add to `personal_documents`:**
- `is_verified` (boolean) - Whether document is verified
- `verified_for_loan_application_id` (FK, nullable) - Which loan application verified this
- `locked_at` (timestamp, nullable) - When document was locked

**Add to `business_documents`:**
- `is_verified` (boolean) - Whether document is verified
- `verified_for_loan_application_id` (FK, nullable) - Which loan application verified this
- `locked_at` (timestamp, nullable) - When document was locked

**Indexes:**
- `idx_personal_docs_verified` on `(is_verified, verified_for_loan_application_id)`
- `idx_business_docs_verified` on `(is_verified, verified_for_loan_application_id)`

#### 3. Optional: Version Tracking

If version tracking is needed:
- `parent_document_id` (FK, nullable) - Links to previous version
- `version_number` (integer) - Sequential version number

## Workflow

### 1. Loan Application Creation
- Loan application created with status: `pending` then admins manually move to `kyc-kyb-verification`
- System identifies all documents for entrepreneur + business
- Creates verification records with status `pending` for each document

### 2. Admin Review Process
- Admin views all documents for the loan application
- Documents show current verification status (pending/approved/rejected)
- Admin can approve/reject individual documents
- On verification:
  - Update verification record with status and admin details
  - Lock the document (set `is_verified = true`, `locked_at = now()`, `verified_for_loan_application_id`)
  - Document cannot be edited by user after this

### 3. Document Rejection Flow
- Document rejected with reason
- Document is locked (cannot be updated)
- User uploads NEW document (new record in database)
- System creates new verification record with status `pending` for new document
- Old rejected document remains in history for audit trail

### 4. KYC/KYB Completion
- Admin can proceed to next step even with some documents rejected
- Admin manually marks KYC/KYB as complete OR system auto-checks when all reviewed
- Loan application status moves to: `eligibility_check`

### 5. Document Selection Strategy
- For new loan applications: Auto-select all existing unverified documents
- For documents with multiple versions: Admin can see all versions, but system defaults to most recent
- Year-specific documents (e.g., bank statements): Admin chooses which years to verify

## API Endpoints

### GET `/loan-applications/{id}/kyc-kyb-documents`
Returns all documents (personal + business) with their verification status for the loan application.

**Response:**
```typescript
{
  personalDocuments: Array<{
    id: string
    docType: string
    docUrl: string
    verificationStatus: 'pending' | 'approved' | 'rejected'
    verifiedBy?: { id: string, name: string }
    verifiedAt?: string
    rejectionReason?: string
    notes?: string
    lockedAt?: string
  }>
  businessDocuments: Array<{
    id: string
    docType: string
    docUrl: string
    docYear?: number
    verificationStatus: 'pending' | 'approved' | 'rejected'
    verifiedBy?: { id: string, name: string }
    verifiedAt?: string
    rejectionReason?: string
    notes?: string
    lockedAt?: string
  }>
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}
```

### POST `/loan-applications/{id}/documents/{documentId}/verify`
Verify a specific document (approve or reject).

**Body:**
```typescript
{
  documentType: 'personal' | 'business'
  status: 'approved' | 'rejected'
  rejectionReason?: string
  notes?: string
}
```

**Behavior:**
- Creates/updates verification record
- Locks document (sets is_verified, locked_at, verified_for_loan_application_id)
- Creates audit trail entry
- Returns updated document with verification status

### POST `/loan-applications/{id}/kyc-kyb/complete`
Mark KYC/KYB verification as complete for the loan application.

**Behavior:**
- Validates that at least some documents have been reviewed
- Updates loan application status to `eligibility_check`
- Creates audit trail entry
- Optional: Sends notification

### POST `/loan-applications/{id}/kyc-kyb/bulk-verify`
Bulk verify multiple documents at once.

**Body:**
```typescript
{
  verifications: Array<{
    documentId: string
    documentType: 'personal' | 'business'
    status: 'approved' | 'rejected'
    rejectionReason?: string
    notes?: string
  }>
}
```

## Edge Cases & Handling

### 1. Multiple Document Versions
- **Scenario**: User has 3 versions of national_id_front
- **Solution**: Show all versions, highlight most recent, admin selects which to verify

### 2. Document Uploaded After Verification Started
- **Scenario**: User uploads new document while admin is reviewing
- **Solution**: Create verification record with `pending` status automatically

### 3. Year-Specific Documents
- **Scenario**: Multiple bank statements for different years
- **Solution**: Admin selects which years are relevant for this loan application

### 4. Rejected Document Re-upload
- **Scenario**: Document rejected, user uploads new version
- **Solution**: Create new document record, create new verification record linked to loan application

### 5. Concurrent Verification
- **Scenario**: Multiple admins try to verify same document
- **Solution**: Use database locks/transactions to prevent conflicts

### 6. Loan Application Cancelled/Rejected
- **Scenario**: Loan rejected while in KYC/KYB
- **Solution**: Documents remain locked, verification records preserved for audit

## Database Constraints

1. **Uniqueness**: One verification record per document per loan application
2. **Referential Integrity**: Verification records cascade delete if loan application deleted
3. **Document Locking**: Once `is_verified = true`, document cannot be updated (enforce in application layer)

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried columns indexed
2. **Query Optimization**: Use joins to fetch documents + verifications in single query
3. **Caching**: Consider caching verification status (invalidates on verification updates)
4. **Bulk Operations**: Support bulk verify to reduce database round trips

## Audit Trail Integration

All verification actions create audit trail entries:
- `document_verified_approved` - When document approved
- `document_verified_rejected` - When document rejected
- `kyc_kyb_completed` - When KYC/KYB step completed

Audit trail includes:
- Performed by (admin user)
- Timestamp
- Document details
- Verification decision and reason

## Testing Requirements

1. **Unit Tests**:
   - Document locking logic
   - Verification record creation
   - Status transitions
   - Document selection logic

2. **Integration Tests**:
   - Full verification workflow
   - Document rejection and re-upload flow
   - Bulk verification
   - Concurrent verification prevention

3. **Edge Case Tests**:
   - Multiple document versions
   - Year-specific documents
   - Document uploaded during verification
   - Loan application status transitions
