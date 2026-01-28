import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  businessDocumentTypeEnum,
  businessDocuments,
  businessProfiles,
  smeOnboardingProgress,
  users,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import type { AdminSMEModel } from "./admin-sme.model";
import { httpError } from "./admin-sme.utils";

/**
 * Step 6: Financial Documents Service
 * Handles annual_bank_statement, audited_financial_statements, income_statements, etc.
 */
export abstract class AdminSMEStep6Service {
  /**
   * Save Financial Documents
   * Upserts business documents for financial info (supports year-based and bank-specific docs)
   */
  static async saveFinancialDocuments(
    userId: string,
    payload: AdminSMEModel.Step6FinancialDocumentsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Normalize to array
      const docsArray = payload.documents;

      // Validate and normalize documents
      const normalized = docsArray.map((d) => ({
        docType: d.docType,
        docUrl: d.docUrl,
        isPasswordProtected: !!d.isPasswordProtected,
        docPassword: d.isPasswordProtected ? (d.docPassword ?? null) : null,
        docYear: d.docYear ?? null,
        docBankName: d.docBankName ?? null,
        docName: d.docName ?? null,
      }));

      // Validate document types and required fields
      for (let i = 0; i < normalized.length; i++) {
        const d = normalized[i];
        if (!d.docType || !businessDocumentTypeEnum.enumValues.includes(d.docType as any)) {
          throw httpError(
            400,
            `[INVALID_DOC_TYPE] Document ${i}: docType "${d.docType}" is not a valid business document type`
          );
        }
        if (!d.docUrl || typeof d.docUrl !== "string" || d.docUrl.length === 0) {
          throw httpError(400, `[INVALID_DOC_URL] Document ${i}: docUrl is required`);
        }
        if (d.isPasswordProtected && (!d.docPassword || d.docPassword.length === 0)) {
          throw httpError(
            400,
            `[INVALID_DOC_PASSWORD] Document ${i}: docPassword is required when isPasswordProtected is true`
          );
        }
        // Validate docYear for documents that require it
        if (d.docType === "audited_financial_statements" && d.docYear === null) {
          throw httpError(
            400,
            `[INVALID_DOC_YEAR] Document ${i}: docYear is required for audited_financial_statements`
          );
        }
        // Require docName when docType is 'other'
        if (d.docType === "other" && (!d.docName || d.docName.length === 0)) {
          throw httpError(
            400,
            `[INVALID_DOC_NAME] Document ${i}: docName is required when docType is 'other'`
          );
        }
      }

      // Execute in transaction - all queries inside for consistency and performance
      const { updatedUser, updatedBusiness, progressResult } = await db.transaction(async (tx) => {
        // Verify user exists
        const user = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) {
          throw httpError(404, "[USER_NOT_FOUND] User not found");
        }

        // Get business (must exist from Step 2)
        const business = await tx.query.businessProfiles.findFirst({
          where: and(eq(businessProfiles.userId, userId), isNull(businessProfiles.deletedAt)),
        });

        if (!business) {
          throw httpError(
            404,
            "[BUSINESS_NOT_FOUND] Business not found. Please complete Step 2 first."
          );
        }

        // Get existing progress to compute completed steps
        const existingProgress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (existingProgress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(6)) {
          completedSteps.push(6);
        }

        // Batch query: Get all existing documents for these types in one query
        // Note: We match by docType only for non-'other' docs; 'other' always creates new rows
        const existingDocs = await tx.query.businessDocuments.findMany({
          where: and(
            eq(businessDocuments.businessId, business.id),
            inArray(
              businessDocuments.docType,
              normalized.map((d) => d.docType as any)
            ),
            isNull(businessDocuments.deletedAt)
          ),
        });

        // Group existing by docType (take first match per type, as original logic)
        const existingByType = new Map<string, typeof businessDocuments.$inferSelect>();
        for (const doc of existingDocs) {
          if (!existingByType.has(doc.docType)) {
            existingByType.set(doc.docType, doc);
          }
        }

        // Prepare batch operations
        const toUpdate: Array<{ id: string; doc: (typeof normalized)[0] }> = [];
        const toInsert: typeof normalized = [];

        for (const doc of normalized) {
          // For 'other' type, always insert a new document (allow multiple 'other' docs)
          if (doc.docType === "other") {
            toInsert.push(doc);
            continue;
          }

          const existing = existingByType.get(doc.docType);
          if (existing) {
            toUpdate.push({ id: existing.id, doc });
          } else {
            toInsert.push(doc);
          }
        }

        // Prepare parallel operations
        const parallelOps: Promise<any>[] = [];

        // Batch updates
        for (const { id, doc } of toUpdate) {
          parallelOps.push(
            tx
              .update(businessDocuments)
              .set({
                docUrl: doc.docUrl,
                isPasswordProtected: doc.isPasswordProtected,
                docPassword: doc.docPassword,
                docYear: doc.docYear,
                docBankName: doc.docBankName,
                docName: doc.docName,
                updatedAt: new Date(),
              } as any)
              .where(eq(businessDocuments.id, id))
          );
        }

        // Batch insert
        if (toInsert.length > 0) {
          parallelOps.push(
            tx.insert(businessDocuments).values(
              toInsert.map((doc) => ({
                businessId: business.id,
                docType: doc.docType as any,
                docUrl: doc.docUrl,
                isPasswordProtected: doc.isPasswordProtected,
                docPassword: doc.docPassword,
                docYear: doc.docYear,
                docBankName: doc.docBankName,
                docName: doc.docName,
              })) as any
            )
          );
        }

        // Update onboarding progress - return the result
        const progressPromise = existingProgress
          ? tx
              .update(smeOnboardingProgress)
              .set({
                currentStep: 6,
                completedSteps: completedSteps as any,
                lastSavedAt: new Date(),
                updatedAt: new Date(),
              } as any)
              .where(eq(smeOnboardingProgress.userId, userId))
              .returning()
              .then(([result]) => result)
          : tx
              .insert(smeOnboardingProgress)
              .values({
                userId: userId,
                currentStep: 6,
                completedSteps: [6] as any,
                lastSavedAt: new Date(),
              } as any)
              .returning()
              .then(([result]) => result);

        // Update user onboarding step - return the result
        const userUpdatePromise = tx
          .update(users)
          .set({
            onboardingStep: 6,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning()
          .then(([result]) => result);

        // Execute all operations in parallel
        const [progressResult, updatedUser] = await Promise.all([
          progressPromise,
          userUpdatePromise,
          ...parallelOps,
        ]);

        return { updatedUser, updatedBusiness: business, progressResult };
      });

      logger.info("[AdminSME Step6] Step 6 saved", {
        userId,
        businessId: updatedBusiness.id,
      });

      // Return onboarding state from data we already have (no extra queries!)
      return {
        userId: updatedUser.id,
        currentStep: progressResult?.currentStep ?? 6,
        completedSteps: (progressResult?.completedSteps as number[]) ?? [6],
        user: {
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phoneNumber,
          dob: updatedUser.dob,
          gender: updatedUser.gender,
          position: updatedUser.position,
          onboardingStatus: updatedUser.onboardingStatus as string,
          idNumber: updatedUser.idNumber,
          taxNumber: updatedUser.taxNumber,
          idType: updatedUser.idType,
        },
        business: updatedBusiness
          ? {
              id: updatedBusiness.id,
              name: updatedBusiness.name,
              averageMonthlyTurnover: updatedBusiness.avgMonthlyTurnover
                ? Number(updatedBusiness.avgMonthlyTurnover)
                : null,
              averageYearlyTurnover: updatedBusiness.avgYearlyTurnover
                ? Number(updatedBusiness.avgYearlyTurnover)
                : null,
              previousLoans: updatedBusiness.borrowingHistory ?? null,
              loanAmount: updatedBusiness.amountBorrowed
                ? Number(updatedBusiness.amountBorrowed)
                : null,
              defaultCurrency: updatedBusiness.currency ?? null,
              recentLoanStatus: updatedBusiness.loanStatus ?? null,
              defaultReason: updatedBusiness.defaultReason ?? null,
            }
          : null,
      };
    } catch (error: any) {
      logger.error("[AdminSME Step6] Error saving Step 6", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[STEP6_ERROR] Failed to save financial documents");
    }
  }
}
