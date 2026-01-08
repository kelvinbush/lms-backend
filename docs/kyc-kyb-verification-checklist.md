# KYC/KYB Verification Implementation Checklist

## Phase 1: Database Schema & Migrations

### 1.1 Create Verification Table
- [ ] Create `loan_application_document_verifications` schema file
- [ ] Define all columns with proper types
- [ ] Add foreign key constraints
- [ ] Add indexes for performance
- [ ] Create database migration
- [ ] Test migration up/down

### 1.2 Update Document Tables
- [ ] Add `is_verified` column to `personal_documents`
- [ ] Add `verified_for_loan_application_id` to `personal_documents`
- [ ] Add `locked_at` to `personal_documents`
- [ ] Add indexes on new columns
- [ ] Repeat for `business_documents`
- [ ] Create migration
- [ ] Test migration

### 1.3 Schema Relations
- [ ] Add relations in `relations.ts` for verification table
- [ ] Update existing document relations if needed
- [ ] Test relations resolve correctly

### 1.4 Database Constraints
- [ ] Add unique constraint: one verification per document per loan application
- [ ] Add check constraints if needed
- [ ] Test constraint violations

## Phase 2: Core Service Layer

### 2.1 Verification Service
- [ ] Create `kyc-kyb-verification.service.ts`
- [ ] Implement `getDocumentsForVerification(loanApplicationId)`
  - [ ] Fetch personal documents
  - [ ] Fetch business documents
  - [ ] Fetch verification statuses
  - [ ] Merge and return formatted response
- [ ] Implement `verifyDocument(loanApplicationId, documentId, documentType, status, adminId, reason?, notes?)`
  - [ ] Validate loan application exists and is in correct status
  - [ ] Validate document exists and belongs to loan application
  - [ ] Create/update verification record
  - [ ] Lock document
  - [ ] Create audit trail entry
- [ ] Implement `bulkVerifyDocuments(loanApplicationId, verifications[], adminId)`
  - [ ] Validate all documents
  - [ ] Process in transaction
  - [ ] Create audit trail entries
- [ ] Implement `completeKycKybVerification(loanApplicationId, adminId)`
  - [ ] Validate at least some documents reviewed
  - [ ] Update loan application status
  - [ ] Create audit trail entry

### 2.2 Document Locking Logic
- [ ] Create utility function to check if document is locked
- [ ] Create utility function to lock document
- [ ] Prevent updates to locked documents in document upload endpoints
- [ ] Add middleware/validation for locked document checks

### 2.3 Auto-Creation of Verification Records
- [ ] Create function to auto-create verification records when:
  - [ ] Loan application created
  - [ ] New document uploaded (if loan in kyc_kyb_verification status)
- [ ] Hook into loan application creation service
- [ ] Hook into document upload services

## Phase 3: API Endpoints

### 3.1 Get Documents for Verification
- [ ] Create route `GET /loan-applications/:id/kyc-kyb-documents`
- [ ] Add authentication/authorization (admin only)
- [ ] Validate loan application exists
- [ ] Call service to get documents
- [ ] Format response with summary
- [ ] Add error handling

### 3.2 Verify Single Document
- [ ] Create route `POST /loan-applications/:id/documents/:documentId/verify`
- [ ] Add request validation schema
- [ ] Add authentication/authorization (admin only)
- [ ] Validate loan application status
- [ ] Call service to verify
- [ ] Return updated document status
- [ ] Add error handling

### 3.3 Bulk Verify Documents
- [ ] Create route `POST /loan-applications/:id/kyc-kyb/bulk-verify`
- [ ] Add request validation schema
- [ ] Add authentication/authorization (admin only)
- [ ] Validate all documents belong to loan application
- [ ] Call bulk verify service
- [ ] Return summary of verifications
- [ ] Add error handling

### 3.4 Complete KYC/KYB
- [ ] Create route `POST /loan-applications/:id/kyc-kyb/complete`
- [ ] Add authentication/authorization (admin only)
- [ ] Validate loan application status
- [ ] Call completion service
- [ ] Return updated loan application
- [ ] Add error handling

### 3.5 Request Validation
- [ ] Create Zod/JSON schemas for all endpoints
- [ ] Add validation middleware
- [ ] Test invalid inputs

## Phase 4: Integration & Workflow

### 4.1 Loan Application Creation Hook
- [ ] Update `LoanApplicationsService.create()` to:
  - [ ] Create verification records for all existing documents
  - [ ] Handle case where no documents exist yet
- [ ] Test with documents present
- [ ] Test with no documents

### 4.2 Document Upload Hooks
- [ ] Update personal document upload to:
  - [ ] Check if user has active loan in `kyc_kyb_verification`
  - [ ] Auto-create verification record if yes
- [ ] Update business document upload similarly
- [ ] Test document upload during verification
- [ ] Test document upload after verification

