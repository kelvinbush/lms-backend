# Eligibility Assessment Design - Brainstorming Document

## Overview
When moving a loan application from `eligibility_check` → `credit_analysis`, we need to:
1. **Store eligibility assessment comment** (required)
2. **Store optional supporting document** (new document type: "loan documents")
3. **Track next approver** (similar to KYC/KYB completion pattern)

## Current Context

### Existing Patterns
- **KYC/KYB Completion**: `completeKycKybVerification()` method stores next approver info and sends email notification
- **Document Types**: Currently we have:
  - `personal_documents` - Documents tied to users
  - `business_documents` - Documents tied to businesses
  - `loan_application_document_verifications` - Verification status for personal/business docs per loan application

### Status Flow
```
kyc_kyb_verification → eligibility_check → credit_analysis → ...
```

## Design Options

### Option 1: Store Comment + Document on Loan Application Table

**Schema Changes:**
```typescript
// Add to loanApplications table
eligibilityAssessmentComment: text("eligibility_assessment_comment"), // Required when moving to credit_analysis
eligibilityAssessmentDocumentUrl: text("eligibility_assessment_document_url"), // Optional
eligibilityAssessmentCompletedAt: timestamp("eligibility_assessment_completed_at"),
eligibilityAssessmentCompletedBy: varchar("eligibility_assessment_completed_by"), // References users.id
```

**Pros:**
- Simple, all data in one place
- Easy to query
- Fast access

**Cons:**
- Adds multiple fields to loanApplications table
- Doesn't scale if we need assessment data for other stages
- Document URL only (no metadata like name, type, upload date, etc.)
- Not flexible for multiple documents per assessment

### Option 2: Separate "Loan Documents" Table (Recommended)

