# Admin SME Management - Multi-Step Onboarding Implementation Plan

## Overview
Enable admins (super-admin, admin, member) to create SME users through a 7-step onboarding process:
1. User Information (email, firstName, lastName, phone, dob, gender, position)
2. Business Basic Info (logo, name, entity type, year, sectors, description, program/user group, criteria, employees, website, videos, photos)
3. Location Info (countries of operation, HQ, city, registered office address)
4. Personal Documents
5. Business Documents - Company Info (CR1, CR2, CR8, CR12, etc.)
6. Business Documents - Financial
7. Business Documents - Permits & Pitch Deck

**Key Features:**
- Draft state management (can save partially and continue later)
- Step-by-step save (each step saves immediately)
- Can send invitation at any time (even before all steps complete)
- Backward compatible with existing SME UI
- Support going back to edit previous steps

---

## Phase 1: Database Schema Updates

### 1.1 Users Table - Add Onboarding Fields
- [ ] Add `onboardingStatus` enum: `draft`, `pending_invitation`, `active`
- [ ] Add `onboardingStatus` column to users table (default: `draft`)
- [ ] Add `onboardingStep` integer column (1-7, nullable)
- [ ] Make `clerkId` nullable (will be null until invitation accepted)
- [ ] Update user model types

### 1.2 Business Profiles - Add New Fields (All Nullable for Backward Compatibility)
- [ ] Add `logo` text field (for logo URL)
- [ ] Add `sectors` text array or JSON field (multiple sectors - new)
- [ ] Keep existing `sector` varchar field (for backward compatibility)
- [ ] Add `selectionCriteria` text array or JSON field (2xCriteria - optional, array of strings)
- [ ] Add `noOfEmployees` integer field
- [ ] Add `website` text field
- [ ] Add `registeredOfficeAddress` text field
- [ ] Add `registeredOfficeCity` varchar field
- [ ] Add `registeredOfficeZipCode` varchar field
- [ ] Add `companyHQ` varchar field
- [ ] Update business model types

### 1.3 Business User Groups - Junction Table
- [ ] Create `businessUserGroups` table schema
- [ ] Fields: `id`, `businessId` (FK), `groupId` (FK), `createdAt`
- [ ] Add unique constraint on (businessId, groupId)
- [ ] Add indexes for queries

### 1.4 Business Countries - Junction Table
- [ ] Create `businessCountries` table schema
- [ ] Fields: `id`, `businessId` (FK), `country` (varchar), `createdAt`
- [ ] Add unique constraint on (businessId, country)
- [ ] Add indexes for queries

### 1.5 Business Photos - Separate Table
- [ ] Create `businessPhotos` table schema
- [ ] Fields: `id`, `businessId` (FK), `photoUrl` (text), `displayOrder` (integer), `createdAt`, `deletedAt`
- [ ] Add constraint: max 5 photos per business (enforce in service layer)
- [ ] Add indexes for queries

### 1.6 Business Video Links - Separate Table
- [ ] Create `businessVideoLinks` table schema
- [ ] Fields: `id`, `businessId` (FK), `videoUrl` (text), `source` (varchar - e.g., "youtube", "vimeo", "direct"), `displayOrder` (integer), `createdAt`, `deletedAt`
- [ ] Add indexes for queries

### 1.7 SME Onboarding Progress - Tracking Table
- [ ] Create `smeOnboardingProgress` table schema
- [ ] Fields: `id`, `userId` (FK, unique), `currentStep` (integer 1-7), `completedSteps` (integer array or JSON), `lastSavedAt` (timestamp), `createdAt`, `updatedAt`
- [ ] Add indexes for queries

### 1.8 Business Documents - Add New Document Types
- [ ] Add `CR1`, `CR2`, `CR8`, `CR12` to `businessDocumentTypeEnum`
- [ ] Keep all existing document types (backward compatibility)
- [ ] Update business document model types

### 1.9 Database Migrations
- [ ] Create migration for all schema changes
- [ ] Test migration on dev database
- [ ] Ensure backward compatibility (existing data still works)

---

## Phase 2: Admin SME Service - Multi-Step Onboarding

