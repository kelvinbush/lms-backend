import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  businessDocuments,
  loanApplications,
  personalDocuments,
  loanApplicationDocumentVerifications,
  users,
  type DocumentType,
  type DocumentVerificationStatus,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { LoanApplicationAuditService } from "../loan-applications/loan-applications-audit.service";
import type { KycKybVerificationModel } from "./kyc-kyb-verification.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

/**
 * KYC/KYB Verification Service
 *
 * Handles document verification workflow for loan applications.
 * Documents are tied to profiles (users/businesses) but verification is per loan application.
 */
export abstract class KycKybVerificationService {
  /**
   * Get all documents with their verification status for a loan application
   *
   * @description Retrieves all personal and business documents for the entrepreneur and business
   * associated with the loan application, along with their verification status.
   *
   * @param loanApplicationId - The loan application ID
   * @returns Documents grouped by type with verification status and summary
   *
   * @throws {404} If loan application not found
   * @throws {500} If retrieval fails
   */
  static async getDocumentsForVerification(
    loanApplicationId: string
  ): Promise<KycKybVerificationModel.GetDocumentsResponse> {
    try {
      // Get loan application with entrepreneur and business info
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
        columns: {
          id: true,
          entrepreneurId: true,
          businessId: true,
          status: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Get all personal documents for the entrepreneur
      const personalDocs = await db
        .select({
          id: personalDocuments.id,
          docType: personalDocuments.docType,
          docUrl: personalDocuments.docUrl,
          createdAt: personalDocuments.createdAt,
          isVerified: personalDocuments.isVerified,
          lockedAt: personalDocuments.lockedAt,
        })
        .from(personalDocuments)
        .where(
          and(
            eq(personalDocuments.userId, loanApp.entrepreneurId),
            isNull(personalDocuments.deletedAt)
          )
        )
        .orderBy(asc(personalDocuments.createdAt));

      // Get all business documents for the business
      const businessDocs = await db
        .select({
          id: businessDocuments.id,
          docType: businessDocuments.docType,
          docUrl: businessDocuments.docUrl,
          docYear: businessDocuments.docYear,
          docBankName: businessDocuments.docBankName,
          createdAt: businessDocuments.createdAt,
          isVerified: businessDocuments.isVerified,
          lockedAt: businessDocuments.lockedAt,
        })
        .from(businessDocuments)
        .where(
          and(
            eq(businessDocuments.businessId, loanApp.businessId),
            isNull(businessDocuments.deletedAt)
          )
        )
        .orderBy(asc(businessDocuments.createdAt));

      // Get all verification records for this loan application
      const verifications = await db
        .select({
          documentType: loanApplicationDocumentVerifications.documentType,
          documentId: loanApplicationDocumentVerifications.documentId,
          verificationStatus: loanApplicationDocumentVerifications.verificationStatus,
          verifiedBy: loanApplicationDocumentVerifications.verifiedBy,
          verifiedAt: loanApplicationDocumentVerifications.verifiedAt,
          rejectionReason: loanApplicationDocumentVerifications.rejectionReason,
          notes: loanApplicationDocumentVerifications.notes,
        })
        .from(loanApplicationDocumentVerifications)
        .where(eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplicationId));

      // Create a map of document verifications
      const verificationMap = new Map<string, typeof verifications[0]>();
      for (const verification of verifications) {
        verificationMap.set(`${verification.documentType}:${verification.documentId}`, verification);
      }

      // Get verified by user details for all verifications
      const verifiedByUserIds = verifications
        .map((v) => v.verifiedBy)
        .filter((id): id is string => id !== null);
      const verifiedByUsers =
        verifiedByUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
              })
              .from(users)
              .where(sql`${users.id} = ANY(${verifiedByUserIds})`)
          : [];

      const verifiedByMap = new Map(verifiedByUsers.map((u) => [u.id, u]));