### 4.3 Document Update Prevention
- [ ] Add checks in document update endpoints
- [ ] Return appropriate error if document is locked
- [ ] Test update prevention
- [ ] Test error messages

### 4.4 Status Transition Logic
- [ ] Ensure loan application can only enter `kyc_kyb_verification` correctly
- [ ] Ensure transition to `eligibility_check` only after completion
- [ ] Add status transition validation
- [ ] Test valid transitions
- [ ] Test invalid transitions

## Phase 5: Audit Trail Integration

### 5.1 Audit Trail Events
- [ ] Add event type: `document_verified_approved`
- [ ] Add event type: `document_verified_rejected`
- [ ] Add event type: `kyc_kyb_completed`
- [ ] Update audit trail enum if needed

### 5.2 Audit Trail Creation
- [ ] Create audit entries in verification service
- [ ] Include document details in audit entry
- [ ] Include admin details
- [ ] Include verification decision and reason
- [ ] Test audit entries are created correctly

## Phase 6: Testing

### 6.1 Unit Tests - Service Layer
- [ ] Test `getDocumentsForVerification()`
  - [ ] Returns all documents
  - [ ] Includes verification status
  - [ ] Handles no documents case
  - [ ] Handles no verification records case
- [ ] Test `verifyDocument()`
  - [ ] Creates verification record on approve
  - [ ] Creates verification record on reject
  - [ ] Locks document after verification
  - [ ] Rejects if document already verified
  - [ ] Rejects if loan application not in correct status
- [ ] Test `bulkVerifyDocuments()`
  - [ ] Processes all verifications
  - [ ] Rolls back on error
  - [ ] Handles partial failures correctly
- [ ] Test `completeKycKybVerification()`
  - [ ] Updates loan status
  - [ ] Rejects if no documents reviewed
  - [ ] Allows completion with some rejected

### 6.2 Unit Tests - Document Locking
- [ ] Test document cannot be updated after lock
- [ ] Test document can be updated before lock
- [ ] Test locking sets correct fields

### 6.3 Integration Tests - API Endpoints
- [ ] Test GET documents endpoint
  - [ ] Returns correct structure
  - [ ] Includes summary
  - [ ] Handles unauthorized access
  - [ ] Handles non-existent loan application
- [ ] Test POST verify endpoint
  - [ ] Approves document correctly
  - [ ] Rejects document correctly
  - [ ] Validates inputs
  - [ ] Handles errors
- [ ] Test POST bulk-verify endpoint
  - [ ] Processes multiple verifications
  - [ ] Handles partial failures
- [ ] Test POST complete endpoint
  - [ ] Transitions status correctly
  - [ ] Creates audit trail

### 6.4 Integration Tests - Workflows
- [ ] Test complete verification workflow:
  - [ ] Create loan application
  - [ ] Verification records auto-created
  - [ ] Admin views documents
  - [ ] Admin approves some, rejects others
  - [ ] User uploads new document after rejection
  - [ ] New verification record created
  - [ ] Admin completes verification
  - [ ] Status transitions
- [ ] Test document upload during verification
- [ ] Test document update prevention
- [ ] Test multiple document versions
- [ ] Test year-specific documents

### 6.5 Edge Case Tests
- [ ] Multiple admins verify simultaneously (concurrency)
- [ ] Document uploaded after verification started
- [ ] Loan application cancelled during verification
- [ ] No documents exist for loan application
- [ ] All documents rejected but proceeding allowed
- [ ] Year-specific document selection

### 6.6 Performance Tests
- [ ] Test query performance with indexes
- [ ] Test bulk verify performance
- [ ] Test large number of documents

## Phase 7: Documentation & Cleanup

### 7.1 Code Documentation
- [ ] Add JSDoc comments to all service methods
- [ ] Add inline comments for complex logic
- [ ] Document error cases

### 7.2 API Documentation
- [ ] Update Swagger/OpenAPI docs with new endpoints
- [ ] Document request/response schemas
- [ ] Document error responses

### 7.3 Migration Documentation
- [ ] Document migration steps
- [ ] Document rollback procedure
- [ ] Document data migration if needed

## Phase 8: Security & Validation

### 8.1 Authorization
- [ ] Ensure only admins can verify documents
- [ ] Ensure admins can only verify documents for accessible loan applications
- [ ] Test authorization on all endpoints

### 8.2 Input Validation
- [ ] Validate all inputs
- [ ] Sanitize user inputs
- [ ] Validate document belongs to loan application
- [ ] Test invalid inputs

### 8.3 Data Integrity
- [ ] Ensure transactions are used for multi-step operations
- [ ] Ensure foreign key constraints are respected
- [ ] Test constraint violations

## Phase 9: Monitoring & Logging

### 9.1 Logging
- [ ] Add logging for verification actions
- [ ] Add logging for errors
- [ ] Add performance logging for slow queries

### 9.2 Monitoring
- [ ] Add metrics for verification completion time
- [ ] Add metrics for rejection rates
- [ ] Add alerts for failures
