# KYC/KYB Verification Implementation Checklist

## Phase 1: Database Schema & Migrations

### 1.1 Create Verification Table
- [x] Create `loan_application_document_verifications` schema file
- [x] Define all columns with proper types
- [x] Add foreign key constraints
- [x] Add indexes for performance
- [x] Create database migration
- [ ] Test migration up/down (pending migration run)

### 1.2 Update Document Tables
- [x] Add `is_verified` column to `personal_documents`
- [x] Add `verified_for_loan_application_id` to `personal_documents`
- [x] Add `locked_at` to `personal_documents`
- [x] Add indexes on new columns
- [x] Repeat for `business_documents`
- [x] Create migration
- [ ] Test migration (pending migration run)

### 1.3 Schema Relations
- [x] Add relations in `relations.ts` for verification table
- [x] Update existing document relations if needed
- [x] Test relations resolve correctly

### 1.4 Database Constraints
- [x] Add unique constraint: one verification per document per loan application
- [x] Add check constraints if needed
- [ ] Test constraint violations (pending migration run)

## Phase 2: Core Service Layer

### 2.1 Verification Service
- [x] Create `kyc-kyb-verification.service.ts`
- [x] Implement `getDocumentsForVerification(loanApplicationId)`
  - [x] Fetch personal documents
  - [x] Fetch business documents
  - [x] Fetch verification statuses
  - [x] Merge and return formatted response
- [x] Implement `verifyDocument(loanApplicationId, documentId, documentType, status, adminId, reason?, notes?)`
  - [x] Validate loan application exists and is in correct status
  - [x] Validate document exists and belongs to loan application
  - [x] Create/update verification record
  - [x] Lock document
  - [x] Create audit trail entry
- [x] Implement `bulkVerifyDocuments(loanApplicationId, verifications[], adminId)`
  - [x] Validate all documents
  - [x] Process in transaction
  - [x] Create audit trail entries
- [x] Implement `completeKycKybVerification(loanApplicationId, adminId)`
  - [x] Validate at least some documents reviewed
  - [x] Update loan application status
  - [x] Create audit trail entry

### 2.2 Document Locking Logic
- [x] Create utility function to check if document is locked (integrated in verifyDocument)
- [x] Create utility function to lock document (integrated in verifyDocument)
- [x] Prevent updates to locked documents in document upload endpoints
- [x] Add middleware/validation for locked document checks

### 2.3 Auto-Creation of Verification Records
- [x] Create function to auto-create verification records when:
  - [x] Loan application status changes to kyc_kyb_verification (hooked into updateStatus)
  - [ ] New document uploaded (if loan in kyc_kyb_verification status) - deferred to testing phase
- [x] Hook into loan application status update service
- [ ] Hook into document upload services (deferred - can be added when documents uploaded during verification)

## Phase 3: API Endpoints

### 3.1 Get Documents for Verification
- [x] Create route `GET /loan-applications/:id/kyc-kyb-documents`
- [x] Add authentication/authorization (admin only)
- [x] Validate loan application exists
- [x] Call service to get documents
- [x] Format response with summary
- [x] Add error handling

### 3.2 Verify Single Document
- [x] Create route `POST /loan-applications/:id/documents/:documentId/verify`
- [x] Add request validation schema
- [x] Add authentication/authorization (admin only)
- [x] Validate loan application status
- [x] Call service to verify
- [x] Return updated document status
- [x] Add error handling

### 3.3 Bulk Verify Documents
- [x] Create route `POST /loan-applications/:id/kyc-kyb/bulk-verify`
- [x] Add request validation schema
- [x] Add authentication/authorization (admin only)
- [x] Validate all documents belong to loan application
- [x] Call bulk verify service
- [x] Return summary of verifications
- [x] Add error handling

### 3.4 Complete KYC/KYB
- [x] Create route `POST /loan-applications/:id/kyc-kyb/complete`
- [x] Add authentication/authorization (admin only)
- [x] Validate loan application status
- [x] Call completion service
- [x] Return updated loan application
- [x] Add error handling

### 3.5 Request Validation
- [x] Create Zod/JSON schemas for all endpoints
- [x] Add validation middleware
- [ ] Test invalid inputs (covered in Phase 6 testing)

## Phase 4: Integration & Workflow

### 4.1 Loan Application Status Update Hook
- [x] Update `LoanApplicationsService.updateStatus()` to:
  - [x] Auto-create verification records when status changes to `kyc_kyb_verification`
  - [x] Handle case where no documents exist yet