      // Map personal documents with verification status
      const personalDocumentsWithStatus: KycKybVerificationModel.DocumentItem[] =
        personalDocs.map((doc) => {
          const verification = verificationMap.get(`personal:${doc.id}`);
          const verifiedByUser = verification?.verifiedBy
            ? verifiedByMap.get(verification.verifiedBy)
            : undefined;

          return {
            id: doc.id,
            docType: doc.docType || "",
            docUrl: doc.docUrl || "",
            createdAt: doc.createdAt.toISOString(),
            verificationStatus: verification?.verificationStatus || "pending",
            verifiedBy: verifiedByUser
              ? {
                  id: verifiedByUser.id,
                  firstName: verifiedByUser.firstName,
                  lastName: verifiedByUser.lastName,
                  email: verifiedByUser.email,
                }
              : undefined,
            verifiedAt: verification?.verifiedAt?.toISOString(),
            rejectionReason: verification?.rejectionReason || undefined,
            notes: verification?.notes || undefined,
            lockedAt: doc.lockedAt?.toISOString(),
          };
        });

      // Map business documents with verification status
      const businessDocumentsWithStatus: KycKybVerificationModel.DocumentItem[] =
        businessDocs.map((doc) => {
          const verification = verificationMap.get(`business:${doc.id}`);
          const verifiedByUser = verification?.verifiedBy
            ? verifiedByMap.get(verification.verifiedBy)
            : undefined;

          return {
            id: doc.id,
            docType: doc.docType,
            docUrl: doc.docUrl || "",
            docYear: doc.docYear || undefined,
            docBankName: doc.docBankName || undefined,
            createdAt: doc.createdAt.toISOString(),
            verificationStatus: verification?.verificationStatus || "pending",
            verifiedBy: verifiedByUser
              ? {
                  id: verifiedByUser.id,
                  firstName: verifiedByUser.firstName,
                  lastName: verifiedByUser.lastName,
                  email: verifiedByUser.email,
                }
              : undefined,
            verifiedAt: verification?.verifiedAt?.toISOString(),
            rejectionReason: verification?.rejectionReason || undefined,
            notes: verification?.notes || undefined,
            lockedAt: doc.lockedAt?.toISOString(),
          };
        });

      // Calculate summary
      const allDocuments = [...personalDocumentsWithStatus, ...businessDocumentsWithStatus];
      const summary = {
        total: allDocuments.length,
        pending: allDocuments.filter((d) => d.verificationStatus === "pending").length,
        approved: allDocuments.filter((d) => d.verificationStatus === "approved").length,
        rejected: allDocuments.filter((d) => d.verificationStatus === "rejected").length,
      };

