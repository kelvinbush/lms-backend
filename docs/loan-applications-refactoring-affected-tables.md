# Loan Applications Refactoring - Affected Tables and Code

This document lists all database tables, schemas, services, and code files that are related to loan applications and will need to be cleaned up or refactored based on the new `loanProducts.ts` schema and business logic requirements.

## Database Tables (Schema Files)

### Core Loan Application Tables

1. **`loan_applications`** (`src/db/schema/loanApplications.ts`)
   - Main loan applications table
   - Contains: applicationNumber, userId, businessId, loanProductId, loanAmount, loanTerm, currency, purpose, status, etc.
   - **Status**: Needs complete refactoring to align with new API requirements
   - **Relations**: References users, businessProfiles, loanProducts

2. **`loan_application_snapshots`** (`src/db/schema/loanApplicationSnapshots.ts`)
   - Immutable snapshots of loan applications at approval points
   - **Status**: May need refactoring if snapshot structure changes
   - **Relations**: References loanApplications (cascade delete)

3. **`application_audit_trail`** (`src/db/schema/applicationAuditTrail.ts`)
   - Audit trail for all loan application actions
   - **Status**: May need updates if action types change
   - **Relations**: References loanApplications (cascade delete), users

4. **`loan_product_snapshots`** (`src/db/schema/loanProductSnapshots.ts`)
   - Snapshots of loan products at application creation time
   - **Status**: May need updates if product structure changes
   - **Relations**: References loanApplications (cascade delete), loanProducts

5. **`document_requests`** (`src/db/schema/documentRequests.ts`)
   - Document requests related to loan applications
   - **Status**: May need updates if workflow changes
   - **Relations**: References loanApplications (cascade delete), users

6. **`offer_letters`** (`src/db/schema/offerLetters.ts`)
   - Offer letters linked to loan applications
   - **Status**: May need updates if offer letter workflow changes
   - **Relations**: References loanApplications (cascade delete)

### Related Tables (Indirect Dependencies)

7. **`users`** (`src/db/schema/users.ts`)
   - Has relation: `loanApplications: many(loanApplications)`
   - **Status**: Relation may need updates

8. **`business_profiles`** (`src/db/schema/businessProfiles.ts`)
   - Has relation: `loanApplications: many(loanApplications)`
   - **Status**: Relation may need updates

9. **`loan_products`** (`src/db/schema/loanProducts.ts`)
   - Has relation: `loanApplications: many(loanApplications)`
   - **Status**: This is the NEW schema - keep as reference
   - **Note**: This table is being used as the basis for refactoring

## Database Relations

**File**: `src/db/schema/relations.ts`

The following relations need to be reviewed/updated:
- `loanApplicationsRelations` - Main relations for loan applications
- `loanApplicationSnapshotsRelations` - Relations for snapshots
- `applicationAuditTrailRelations` - Relations for audit trail
- `documentRequestsRelations` - Relations for document requests
- `offerLettersRelations` - Relations for offer letters
- `loanProductSnapshotsRelations` - Relations for product snapshots
- `usersRelations` - Contains `loanApplications: many(loanApplications)`
- `businessProfilesRelations` - Contains `loanApplications: many(loanApplications)`
- `loanProductsRelations` - Contains `loanApplications: many(loanApplications)`

## Service/Module Files

### Core Loan Application Services

1. **`src/modules/loan-applications/loan-applications.service.ts`**
   - Main service for loan application operations
   - Contains: create, list, get, update, delete methods
   - **Status**: Needs complete refactoring

2. **`src/modules/loan-applications/loan-applications.model.ts`**
   - TypeScript models and interfaces for loan applications
   - **Status**: Needs refactoring to match new API requirements

3. **`src/modules/loan-applications/loan-applications.schemas.ts`**
   - JSON schemas for validation
   - **Status**: Needs refactoring to match new API requirements

4. **`src/modules/loan-applications/loan-applications.mapper.ts`**
   - Data mapping functions
   - **Status**: Needs refactoring to match new data structure

### Route Files

5. **`src/routes/loan-applications.routes.ts`**
   - API routes for loan applications
   - **Status**: Needs refactoring to match new API requirements

### Supporting Services (May Reference Loan Applications)

6. **`src/modules/status/status.service.ts`**
   - Status management service
   - **Status**: May need updates if status workflow changes
   - **References**: Uses `loanApplications` table

7. **`src/modules/snapshots/snapshot.service.ts`**
   - Snapshot creation service
   - **Status**: May need updates if snapshot structure changes
   - **References**: Uses `loanApplications` table