### 2.1 Create Admin SME Module Structure
- [ ] Create `src/modules/admin-sme/` directory
- [ ] Create `admin-sme.service.ts` with core business logic
- [ ] Create `admin-sme.model.ts` with types and schemas for all 7 steps
- [ ] Create `admin-sme.utils.ts` for helper functions

### 2.2 Step 1: User Creation Service
- [ ] `createSMEUser()` - Create user with draft status
  - Required: email, firstName, lastName, phone, dob, gender, position
  - Set `onboardingStatus: 'draft'`
  - Set `onboardingStep: 1`
  - Create entry in `smeOnboardingProgress`
  - Return user ID for subsequent steps

### 2.3 Step 2: Business Basic Info Service
- [ ] `saveBusinessBasicInfo(userId, data)` - Save/update Step 2 data
  - Create or update business profile
  - Handle: logo, name, entityType, yearOfIncorporation, sectors (array), description
  - Handle: userGroupId (single for now, or multiple via junction table)
  - Handle: selectionCriteria (array of strings)
  - Handle: noOfEmployees, website
  - Handle: videoLinks (create/update in businessVideoLinks table)
  - Handle: businessPhotos (create/update in businessPhotos table, max 5)
  - Update `onboardingStep` and `completedSteps`
  - Transaction: ensure all or nothing

### 2.4 Step 3: Location Info Service
- [ ] `saveLocationInfo(userId, data)` - Save/update Step 3 data
  - Update business profile: companyHQ, city, registeredOfficeAddress, registeredOfficeCity, registeredOfficeZipCode
  - Handle: countriesOfOperation (array) - create/update in businessCountries table
  - Update `onboardingStep` and `completedSteps`

### 2.5 Step 4: Personal Documents Service
- [ ] `savePersonalDocuments(userId, data)` - Save/update Step 4 data
  - Upsert personal documents (reuse existing Documents service or create admin version)
  - Accept admin override (skip ownership check)
  - Update `onboardingStep` and `completedSteps`

### 2.6 Step 5: Business Documents - Company Info Service
- [ ] `saveCompanyInfoDocuments(businessId, data)` - Save/update Step 5 data
  - Upsert business documents with types: CR1, CR2, CR8, CR12, certificate_of_incorporation, etc.
  - Reuse existing BusinessDocuments service with admin override
  - Update `onboardingStep` and `completedSteps`

### 2.7 Step 6: Business Documents - Financial Service
- [ ] `saveFinancialDocuments(businessId, data)` - Save/update Step 6 data
  - Upsert financial documents: annual_bank_statement, audited_financial_statements, income_statements, etc.
  - Handle year-based documents (docYear field)
  - Update `onboardingStep` and `completedSteps`

### 2.8 Step 7: Business Documents - Permits & Pitch Deck Service
- [ ] `savePermitAndPitchDocuments(businessId, data)` - Save/update Step 7 data
  - Upsert: business_permit, pitch_deck, company_profile
  - Update `onboardingStep` and `completedSteps`
  - Optionally mark onboarding as "complete" (if all steps done)

### 2.9 Invitation Service
- [ ] `sendSMEInvitation(userId, adminClerkId)` - Send Clerk invitation
  - Can be called at any time (even if steps incomplete)
  - Create Clerk invitation with metadata (firstName, lastName, gender, email)
  - Update user `onboardingStatus: 'pending_invitation'`
  - Store invitation ID for tracking
  - Return invitation details

### 2.10 Get Onboarding State Service
- [ ] `getOnboardingState(userId)` - Get current state of all steps
  - Return user data, business data, documents, progress
  - Return which steps are completed
  - Return current step

### 2.11 Validation & Error Handling
- [ ] Validate required fields per step
- [ ] Check for duplicate emails (Step 1)
- [ ] Validate business data (Step 2)
- [ ] Validate document types and formats
- [ ] Handle Clerk API errors gracefully
- [ ] Transaction rollback on errors

---

## Phase 3: Webhook Handler Updates

