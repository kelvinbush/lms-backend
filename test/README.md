# Test Setup Guide

## Overview

Test infrastructure has been set up for the KYC/KYB verification system. The test files are structured and ready for implementation once the test database setup is configured.

## Test Files Created

1. **`kyc-kyb-verification.service.test.ts`** - Unit tests for the verification service methods
2. **`document-locking.test.ts`** - Tests for document locking functionality
3. **`kyc-kyb-verification.api.test.ts`** - Integration tests for API endpoints

## Setup Required

To run these tests, you need to:

### 1. Database Setup
- ✅ Test database connection configured in `test/db.ts` using `DATABASE_TEST_URL`
- ✅ Test fixtures created in `test/fixtures.ts`
- ⚠️ **IMPORTANT**: Sync schema to test database before running tests:

  **Option 1: Update .env.local temporarily**
  ```bash
  # Backup your current DATABASE_URL
  # Temporarily set DATABASE_URL to DATABASE_TEST_URL in .env.local
  # Then run:
  bun run db:push
  # Restore your original DATABASE_URL
  ```

  **Option 2: Use drizzle-kit directly with test URL**
  ```bash
  # Manually set DATABASE_TEST_URL in .env.local first
  DATABASE_URL=$(grep DATABASE_TEST_URL .env.local | cut -d '=' -f2) bun run db:push
  ```

  The schema needs to be synced once. After that, tests will work with the database.

### 2. Test Utilities
- Database cleanup helpers (rollback transactions, truncate tables)
- Test data factories (create users, loan applications, documents)
- Mock/stub for external services (Clerk auth, email service)

### 3. Authentication Mocking
- Mock Clerk authentication for API tests
- Create test admin and entrepreneur users

## Running Tests

Once setup is complete:
```bash
# Run all tests
bun run test

# Run in watch mode
bun run test:watch

# Run with coverage
bun run test:coverage
```

## Test Coverage

The test files cover:
- ✅ Service layer methods (`kyc-kyb-verification.service.test.ts`) - **FULLY IMPLEMENTED**
  - `getDocumentsForVerification()` - all test cases
  - `verifyDocument()` - all test cases
  - `bulkVerifyDocuments()` - all test cases
  - `completeKycKybVerification()` - all test cases
  - `createVerificationRecordsForLoanApplication()` - all test cases
- ✅ Document locking logic (`document-locking.test.ts`) - **FULLY IMPLEMENTED**
  - Personal document locking tests
  - Business document locking tests
- ⚠️ API endpoints (`kyc-kyb-verification.api.test.ts`) - **STRUCTURED, NEEDS IMPLEMENTATION**
  - Test structure in place, requires Fastify test server setup and auth mocking

## Implementation Status

✅ **COMPLETED:**
1. Test database connection setup (`test/db.ts`)
2. Test fixtures/factories (`test/fixtures.ts`)
3. Service layer test implementation
4. Document locking test implementation
5. Database cleanup utilities

⚠️ **PENDING:**
1. Sync schema to test database (manual step required once)
2. API endpoint tests (requires Fastify test server setup)
3. Authentication mocking for API tests
