import { describe, it, expect, beforeEach, vi } from "vitest";
import { testDb } from "./db";
import {
  createTestAdmin,
  createTestEntrepreneur,
  createTestOrganization,
  createTestLoanProduct,
  createTestBusiness,
  createTestPersonalDocument,
  createTestBusinessDocument,
  createTestLoanApplication,
  type TestUser,
  type TestLoanApplication,
} from "./fixtures";

// Mock the database module to use test database
// This must be before the service import
vi.mock("../src/db", async () => {
  const { testDb } = await import("./db");
  return {
    db: testDb,
    schema: await import("../src/db/schema"),
  };
});

// Mock the audit service to avoid external dependencies in unit tests
vi.mock("../src/modules/loan-applications/loan-applications-audit.service", () => ({
  LoanApplicationAuditService: {
    logEvent: vi.fn().mockResolvedValue(undefined),
    getEventTitle: vi.fn((eventType: string) => `Test ${eventType}`),
  },
}));

// Import service after mocks are set up
import { KycKybVerificationService } from "../src/modules/kyc-kyb-verification/kyc-kyb-verification.service";
import { loanApplicationDocumentVerifications } from "../src/db/schema/loanApplicationDocumentVerifications";
import { eq, and } from "drizzle-orm";

describe("KycKybVerificationService", () => {
  // Test data
  let adminUser: TestUser;
  let entrepreneurUser: TestUser;
  let loanApplication: TestLoanApplication;
  let personalDocId: string;
  let businessDocId: string;
  let organizationId: string;
  let loanProductId: string;

  beforeEach(async () => {
    // Recreate all test data after cleanup in beforeEach
    // This ensures fresh data for each test and avoids foreign key issues
    adminUser = await createTestAdmin();
    entrepreneurUser = await createTestEntrepreneur();
    organizationId = await createTestOrganization();
    loanProductId = await createTestLoanProduct(organizationId);
    
    const businessId = await createTestBusiness(entrepreneurUser.id);
    personalDocId = await createTestPersonalDocument(entrepreneurUser.id);
    businessDocId = await createTestBusinessDocument(businessId);
    loanApplication = await createTestLoanApplication(
      businessId,
      entrepreneurUser.id,
      loanProductId,
      "kyc_kyb_verification"
    );
  });

  describe("getDocumentsForVerification", () => {
    it("should return all documents with verification status", async () => {
      const result = await KycKybVerificationService.getDocumentsForVerification(
        loanApplication.id
      );

      expect(result).toBeDefined();
      expect(result.personalDocuments).toBeInstanceOf(Array);
      expect(result.businessDocuments).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();

      // Check that our test documents are included
      const personalDoc = result.personalDocuments.find((d) => d.id === personalDocId);
      expect(personalDoc).toBeDefined();
      expect(personalDoc?.verificationStatus).toBe("pending");

      const businessDoc = result.businessDocuments.find((d) => d.id === businessDocId);
      expect(businessDoc).toBeDefined();
      expect(businessDoc?.verificationStatus).toBe("pending");
    });

    it("should include summary with counts", async () => {
      const result = await KycKybVerificationService.getDocumentsForVerification(
        loanApplication.id
      );

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.pending).toBeGreaterThanOrEqual(0);
      expect(result.summary.approved).toBeGreaterThanOrEqual(0);
      expect(result.summary.rejected).toBeGreaterThanOrEqual(0);
      expect(result.summary.total).toBe(
        result.summary.pending + result.summary.approved + result.summary.rejected
      );
    });

    it("should handle loan application with no documents", async () => {
      // Create a fresh entrepreneur with no documents
      const freshEntrepreneur = await createTestEntrepreneur();
      const businessId = await createTestBusiness(freshEntrepreneur.id);
      const emptyLoanApp = await createTestLoanApplication(
        businessId,
        freshEntrepreneur.id,
        loanProductId,
        "kyc_kyb_verification"
      );

      const result = await KycKybVerificationService.getDocumentsForVerification(
        emptyLoanApp.id
      );

      expect(result.personalDocuments).toEqual([]);
      expect(result.businessDocuments).toEqual([]);
      expect(result.summary.total).toBe(0);
      expect(result.summary.pending).toBe(0);
    });

    it("should handle loan application with no verification records", async () => {
      const result = await KycKybVerificationService.getDocumentsForVerification(
        loanApplication.id
      );

      // All documents should have pending status when no verifications exist
      result.personalDocuments.forEach((doc) => {
        expect(doc.verificationStatus).toBe("pending");
      });
      result.businessDocuments.forEach((doc) => {
        expect(doc.verificationStatus).toBe("pending");
      });
    });

    it("should return 404 for non-existent loan application", async () => {
      await expect(
        KycKybVerificationService.getDocumentsForVerification("non-existent-id")
      ).rejects.toThrow("Loan application not found");
    });
  });

  describe("verifyDocument", () => {
    it("should approve document and lock it", async () => {
      const result = await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        personalDocId,
        "personal",
        adminUser.clerkId,
        {
          status: "approved",
          notes: "Document looks good",
        }
      );

      expect(result.verificationStatus).toBe("approved");
      expect(result.documentId).toBe(personalDocId);
      expect(result.verifiedBy).toBeDefined();
      expect(result.verifiedBy.id).toBe(adminUser.id);
      expect(result.verifiedAt).toBeDefined();
      expect(result.lockedAt).toBeDefined();

      // Verify document is locked in database
      const { testDb: testDbInstance } = await import("./db");
      const lockedDoc = await testDbInstance.query.personalDocuments.findFirst({
        where: (pd, { eq }) => eq(pd.id, personalDocId),
      });

      expect(lockedDoc?.isVerified).toBe(true);
      expect(lockedDoc?.lockedAt).toBeDefined();
      expect(lockedDoc?.verifiedForLoanApplicationId).toBe(loanApplication.id);
    });

    it("should reject document with reason and lock it", async () => {
      const result = await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        personalDocId,
        "personal",
        adminUser.clerkId,
        {
          status: "rejected",
          rejectionReason: "Document is unclear",
          notes: "Please upload a clearer version",
        }
      );

      expect(result.verificationStatus).toBe("rejected");
      expect(result.rejectionReason).toBe("Document is unclear");
      expect(result.notes).toBe("Please upload a clearer version");
      expect(result.lockedAt).toBeDefined();

      // Verify document is locked
      const { testDb: testDbInstance } = await import("./db");
      const lockedDoc = await testDbInstance.query.personalDocuments.findFirst({
        where: (pd, { eq }) => eq(pd.id, personalDocId),
      });

      expect(lockedDoc?.isVerified).toBe(true);
      expect(lockedDoc?.lockedAt).toBeDefined();
    });

    it("should reject verification if loan application not in kyc_kyb_verification status", async () => {
      // Create loan application in different status
      const businessId = await createTestBusiness(entrepreneurUser.id);
      const docId = await createTestPersonalDocument(entrepreneurUser.id);
      const otherLoanApp = await createTestLoanApplication(
        businessId,
        entrepreneurUser.id,
        loanProductId,
        "eligibility_check" // Different status
      );

      await expect(
        KycKybVerificationService.verifyDocument(
          otherLoanApp.id,
          docId,
          "personal",
          adminUser.clerkId,
          {
            status: "approved",
          }
        )
      ).rejects.toThrow("Loan application must be in 'kyc_kyb_verification' status");
    });

    it("should reject verification if document already verified for another loan", async () => {
      // Create first loan and verify document
      const businessId1 = await createTestBusiness(entrepreneurUser.id);
      const docId = await createTestPersonalDocument(entrepreneurUser.id);
      const loanApp1 = await createTestLoanApplication(
        businessId1,
        entrepreneurUser.id,
        loanProductId,
        "kyc_kyb_verification"
      );

      await KycKybVerificationService.verifyDocument(
        loanApp1.id,
        docId,
        "personal",
        adminUser.clerkId,
        {
          status: "approved",
        }
      );

      // Try to verify same document for different loan
      const businessId2 = await createTestBusiness(entrepreneurUser.id);
      const loanApp2 = await createTestLoanApplication(
        businessId2,
        entrepreneurUser.id,
        loanProductId,
        "kyc_kyb_verification"
      );

      await expect(
        KycKybVerificationService.verifyDocument(
          loanApp2.id,
          docId,
          "personal",
          adminUser.clerkId,
          {
            status: "approved",
          }
        )
      ).rejects.toThrow("already been verified for another loan application");
    });

    it("should reject verification if document doesn't belong to loan application", async () => {
      // Create a different user's document
      const otherUser = await createTestEntrepreneur();
      const otherBusinessId = await createTestBusiness(otherUser.id);
      const otherDocId = await createTestPersonalDocument(otherUser.id);

      await expect(
        KycKybVerificationService.verifyDocument(
          loanApplication.id,
          otherDocId,
          "personal",
          adminUser.clerkId,
          {
            status: "approved",
          }
        )
      ).rejects.toThrow("not found or does not belong to this loan application");
    });

    it("should require rejection reason when rejecting", async () => {
      await expect(
        KycKybVerificationService.verifyDocument(
          loanApplication.id,
          personalDocId,
          "personal",
          adminUser.clerkId,
          {
            status: "rejected",
            // Missing rejectionReason
          }
        )
      ).rejects.toThrow("Rejection reason is required when rejecting a document");
    });

    it("should update existing verification record", async () => {
      // First create a pending verification record
      const { createTestVerification } = await import("./fixtures");
      await createTestVerification(
        loanApplication.id,
        "personal",
        personalDocId,
        "pending"
      );

      // Now verify it (should update, not create new)
      const result = await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        personalDocId,
        "personal",
        adminUser.clerkId,
        {
          status: "approved",
        }
      );

      expect(result.verificationStatus).toBe("approved");

      // Verify only one verification record exists
      const { testDb: testDbInstance } = await import("./db");
      const verifications = await testDbInstance
        .select()
        .from(loanApplicationDocumentVerifications)
        .where(
          and(
            eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplication.id),
            eq(loanApplicationDocumentVerifications.documentId, personalDocId)
          )
        );

      expect(verifications.length).toBe(1);
    });
  });

  describe("bulkVerifyDocuments", () => {
    it("should process multiple verifications", async () => {
      // Create additional documents
      const personalDoc2Id = await createTestPersonalDocument(
        entrepreneurUser.id,
        "national_id_back"
      );
      const businessDoc2Id = await createTestBusinessDocument(
        loanApplication.businessId,
        "tax_registration_certificate"
      );

      const result = await KycKybVerificationService.bulkVerifyDocuments(
        loanApplication.id,
        adminUser.clerkId,
        {
          verifications: [
            {
              documentId: personalDocId,
              documentType: "personal",
              status: "approved",
              notes: "Approved doc 1",
            },
            {
              documentId: personalDoc2Id,
              documentType: "personal",
              status: "approved",
              notes: "Approved doc 2",
            },
            {
              documentId: businessDocId,
              documentType: "business",
              status: "rejected",
              rejectionReason: "Unclear document",
            },
          ],
        }
      );

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(3);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it("should handle partial failures gracefully", async () => {
      // Create one valid document
      const validDocId = await createTestPersonalDocument(entrepreneurUser.id);

      const result = await KycKybVerificationService.bulkVerifyDocuments(
        loanApplication.id,
        adminUser.clerkId,
        {
          verifications: [
            {
              documentId: validDocId,
              documentType: "personal",
              status: "approved",
            },
            {
              documentId: "invalid-doc-id",
              documentType: "personal",
              status: "approved",
            },
          ],
        }
      );

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results.find((r) => r.documentId === validDocId)?.success).toBe(true);
      expect(result.results.find((r) => r.documentId === "invalid-doc-id")?.success).toBe(false);
    });
  });

  describe("completeKycKybVerification", () => {
    it("should update loan status to eligibility_check", async () => {
      // First verify at least one document
      await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        personalDocId,
        "personal",
        adminUser.clerkId,
        {
          status: "approved",
        }
      );

      const result = await KycKybVerificationService.completeKycKybVerification(
        loanApplication.id,
        adminUser.clerkId
      );

      expect(result.status).toBe("eligibility_check");
      expect(result.completedBy.id).toBe(adminUser.id);

      // Verify loan application status was updated
      const { getLoanApplicationById } = await import("./fixtures");
      const updatedLoan = await getLoanApplicationById(loanApplication.id);
      expect(updatedLoan?.status).toBe("eligibility_check");
    });

    it("should reject if no documents have been reviewed", async () => {
      await expect(
        KycKybVerificationService.completeKycKybVerification(
          loanApplication.id,
          adminUser.clerkId
        )
      ).rejects.toThrow("At least one document must be reviewed");
    });

    it("should allow completion with some documents rejected", async () => {
      // Verify some documents as approved, some as rejected
      await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        personalDocId,
        "personal",
        adminUser.clerkId,
        {
          status: "approved",
        }
      );

      await KycKybVerificationService.verifyDocument(
        loanApplication.id,
        businessDocId,
        "business",
        adminUser.clerkId,
        {
          status: "rejected",
          rejectionReason: "Needs updating",
        }
      );

      const result = await KycKybVerificationService.completeKycKybVerification(
        loanApplication.id,
        adminUser.clerkId
      );

      expect(result.status).toBe("eligibility_check");
    });

    it("should reject if loan application not in kyc_kyb_verification status", async () => {
      // Create loan application in different status
      const businessId = await createTestBusiness(entrepreneurUser.id);
      const otherLoanApp = await createTestLoanApplication(
        businessId,
        entrepreneurUser.id,
        loanProductId,
        "eligibility_check"
      );

      await expect(
        KycKybVerificationService.completeKycKybVerification(
          otherLoanApp.id,
          adminUser.clerkId
        )
      ).rejects.toThrow("Loan application must be in 'kyc_kyb_verification' status");
    });
  });

  describe("createVerificationRecordsForLoanApplication", () => {
    it("should create verification records for all existing documents", async () => {
      const count = await KycKybVerificationService.createVerificationRecordsForLoanApplication(
        loanApplication.id
      );

      expect(count).toBeGreaterThan(0);

      // Verify records were created
      const { testDb: testDbInstance } = await import("./db");
      const verifications = await testDbInstance
        .select()
        .from(loanApplicationDocumentVerifications)
        .where(
          eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplication.id)
        );

      expect(verifications.length).toBeGreaterThan(0);
      expect(verifications.some((v) => v.documentId === personalDocId)).toBe(true);
      expect(verifications.some((v) => v.documentId === businessDocId)).toBe(true);
    });

    it("should not create duplicate verification records", async () => {
      // Create records first time
      const count1 = await KycKybVerificationService.createVerificationRecordsForLoanApplication(
        loanApplication.id
      );
      expect(count1).toBeGreaterThan(0);

      // Try to create again
      const count2 = await KycKybVerificationService.createVerificationRecordsForLoanApplication(
        loanApplication.id
      );
      expect(count2).toBe(0); // Should not create duplicates

      // Verify total count didn't increase
      const { testDb: testDbInstance } = await import("./db");
      const verifications = await testDbInstance
        .select()
        .from(loanApplicationDocumentVerifications)
        .where(
          eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplication.id)
        );

      expect(verifications.length).toBe(count1);
    });

    it("should handle loan application with no documents", async () => {
      // Create a fresh entrepreneur with no documents
      const freshEntrepreneur = await createTestEntrepreneur();
      const businessId = await createTestBusiness(freshEntrepreneur.id);
      const emptyLoanApp = await createTestLoanApplication(
        businessId,
        freshEntrepreneur.id,
        loanProductId,
        "kyc_kyb_verification"
      );

      const count = await KycKybVerificationService.createVerificationRecordsForLoanApplication(
        emptyLoanApp.id
      );

      expect(count).toBe(0);
    });
  });
});