### 3.1 Modify User Created Handler
- [ ] Update `ClerkWebhookService.handleUserCreated()` to check for existing local user by email
- [ ] If user exists with `draft` or `pending_invitation` status:
  - Update with `clerkId`
  - Set `onboardingStatus: 'active'`
  - Extract gender from Clerk metadata (unsafeMetadata)
- [ ] If user doesn't exist, create new user (existing flow)
- [ ] Handle metadata extraction for SME users

### 3.2 Update User Data Extraction
- [ ] Modify `extractUserDataFromWebhook()` to handle SME users
  - Gender required (from unsafeMetadata)
  - Phone/dob optional for admin-created users
  - Check for `isInternal` flag in publicMetadata (SME users should not have this)

---

## Phase 4: Admin Routes - Multi-Step Onboarding

### 4.1 Create Admin SME Routes
- [ ] Create `src/routes/admin-sme.routes.ts`
- [ ] Register routes in `server.ts` with prefix `/admin/sme`

### 4.2 Step-by-Step Endpoints
- [ ] `POST /admin/sme/onboarding/start` - Create user (Step 1)
  - Body: email, firstName, lastName, phone, dob, gender, position
  - Returns: userId, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/1` - Save Step 1 (user info)
  - Body: email, firstName, lastName, phone, dob, gender, position
  - Returns: updated user, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/2` - Save Step 2 (business basic)
  - Body: logo, name, entityType, year, sectors[], description, userGroupId, criteria[], noOfEmployees, website, videoLinks[], businessPhotos[]
  - Returns: business, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/3` - Save Step 3 (location)
  - Body: countriesOfOperation[], companyHQ, city, registeredOfficeAddress, registeredOfficeCity, registeredOfficeZipCode
  - Returns: business, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/4` - Save Step 4 (personal docs)
  - Body: documents[] (docType, docUrl)
  - Returns: documents, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/5` - Save Step 5 (company info docs)
  - Body: documents[] (docType, docUrl, docPassword, isPasswordProtected)
  - Returns: documents, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/6` - Save Step 6 (financial docs)
  - Body: documents[] (docType, docUrl, docYear, docBankName, etc.)
  - Returns: documents, onboardingState

- [ ] `PUT /admin/sme/onboarding/:userId/step/7` - Save Step 7 (permit & pitch)
  - Body: documents[] (docType, docUrl)
  - Returns: documents, onboardingState

### 4.3 Utility Endpoints
- [ ] `GET /admin/sme/onboarding/:userId` - Get current onboarding state
  - Returns: user, business, all documents, progress (currentStep, completedSteps)

- [ ] `POST /admin/sme/onboarding/:userId/invite` - Send/Resend invitation
  - Can be called at any time
  - Returns: invitationId, status

- [ ] `GET /admin/sme/users` - List all SME users (with filters)
  - Query params: status, step, search
  - Returns: list of users with business info

- [ ] `GET /admin/sme/users/:userId` - Get single SME user with full details
  - Returns: user, business, documents, progress

### 4.4 Authorization
- [ ] Add authorization middleware to all routes
- [ ] Use `requireRole()` utility (admin, super-admin, member)
- [ ] Ensure admin can only access their own created SMEs (or all if super-admin)

---

## Phase 5: Document Management Integration

### 5.1 Update Personal Documents Service
- [ ] Modify `Documents.upsert()` to accept admin override parameter
- [ ] Skip ownership check when admin override is true
- [ ] Or create `Documents.adminUpsert()` method

### 5.2 Update Business Documents Service
- [ ] Modify `BusinessDocuments.upsert()` to accept admin override parameter
- [ ] Skip ownership check when admin override is true
- [ ] Or create `BusinessDocuments.adminUpsert()` method

### 5.3 Document Type Validation
- [ ] Ensure new document types (CR1, CR2, CR8, CR12) are validated
- [ ] Update document type schemas

---

## Phase 6: Audit Trail (Future)

### 6.1 Create Admin Audit Trail Schema
- [ ] Create `adminAuditTrail` table schema
- [ ] Define audit action enum:
  - `sme_user_created`, `sme_user_updated`
  - `sme_business_created`, `sme_business_updated`
  - `sme_step_saved` (with step number)
  - `sme_invitation_sent`, `sme_invitation_resent`
  - `sme_document_uploaded`, `sme_document_updated`