**New Table: `loan_documents`**
```typescript
export const loanDocumentTypeEnum = pgEnum("loan_document_type", [
  "eligibility_assessment_support",
  "credit_analysis_report",
  "approval_memo",
  "committee_decision_document",
  "offer_letter",
  "contract",
  "disbursement_authorization",
  // ... other loan-specific document types
]);

export const loanDocuments = pgTable("loan_documents", {
  id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
  loanApplicationId: varchar("loan_application_id", { length: 24 })
    .notNull()
    .references(() => loanApplications.id, { onDelete: "cascade" }),
  documentType: loanDocumentTypeEnum("document_type").notNull(),
  docUrl: text("doc_url").notNull(),
  docName: varchar("doc_name", { length: 255 }), // Optional display name
  uploadedBy: varchar("uploaded_by", { length: 24 })
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  notes: text("notes"), // Optional notes about the document
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

**Add to loanApplications table:**
```typescript
eligibilityAssessmentComment: text("eligibility_assessment_comment"), // Required when moving to credit_analysis
eligibilityAssessmentCompletedAt: timestamp("eligibility_assessment_completed_at"),
eligibilityAssessmentCompletedBy: varchar("eligibility_assessment_completed_by"), // References users.id
```

**Pros:**
- Clean separation of concerns
- Scalable - can track documents for all stages
- Supports multiple documents per stage if needed
- Includes metadata (name, uploader, upload date)
- Follows existing pattern (personal_documents, business_documents)
- Can be queried/displayed separately

**Cons:**
- More complex schema
- Requires join for queries
- More tables to manage

### Option 3: Assessment Table + Loan Documents Table

**New Table: `loan_application_assessments`**
```typescript
export const loanApplicationAssessments = pgTable("loan_application_assessments", {
  id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
  loanApplicationId: varchar("loan_application_id", { length: 24 })
    .notNull()
    .references(() => loanApplications.id, { onDelete: "cascade" }),
  assessmentType: varchar("assessment_type", { length: 50 }).notNull(), // "eligibility", "credit", etc.
  comment: text("comment").notNull(),
  completedBy: varchar("completed_by", { length: 24 })
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  // Link to supporting document (if using loan_documents table)
  supportingDocumentId: varchar("supporting_document_id", { length: 24 }), // References loan_documents.id
});
```

**Pros:**
- Very flexible - can track assessments for multiple stages
- Separates assessment logic from loan application table
- Can track history of assessments

**Cons:**
- Most complex option
- Overkill if we only need this for eligibility assessment
- Requires more joins

## Recommendation: Option 2 (Separate Loan Documents Table)

This provides the best balance of:
- Clean architecture
- Scalability for future stages
- Following existing patterns
- Flexibility for multiple documents

## Implementation Plan

### 1. Database Schema Changes

#### A. Create `loan_documents` table
- New enum for loan document types
- Table with loanApplicationId, documentType, docUrl, docName, uploadedBy, notes
- Indexes on loanApplicationId, documentType
- Relations: loanApplication (many-to-one), uploadedByUser (many-to-one)

#### B. Add fields to `loan_applications` table
- `eligibilityAssessmentComment` (text, nullable)
- `eligibilityAssessmentCompletedAt` (timestamp, nullable)
- `eligibilityAssessmentCompletedBy` (varchar, references users.id, nullable)

#### C. Consider: Should we store next approver info?
- **Option A**: Store on loan_applications table (like current KYC/KYB pattern doesn't persist)
- **Option B**: Don't persist (only send email)
- **Option C**: Store in a separate `loan_application_approvers` table

**Question**: Do we need to persist next approver info, or is email notification enough?

### 2. Service Layer

#### Create `eligibility-assessment.service.ts`
Similar structure to `kyc-kyb-verification.service.ts`:

```typescript
static async completeEligibilityAssessment(
  loanApplicationId: string,
  clerkId: string,
  body: {
    comment: string; // Required
    supportingDocument?: {
      docUrl: string;
      docName?: string;
    };
    nextApprover?: {
      nextApproverEmail: string;
      nextApproverName?: string;
    };
  }
): Promise<EligibilityAssessmentResponse>
```

**Behavior:**
- Validate loan application is in `eligibility_check` status
- Validate comment is provided
- Create loan document record if supporting document provided
- Update loan application:
  - Set `eligibilityAssessmentComment`
  - Set `eligibilityAssessmentCompletedAt`
  - Set `eligibilityAssessmentCompletedBy`
  - Update status to `credit_analysis`
  - Update `lastUpdatedBy`/`lastUpdatedAt`
- Create audit trail entry
- Send email notification if nextApprover provided
- Return updated loan application info

### 3. API Endpoints

#### POST `/loan-applications/:id/eligibility-assessment/complete`

**Request Body:**
```typescript
{
  comment: string; // Required
  supportingDocument?: {
    docUrl: string;
    docName?: string;
  };
  nextApprover?: {
    nextApproverEmail: string;
    nextApproverName?: string;
  };
}
```

**Response:**
```typescript
{
  loanApplicationId: string;
  status: "credit_analysis";
  completedAt: string;
  completedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  eligibilityAssessmentComment: string;
  supportingDocument?: {
    id: string;
    docUrl: string;
    docName?: string;
  };
}
```

#### GET `/loan-applications/:id/loan-documents`
List all loan documents for a loan application (future use)

### 4. Questions to Answer

1. **Next Approver Persistence**: Should we store next approver info in the database, or just use it for email notification?

2. **Document Upload**: Should documents be uploaded separately first (with upload endpoint), or can they be referenced by URL in the completion request?

3. **Multiple Documents**: Can there be multiple supporting documents per eligibility assessment, or just one?

4. **Document Storage**: Are documents stored in S3/storage service, or just URLs to external locations?

5. **Comments History**: Should we allow updates to eligibility assessment, or is it one-time only? (affects whether we need assessment history table)

6. **Validation**: Any specific validation rules for the comment (length, format)?

7. **Email Template**: Reuse existing `sendLoanStageReviewNotificationEmail` or create new template?

## Next Steps

1. ✅ Review and discuss design options
2. ⏭️ Answer questions above
3. ⏭️ Finalize schema design
4. ⏭️ Create migration
5. ⏭️ Implement service layer
6. ⏭️ Create API endpoints
7. ⏭️ Add audit trail events
8. ⏭️ Integration testing
