# Loan Applications Refactoring - Affected Tables and Code

This document lists all database tables, schemas, services, and code files that are related to loan applications and will need to be cleaned up or refactored based on the new `loanProducts.ts` schema and business logic requirements.

## ✅ Cleanup Status: COMPLETED

All loan application related tables, services, and code have been deleted/removed. The codebase is now ready for fresh implementation based on the new API requirements.

## Database Tables (Schema Files)

### Core Loan Application Tables

**✅ DELETED** - All core loan application tables have been removed:

1. ~~**`loan_applications`** (`src/db/schema/loanApplications.ts`)**~~ - ✅ DELETED
2. ~~**`loan_application_snapshots`** (`src/db/schema/loanApplicationSnapshots.ts`)**~~ - ✅ DELETED
3. ~~**`application_audit_trail`** (`src/db/schema/applicationAuditTrail.ts`)**~~ - ✅ DELETED
4. ~~**`loan_product_snapshots`** (`src/db/schema/loanProductSnapshots.ts`)**~~ - ✅ DELETED
5. ~~**`document_requests`** (`src/db/schema/documentRequests.ts`)**~~ - ✅ DELETED
6. ~~**`offer_letters`** (`src/db/schema/offerLetters.ts`)**~~ - ✅ DELETED

### Related Tables (Indirect Dependencies)

**✅ UPDATED** - Relations have been removed:

7. **`users`** (`src/db/schema/users.ts`)
   - ~~Has relation: `loanApplications: many(loanApplications)`~~ - ✅ REMOVED
   - **Status**: Relations cleaned up

8. **`business_profiles`** (`src/db/schema/businessProfiles.ts`)
   - ~~Has relation: `loanApplications: many(loanApplications)`~~ - ✅ REMOVED
   - **Status**: Relations cleaned up

9. **`loan_products`** (`src/db/schema/loanProducts.ts`)
   - ~~Has relation: `loanApplications: many(loanApplications)`~~ - ✅ REMOVED (with TODO comment)
   - **Status**: This is the NEW schema - kept as reference
   - **Note**: Loan application logic removed from service with TODO comments for re-implementation

## Database Relations

**File**: `src/db/schema/relations.ts`

**✅ CLEANED UP** - All loan application relations have been removed:

- ~~`loanApplicationsRelations`~~ - ✅ DELETED
- ~~`loanApplicationSnapshotsRelations`~~ - ✅ DELETED
- ~~`applicationAuditTrailRelations`~~ - ✅ DELETED
- ~~`documentRequestsRelations`~~ - ✅ DELETED
- ~~`offerLettersRelations`~~ - ✅ DELETED
- ~~`loanProductSnapshotsRelations`~~ - ✅ DELETED
- `usersRelations` - ✅ REMOVED `loanApplications: many(loanApplications)`
- `businessProfilesRelations` - ✅ REMOVED `loanApplications: many(loanApplications)`
- `loanProductsRelations` - ✅ REMOVED `loanApplications: many(loanApplications)` (with TODO comment)

## Service/Module Files

### Core Loan Application Services

**✅ DELETED** - All core loan application services have been removed:

1. ~~**`src/modules/loan-applications/loan-applications.service.ts`**~~ - ✅ DELETED
2. ~~**`src/modules/loan-applications/loan-applications.model.ts`**~~ - ✅ DELETED
3. ~~**`src/modules/loan-applications/loan-applications.schemas.ts`**~~ - ✅ DELETED
4. ~~**`src/modules/loan-applications/loan-applications.mapper.ts`**~~ - ✅ DELETED

### Route Files

**✅ DELETED** - Loan application routes have been removed:

5. ~~**`src/routes/loan-applications.routes.ts`**~~ - ✅ DELETED

### Supporting Services

**✅ DELETED** - All supporting services that were loan-application specific have been removed:

6. ~~**`src/modules/status/status.service.ts`**~~ - ✅ DELETED
7. ~~**`src/modules/status/status.model.ts`**~~ - ✅ DELETED
8. ~~**`src/modules/snapshots/snapshot.service.ts`**~~ - ✅ DELETED
9. ~~**`src/modules/audit-trail/audit-trail.service.ts`**~~ - ✅ DELETED
10. ~~**`src/modules/notifications/notification.service.ts`**~~ - ✅ DELETED
11. ~~**`src/modules/notifications/notification.model.ts`**~~ - ✅ DELETED
12. ~~**`src/modules/offer-letters/offer-letters.service.ts`**~~ - ✅ DELETED
13. ~~**`src/modules/offer-letters/offer-letters.model.ts`**~~ - ✅ DELETED
14. ~~**`src/modules/offer-letters/offer-letters.mapper.ts`**~~ - ✅ DELETED
15. ~~**`src/services/docusign-webhook.service.ts`**~~ - ✅ DELETED

**✅ REFACTORED** - Services that had loan application dependencies have been cleaned up:

16. **`src/services/user-deletion.service.ts`**
    - ✅ REFACTORED - Removed all loan application deletion logic
    - Added TODO comments for re-implementation

17. **`src/modules/loan-products/loan-products.service.ts`**
    - ✅ REFACTORED - Removed all loan application queries and logic
    - Added TODO comments throughout for re-implementation
    - Removed `loansCount` from queries (commented out with TODOs)
    - Removed loan application validation checks (commented out with TODOs)

## Schema Exports

**File**: `src/db/schema/index.ts`
- ✅ UPDATED - Removed all loan application related schema exports
- All loan application schema exports have been removed

## Server Registration

**File**: `src/server.ts`
- ✅ UPDATED - Removed loan application route registration
- `loanApplicationsRoutes` registration commented out with TODO
- `offerLettersRoutes` registration commented out with TODO
- `documentRequestsRoutes` registration commented out with TODO
- `webhookRoutes` registration commented out with TODO

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
- [x] ✅ Delete `loan_applications` table schema
- [x] ✅ Delete `loan_application_snapshots` table schema
- [x] ✅ Delete `application_audit_trail` table schema
- [x] ✅ Delete `loan_product_snapshots` table schema
- [x] ✅ Delete `document_requests` table schema
- [x] ✅ Delete `offer_letters` table schema
- [x] ✅ Remove all loan application relations from `relations.ts`
- [x] ✅ Remove loan application exports from `schema/index.ts`

### Services
- [x] ✅ Delete `loan-applications.service.ts`
- [x] ✅ Delete `loan-applications.model.ts`
- [x] ✅ Delete `loan-applications.schemas.ts`
- [x] ✅ Delete `loan-applications.mapper.ts`
- [x] ✅ Delete `status.service.ts`
- [x] ✅ Delete `status.model.ts`
- [x] ✅ Delete `snapshot.service.ts`
- [x] ✅ Delete `audit-trail.service.ts`
- [x] ✅ Delete `notification.service.ts`
- [x] ✅ Delete `notification.model.ts`
- [x] ✅ Delete `offer-letters.service.ts`
- [x] ✅ Delete `offer-letters.model.ts`
- [x] ✅ Delete `offer-letters.mapper.ts`
- [x] ✅ Delete `docusign-webhook.service.ts`
- [x] ✅ Refactor `user-deletion.service.ts` (removed loan application logic)
- [x] ✅ Refactor `loan-products.service.ts` (removed loan application logic, added TODOs)

### Routes
- [x] ✅ Delete `loan-applications.routes.ts`
- [x] ✅ Remove route registrations from `server.ts` (commented with TODOs)

### Documentation
- [x] ✅ Update refactoring documentation

## Notes

- ✅ **Cleanup Complete**: All loan application related code has been removed
- The `loanProducts` table is the NEW schema and is kept as reference
- All loan application logic has been removed from `loan-products.service.ts` with TODO comments for re-implementation
- Route registrations have been commented out in `server.ts` with TODO comments
- The codebase is now ready for fresh implementation based on the new API requirements

## Next Steps

1. **Create New Loan Application Schema**: Based on the new API requirements
2. **Implement New Services**: Create fresh loan application services matching the new requirements
3. **Re-wire Loan Products Service**: Uncomment and update the TODO sections in `loan-products.service.ts`
4. **Re-implement Routes**: Create new route handlers for loan applications
5. **Re-implement Supporting Services**: Create new status, snapshot, audit trail, and notification services as needed
6. **Update Relations**: Add back loan application relations when new schema is ready