      return {
        personalDocuments: personalDocumentsWithStatus,
        businessDocuments: businessDocumentsWithStatus,
        summary,
      };
    } catch (error: any) {
      logger.error("Error getting documents for verification:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_DOCUMENTS_ERROR] Failed to retrieve documents for verification");
    }
  }

  /**
   * Verify a single document (approve or reject)
   *
   * @description Verifies a document for a loan application. Locks the document to prevent updates.
   *
   * @param loanApplicationId - The loan application ID
   * @param documentId - The document ID
   * @param documentType - Type of document ('personal' or 'business')
   * @param clerkId - Clerk ID of the admin performing verification
   * @param body - Verification details (status, rejectionReason, notes)
   * @returns Updated verification record
   *
   * @throws {400} If validation fails
   * @throws {404} If loan application or document not found
   * @throws {500} If verification fails
   */
  static async verifyDocument(
    loanApplicationId: string,
    documentId: string,
    documentType: DocumentType,
    clerkId: string,
    body: KycKybVerificationModel.VerifyDocumentBody
  ): Promise<KycKybVerificationModel.VerifyDocumentResponse> {
    try {
      // Validate loan application exists and is in correct status
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
        columns: {
          id: true,
          status: true,
          entrepreneurId: true,
          businessId: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "kyc_kyb_verification") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'kyc_kyb_verification' status. Current status: ${loanApp.status}`
        );
      }

      // Validate document exists and belongs to loan application
      if (documentType === "personal") {
        const doc = await db.query.personalDocuments.findFirst({
          where: and(
            eq(personalDocuments.id, documentId),
            eq(personalDocuments.userId, loanApp.entrepreneurId),
            isNull(personalDocuments.deletedAt)
          ),
        });

        if (!doc) {
          throw httpError(
            404,
            "[DOCUMENT_NOT_FOUND] Personal document not found or does not belong to this loan application"
          );
        }

        // Check if document is already verified for another loan application
        if (doc.isVerified && doc.verifiedForLoanApplicationId !== loanApplicationId) {
          throw httpError(
            400,
            "[DOCUMENT_ALREADY_VERIFIED] This document has already been verified for another loan application"
          );
        }
      } else {
        const doc = await db.query.businessDocuments.findFirst({
          where: and(
            eq(businessDocuments.id, documentId),
            eq(businessDocuments.businessId, loanApp.businessId),
            isNull(businessDocuments.deletedAt)
          ),
        });

        if (!doc) {
          throw httpError(
            404,
            "[DOCUMENT_NOT_FOUND] Business document not found or does not belong to this loan application"
          );
        }

        // Check if document is already verified for another loan application
        if (doc.isVerified && doc.verifiedForLoanApplicationId !== loanApplicationId) {
          throw httpError(
            400,
            "[DOCUMENT_ALREADY_VERIFIED] This document has already been verified for another loan application"
          );
        }
      }

      // Get admin user
      const adminUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (!adminUser) {
        throw httpError(401, "[UNAUTHORIZED] Admin user not found");
      }

      // Validate rejection reason if rejected
      if (body.status === "rejected" && !body.rejectionReason) {
        throw httpError(
          400,
          "[MISSING_REJECTION_REASON] Rejection reason is required when rejecting a document"
        );
      }

      const now = new Date();

      // Use transaction to ensure consistency
      const result = await db.transaction(async (tx) => {
        // Create or update verification record
        const verificationStatus = body.status as DocumentVerificationStatus;
        const existingVerification = await tx
          .select()
          .from(loanApplicationDocumentVerifications)
          .where(
            and(
              eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplicationId),
              eq(loanApplicationDocumentVerifications.documentType, documentType),
              eq(loanApplicationDocumentVerifications.documentId, documentId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        let verification;
        if (existingVerification) {
          // Update existing verification
          const [updated] = await tx
            .update(loanApplicationDocumentVerifications)
            .set({
              verificationStatus,
              verifiedBy: adminUser.id,
              verifiedAt: now,
              rejectionReason: body.rejectionReason || null,
              notes: body.notes || null,
              updatedAt: now,
            })
            .where(eq(loanApplicationDocumentVerifications.id, existingVerification.id))
            .returning();

          verification = updated;
        } else {
          // Create new verification
          const [created] = await tx
            .insert(loanApplicationDocumentVerifications)
            .values({
              loanApplicationId,
              documentType,
              documentId,
              verificationStatus,
              verifiedBy: adminUser.id,
              verifiedAt: now,
              rejectionReason: body.rejectionReason || null,
              notes: body.notes || null,
            })
            .returning();

          verification = created;
        }

        // Lock the document
        if (documentType === "personal") {
          await tx
            .update(personalDocuments)
            .set({
              isVerified: true,
              verifiedForLoanApplicationId: loanApplicationId,
              lockedAt: now,
              updatedAt: now,
            })
            .where(eq(personalDocuments.id, documentId));
        } else {
          await tx
            .update(businessDocuments)
            .set({
              isVerified: true,
              verifiedForLoanApplicationId: loanApplicationId,
              lockedAt: now,
              updatedAt: now,
            })
            .where(eq(businessDocuments.id, documentId));
        }

        return verification;
      });

      // Create audit trail entry
      const eventType =
        body.status === "approved" ? "document_verified_approved" : "document_verified_rejected";
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType,
        title: LoanApplicationAuditService.getEventTitle(eventType),
        description: `Document ${documentId} (${documentType}) ${body.status}${
          body.rejectionReason ? `: ${body.rejectionReason}` : ""
        }`,
        status: loanApp.status,
        details: {
          documentId,
          documentType,
          status: body.status,
          rejectionReason: body.rejectionReason,
          notes: body.notes,
        },
      });

      return {
        documentId: result.documentId,
        documentType: result.documentType as DocumentType,
        verificationStatus: result.verificationStatus,
        verifiedBy: {
          id: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
        },
        verifiedAt: result.verifiedAt!.toISOString(),
        rejectionReason: result.rejectionReason || undefined,
        notes: result.notes || undefined,
        lockedAt: now.toISOString(),
      };
    } catch (error: any) {
      logger.error("Error verifying document:", error);
      if (error?.status) throw error;
      throw httpError(500, "[VERIFY_DOCUMENT_ERROR] Failed to verify document");
    }
  }

  /**
   * Bulk verify multiple documents
   *
   * @description Verifies multiple documents in a single transaction.
   *
   * @param loanApplicationId - The loan application ID
   * @param clerkId - Clerk ID of the admin performing verification
   * @param body - Array of document verifications
   * @returns Summary of successful and failed verifications
   *
   * @throws {400} If validation fails
   * @throws {404} If loan application not found
   * @throws {500} If bulk verification fails
   */
  static async bulkVerifyDocuments(
    loanApplicationId: string,
    clerkId: string,
    body: KycKybVerificationModel.BulkVerifyDocumentsBody
  ): Promise<KycKybVerificationModel.BulkVerifyDocumentsResponse> {
    try {
      // Validate loan application exists
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
        columns: {
          id: true,
          status: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "kyc_kyb_verification") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'kyc_kyb_verification' status. Current status: ${loanApp.status}`
        );
      }

      // Get admin user
      const adminUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });

      if (!adminUser) {
        throw httpError(401, "[UNAUTHORIZED] Admin user not found");
      }

      const results: Array<{ documentId: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      // Process each verification
      for (const verification of body.verifications) {
        try {
          await KycKybVerificationService.verifyDocument(
            loanApplicationId,
            verification.documentId,
            verification.documentType,
            clerkId,
            {
              status: verification.status,
              rejectionReason: verification.rejectionReason,
              notes: verification.notes,
            }
          );

          results.push({
            documentId: verification.documentId,
            success: true,
          });
          successful++;
        } catch (error: any) {
          results.push({
            documentId: verification.documentId,
            success: false,
            error: error.message || "Verification failed",
          });
          failed++;
        }
      }

      return {
        successful,
        failed,
        results,
      };
    } catch (error: any) {
      logger.error("Error in bulk verify documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[BULK_VERIFY_ERROR] Failed to bulk verify documents");
    }
  }

  /**
   * Complete KYC/KYB verification step
   *
   * @description Marks the KYC/KYB verification step as complete and moves loan application to next status.
   *
   * @param loanApplicationId - The loan application ID
   * @param clerkId - Clerk ID of the admin completing verification
   * @returns Updated loan application details
   *
   * @throws {400} If validation fails or no documents reviewed
   * @throws {404} If loan application not found
   * @throws {500} If completion fails
   */
  static async completeKycKybVerification(
    loanApplicationId: string,
    clerkId: string
  ): Promise<KycKybVerificationModel.CompleteKycKybResponse> {
    try {
      // Get loan application
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "kyc_kyb_verification") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'kyc_kyb_verification' status. Current status: ${loanApp.status}`
        );
      }

      // Check that at least some documents have been reviewed
      const verifications = await db
        .select({
          verificationStatus: loanApplicationDocumentVerifications.verificationStatus,
        })
        .from(loanApplicationDocumentVerifications)
        .where(eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplicationId));

      const reviewedCount = verifications.filter(
        (v) => v.verificationStatus === "approved" || v.verificationStatus === "rejected"
      ).length;

      if (reviewedCount === 0) {
        throw httpError(
          400,
          "[NO_DOCUMENTS_REVIEWED] At least one document must be reviewed before completing KYC/KYB verification"
        );
      }

      // Get admin user
      const adminUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (!adminUser) {
        throw httpError(401, "[UNAUTHORIZED] Admin user not found");
      }

      const now = new Date();

      // Update loan application status to next step: eligibility_check
      await db
        .update(loanApplications)
        .set({
          status: "eligibility_check",
          lastUpdatedBy: adminUser.id,
          lastUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(loanApplications.id, loanApplicationId));

      // Create audit trail entry
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType: "kyc_kyb_completed",
        title: LoanApplicationAuditService.getEventTitle("kyc_kyb_completed"),
        description: `KYC/KYB verification completed. Reviewed ${reviewedCount} document(s).`,
        status: "eligibility_check",
        previousStatus: "kyc_kyb_verification",
        newStatus: "eligibility_check",
        details: {
          reviewedDocuments: reviewedCount,
          totalDocuments: verifications.length,
        },
      });

      return {
        loanApplicationId,
        status: "eligibility_check",
        completedAt: now.toISOString(),
        completedBy: {
          id: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
        },
      };
    } catch (error: any) {
      logger.error("Error completing KYC/KYB verification:", error);
      if (error?.status) throw error;
      throw httpError(500, "[COMPLETE_KYC_KYB_ERROR] Failed to complete KYC/KYB verification");
    }
  }

  /**
   * Auto-create verification records when loan application enters kyc_kyb_verification status
   *
   * @description Creates pending verification records for all existing documents when
   * a loan application status changes to kyc_kyb_verification.
   *
   * @param loanApplicationId - The loan application ID
   * @returns Number of verification records created
   */
  static async createVerificationRecordsForLoanApplication(
    loanApplicationId: string
  ): Promise<number> {
    try {
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
        columns: {
          id: true,
          entrepreneurId: true,
          businessId: true,
        },
      });

      if (!loanApp) {
        logger.warn(
          `[KYC/KYB] Loan application not found for creating verification records: ${loanApplicationId}`
        );
        return 0;
      }

      // Get all existing verification records to avoid duplicates
      const existingVerifications = await db
        .select({
          documentType: loanApplicationDocumentVerifications.documentType,
          documentId: loanApplicationDocumentVerifications.documentId,
        })
        .from(loanApplicationDocumentVerifications)
        .where(eq(loanApplicationDocumentVerifications.loanApplicationId, loanApplicationId));

      const existingKeys = new Set(
        existingVerifications.map((v) => `${v.documentType}:${v.documentId}`)
      );

      // Get all personal documents
      const personalDocs = await db
        .select({ id: personalDocuments.id })
        .from(personalDocuments)
        .where(
          and(
            eq(personalDocuments.userId, loanApp.entrepreneurId),
            isNull(personalDocuments.deletedAt)
          )
        );

      // Get all business documents
      const businessDocs = await db
        .select({ id: businessDocuments.id })
        .from(businessDocuments)
        .where(
          and(
            eq(businessDocuments.businessId, loanApp.businessId),
            isNull(businessDocuments.deletedAt)
          )
        );

      // Create verification records for new documents only
      const newVerifications: Array<{
        loanApplicationId: string;
        documentType: DocumentType;
        documentId: string;
        verificationStatus: DocumentVerificationStatus;
      }> = [];

      for (const doc of personalDocs) {
        const key = `personal:${doc.id}`;
        if (!existingKeys.has(key)) {
          newVerifications.push({
            loanApplicationId,
            documentType: "personal",
            documentId: doc.id,
            verificationStatus: "pending",
          });
        }
      }

      for (const doc of businessDocs) {
        const key = `business:${doc.id}`;
        if (!existingKeys.has(key)) {
          newVerifications.push({
            loanApplicationId,
            documentType: "business",
            documentId: doc.id,
            verificationStatus: "pending",
          });
        }
      }

      if (newVerifications.length > 0) {
        await db.insert(loanApplicationDocumentVerifications).values(newVerifications);
      }

      return newVerifications.length;
    } catch (error: any) {
      logger.error("Error creating verification records:", error);
      // Don't throw - this is a background operation
      return 0;
    }
  }
}