- [ ] Test with documents present (covered in Phase 6)
- [ ] Test with no documents (covered in Phase 6)

### 4.2 Document Upload Hooks
- [ ] Update personal document upload to:
  - [ ] Check if user has active loan in `kyc_kyb_verification`
  - [ ] Auto-create verification record if yes
- [ ] Update business document upload similarly
- [ ] Test document upload during verification (covered in Phase 6)
- [ ] Test document upload after verification (covered in Phase 6)

### 4.3 Document Update Prevention
- [x] Add checks in document update endpoints
- [x] Return appropriate error if document is locked
- [ ] Test update prevention (covered in Phase 6)
- [ ] Test error messages (covered in Phase 6)

### 4.4 Status Transition Logic
- [x] Ensure loan application can only enter `kyc_kyb_verification` correctly
- [x] Ensure transition to `eligibility_check` only after completion
- [x] Add status transition validation
- [ ] Test valid transitions (covered in Phase 6)
- [ ] Test invalid transitions (covered in Phase 6)

## Phase 5: Audit Trail Integration

### 5.1 Audit Trail Events
- [x] Add event type: `document_verified_approved`
- [x] Add event type: `document_verified_rejected`
- [x] Add event type: `kyc_kyb_completed`
- [x] Update audit trail enum if needed

### 5.2 Audit Trail Creation
- [x] Create audit entries in verification service
- [x] Include document details in audit entry
- [x] Include admin details
- [x] Include verification decision and reason
- [ ] Test audit entries are created correctly (covered in Phase 6)

## Phase 6: Testing

### 6.1 Unit Tests - Service Layer
- [x] Create test file structure (`kyc-kyb-verification.service.test.ts`)
- [ ] Test `getDocumentsForVerification()`
  - [x] Test structure created
  - [ ] Returns all documents (needs test DB setup)
  - [ ] Includes verification status (needs test DB setup)
  - [ ] Handles no documents case (needs test DB setup)
  - [ ] Handles no verification records case (needs test DB setup)
- [ ] Test `verifyDocument()`
  - [x] Test structure created
  - [ ] Creates verification record on approve (needs test DB setup)
  - [ ] Creates verification record on reject (needs test DB setup)
  - [ ] Locks document after verification (needs test DB setup)
  - [ ] Rejects if document already verified (needs test DB setup)
  - [ ] Rejects if loan application not in correct status (needs test DB setup)
- [ ] Test `bulkVerifyDocuments()`
  - [x] Test structure created
  - [ ] Processes all verifications (needs test DB setup)
  - [ ] Rolls back on error (needs test DB setup)
  - [ ] Handles partial failures correctly (needs test DB setup)
- [ ] Test `completeKycKybVerification()`
  - [x] Test structure created
  - [ ] Updates loan status (needs test DB setup)
  - [ ] Rejects if no documents reviewed (needs test DB setup)
  - [ ] Allows completion with some rejected (needs test DB setup)

### 6.2 Unit Tests - Document Locking
- [x] Create test file structure (`document-locking.test.ts`)
- [ ] Test document cannot be updated after lock (needs test DB setup)
- [ ] Test document can be updated before lock (needs test DB setup)
- [ ] Test locking sets correct fields (needs test DB setup)

### 6.3 Integration Tests - API Endpoints
- [x] Create test file structure (`kyc-kyb-verification.api.test.ts`)
- [ ] Test GET documents endpoint
  - [x] Test structure created
  - [ ] Returns correct structure (needs Fastify test setup)
  - [ ] Includes summary (needs Fastify test setup)
  - [ ] Handles unauthorized access (needs auth mocking)
  - [ ] Handles non-existent loan application (needs Fastify test setup)
- [ ] Test POST verify endpoint
  - [x] Test structure created
  - [ ] Approves document correctly (needs Fastify test setup)
  - [ ] Rejects document correctly (needs Fastify test setup)
  - [ ] Validates inputs (needs Fastify test setup)
  - [ ] Handles errors (needs Fastify test setup)
- [ ] Test POST bulk-verify endpoint
  - [x] Test structure created
  - [ ] Processes multiple verifications (needs Fastify test setup)
  - [ ] Handles partial failures (needs Fastify test setup)
- [ ] Test POST complete endpoint
  - [x] Test structure created
  - [ ] Transitions status correctly (needs Fastify test setup)
  - [ ] Creates audit trail (needs Fastify test setup)

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