8. **`src/modules/audit-trail/audit-trail.service.ts`**
   - Audit trail service
   - **Status**: May need updates if audit actions change
   - **References**: Uses `applicationAuditTrail` table

9. **`src/modules/notifications/notification.service.ts`**
   - Notification service
   - **Status**: May need updates if notification triggers change
   - **References**: Uses `loanApplications` table

10. **`src/modules/offer-letters/offer-letters.service.ts`**
    - Offer letter service
    - **Status**: May need updates if offer letter workflow changes
    - **References**: Uses `loanApplications` table

11. **`src/services/docusign-webhook.service.ts`**
    - DocuSign webhook handler
    - **Status**: May need updates if offer letter workflow changes
    - **References**: Uses `loanApplications` and `offerLetters` tables

12. **`src/services/user-deletion.service.ts`**
    - User deletion service
    - **Status**: May need updates if cascade logic changes
    - **References**: Uses `loanApplications` and related tables

13. **`src/modules/query-optimization/query-optimization.service.ts`**
    - Query optimization service
    - **Status**: May need updates if query patterns change
    - **References**: Uses `loanApplications` table

14. **`src/modules/loan-products/loan-products.service.ts`**
    - Loan products service
    - **Status**: May need updates if product-application relationship changes
    - **References**: Uses `loanApplications` table for statistics/queries

## Schema Exports

**File**: `src/db/schema/index.ts`
- Exports all schema files including loan application related schemas
- **Status**: Review to ensure all exports are correct

**File**: `src/db/schema.ts` (if exists)
- May export schema files
- **Status**: Review if exists

## Server Registration

**File**: `src/server.ts`
- Registers `loanApplicationsRoutes`
- **Status**: Should remain, but routes will be updated

## Key Differences to Address

Based on the API requirements document, the new structure should support:

1. **New Status Values**: The API requirements define different status values:
   - `kyc_kyb_verification`
   - `eligibility_check`
   - `credit_analysis`
   - `head_of_credit_review`
   - `internal_approval_ceo`
   - `committee_decision`
   - `sme_offer_approval`
   - `document_generation`
   - `signing_execution`
   - `awaiting_disbursement`
   - `approved`
   - `rejected`
   - `disbursed`
   - `cancelled`

   Current status enum has different values that need to be updated.

2. **New Fields Required**:
   - `loanId` (auto-generated display ID like "LN-48291")
   - `entrepreneurId` (separate from userId)
   - `fundingAmount` / `fundingCurrency` (may replace loanAmount/currency)
   - `convertedAmount` / `convertedCurrency` / `exchangeRate` (for currency conversion)
   - `repaymentPeriod` (may replace loanTerm)
   - `intendedUseOfFunds` (may replace purpose/purposeDescription)
   - `interestRate` (stored at application level)
   - `loanSource` (source of application)

3. **Field Mappings**:
   - Current `applicationNumber` → New `loanId` (format: "LN-XXXXX")
   - Current `loanAmount` → New `fundingAmount`
   - Current `loanTerm` → New `repaymentPeriod`
   - Current `purpose` + `purposeDescription` → New `intendedUseOfFunds`
   - Need to add `entrepreneurId` (may be same as userId or separate)

## Cleanup Checklist

### Database Tables
- [ ] Review and refactor `loan_applications` table schema
- [ ] Review `loan_application_snapshots` table (may need updates)
- [ ] Review `application_audit_trail` table (update action types if needed)
- [ ] Review `loan_product_snapshots` table
- [ ] Review `document_requests` table
- [ ] Review `offer_letters` table
- [ ] Update all relations in `relations.ts`

### Services
- [ ] Refactor `loan-applications.service.ts`
- [ ] Refactor `loan-applications.model.ts`
- [ ] Refactor `loan-applications.schemas.ts`
- [ ] Refactor `loan-applications.mapper.ts`
- [ ] Review `status.service.ts`
- [ ] Review `snapshot.service.ts`
- [ ] Review `audit-trail.service.ts`
- [ ] Review `notification.service.ts`
- [ ] Review `offer-letters.service.ts`
- [ ] Review `docusign-webhook.service.ts`
- [ ] Review `user-deletion.service.ts`
- [ ] Review `query-optimization.service.ts`
- [ ] Review `loan-products.service.ts`

### Routes
- [ ] Refactor `loan-applications.routes.ts`

### Documentation
- [ ] Update any documentation referencing old loan application structure

## Notes

- The `loanProducts` table is the NEW schema and should be kept as reference
- All other tables and code should be reviewed and refactored to align with the new requirements
- Consider data migration strategy if there's existing data in production
- Ensure foreign key constraints are properly updated
- Update all enum types to match new status values and other enums