- [ ] Link to admin user (who performed action) and target SME user
- [ ] Store metadata (JSON) for action details

### 6.2 Implement Audit Logging
- [ ] Create `AdminAuditService` for logging admin actions
- [ ] Integrate audit logging into all `AdminSMEService` methods
- [ ] Log: who (admin clerkId), what (action), when (timestamp), target (SME userId), metadata

### 6.3 Audit Trail Queries
- [ ] `GET /admin/audit-trail` - List admin actions (with filters)
- [ ] `GET /admin/audit-trail/users/:userId` - Get audit trail for specific SME user

---

## Phase 7: Testing & Documentation

### 7.1 Testing
- [ ] Unit tests for each step service method
- [ ] Integration tests for step-by-step endpoints
- [ ] Test webhook handler with pre-created users
- [ ] Test invitation flow end-to-end
- [ ] Test going back to edit previous steps
- [ ] Test sending invitation before all steps complete
- [ ] Test backward compatibility (existing SME UI still works)

### 7.2 Documentation
- [ ] Update API documentation (Swagger) for all new endpoints
- [ ] Document multi-step onboarding workflow
- [ ] Document schema changes and backward compatibility
- [ ] Add code comments for complex logic
- [ ] Document admin permissions

---

## Phase 8: Edge Cases & Error Handling

### 8.1 Handle Edge Cases
- [ ] User accepts invitation but local user not found (shouldn't happen, but handle gracefully)
- [ ] Duplicate invitation attempts (check if already sent)
- [ ] Business creation for user that doesn't exist (validate userId)
- [ ] Invitation sent to user that already has active account (check status)
- [ ] Going back to edit step that hasn't been saved yet
- [ ] Saving step when business doesn't exist yet (create it)
- [ ] Max 5 business photos constraint
- [ ] Multiple user groups assignment

### 8.2 Error Messages
- [ ] Clear, actionable error messages per step
- [ ] Proper HTTP status codes
- [ ] Error logging for debugging
- [ ] Validation error details

### 8.3 Data Consistency
- [ ] Ensure transactions for multi-table operations
- [ ] Handle partial saves gracefully
- [ ] Clean up orphaned records on errors

---

## Implementation Notes

### Backward Compatibility Strategy
- **Users Table**: Make `clerkId` nullable (existing users have it, new drafts won't)
- **Business Profiles**: All new fields are nullable (existing businesses work as-is)
- **Sector Field**: Keep old `sector` varchar field, add new `sectors` array field
- **Document Types**: Add new types to enum (existing types still work)
- **Existing Services**: Don't modify existing user/business services, create admin versions

### Data Flow Example
```
1. Admin creates user → POST /admin/sme/onboarding/start
   → User created with status='draft', step=1

2. Admin fills Step 2 → PUT /admin/sme/onboarding/:userId/step/2
   → Business created, photos/videos saved, step=2

3. Admin goes back → PUT /admin/sme/onboarding/:userId/step/1
   → User updated, step=1

4. Admin completes all steps → PUT /admin/sme/onboarding/:userId/step/7
   → All steps marked complete

5. Admin sends invitation → POST /admin/sme/onboarding/:userId/invite
   → Clerk invitation sent, status='pending_invitation'

6. User accepts → Webhook fires
   → clerkId linked, status='active'
```

### Schema Design Decisions
- **Business Photos**: Separate table (better for queries, ordering, deletion)
- **Video Links**: Separate table (supports multiple sources, ordering)
- **Countries**: Junction table (normalized, easy to query)
- **User Groups**: Junction table (supports multiple groups per business)
- **Selection Criteria**: JSON array in business profile (simple, flexible)
- **Sectors**: JSON array in business profile (new field, old `sector` kept for compatibility)

---

## Next Steps
1. Start with Phase 1 (Database Schema Updates)
2. Then Phase 2 (Service Layer)
3. Then Phase 4 (Routes)
4. Then Phase 3 (Webhook Updates)
5. Finally Phase 7 & 8 (Testing & Edge Cases)
