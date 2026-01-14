import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  loanApplications,
  loanDocuments,
  users,
  businessProfiles,
  loanProducts,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { LoanApplicationAuditService } from "../loan-applications/loan-applications-audit.service";
import type { CreditAssessmentModel } from "./credit-assessment.model";
import { emailService } from "../../services/email.service";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName, lastName].filter((part) => !!part && part.trim().length > 0) as string[];
  if (parts.length === 0) return "Valued Applicant";
  return parts.join(" ");
}

function formatCurrency(amount: any, currency?: string | null): string {
  const num = Number(amount ?? 0);
  const safeCurrency = (currency || "USD").toUpperCase();
  if (!Number.isFinite(num)) {
    return `${safeCurrency} ${amount ?? "0"}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    logger.warn("Failed to format currency, falling back to raw amount", { amount, currency });
    return `${safeCurrency} ${num.toFixed(2)}`;
  }
}

function formatTenure(period: number, termUnit: string): string {
  const displayUnit = termUnit.replace(/_/g, " ");
  return `${period} ${displayUnit}`;
}

/**
 * Credit Assessment Service
 *
 * Handles credit assessment workflow for loan applications.
 * Moves loan applications from credit_analysis to head_of_credit_review status.
 */
export abstract class CreditAssessmentService {
  /**
   * Complete credit assessment step
   *
   * @description Marks the credit assessment step as complete and moves loan application to head_of_credit_review status.
   *
   * @param loanApplicationId - The loan application ID
   * @param clerkId - Clerk ID of the admin completing assessment
   * @param body - Assessment details (comment, supporting documents, next approver)
   * @returns Updated loan application details
   *
   * @throws {400} If validation fails
   * @throws {404} If loan application not found
   * @throws {500} If completion fails
   */
  static async completeCreditAssessment(
    loanApplicationId: string,
    clerkId: string,
    body: CreditAssessmentModel.CompleteCreditAssessmentBody
  ): Promise<CreditAssessmentModel.CompleteCreditAssessmentResponse> {
    try {
      // Get loan application with required columns
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(
          eq(loanApplications.id, loanApplicationId),
          isNull(loanApplications.deletedAt)
        ),
        columns: {
          id: true,
          status: true,
          businessId: true,
          entrepreneurId: true,
          loanProductId: true,
          fundingAmount: true,
          fundingCurrency: true,
          repaymentPeriod: true,
          intendedUseOfFunds: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "credit_analysis") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'credit_analysis' status. Current status: ${loanApp.status}`
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

      // Use transaction to ensure consistency
      const result = await db.transaction(async (tx) => {
        // Create loan document records for supporting documents if provided
        const createdDocuments: Array<{
          id: string;
          docUrl: string;
          docName?: string;
          notes?: string;
        }> = [];

        if (body.supportingDocuments && body.supportingDocuments.length > 0) {
          const documentValues = body.supportingDocuments.map((doc) => ({
            loanApplicationId,
            documentType: "credit_analysis_report" as const,
            docUrl: doc.docUrl,
            docName: doc.docName || null,
            uploadedBy: adminUser.id,
            notes: doc.notes || null,
          }));

          const inserted = await tx.insert(loanDocuments).values(documentValues).returning();

          createdDocuments.push(
            ...inserted.map((doc) => ({
              id: doc.id,
              docUrl: doc.docUrl,
              docName: doc.docName || undefined,
              notes: doc.notes || undefined,
            }))
          );
        }

        // Update loan application status to next step: head_of_credit_review
        await tx
          .update(loanApplications)
          .set({
            status: "head_of_credit_review",
            creditAssessmentComment: body.comment,
            creditAssessmentCompletedAt: now,
            creditAssessmentCompletedBy: adminUser.id,
            lastUpdatedBy: adminUser.id,
            lastUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(loanApplications.id, loanApplicationId));

        return { createdDocuments };
      });

      // Create audit trail entry
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType: "credit_assessment_completed",
        title: LoanApplicationAuditService.getEventTitle("credit_assessment_completed"),
        description: `Credit assessment completed.${body.supportingDocuments?.length ? ` ${body.supportingDocuments.length} supporting document(s) attached.` : ""}`,
        status: "head_of_credit_review",
        previousStatus: "credit_analysis",
        newStatus: "head_of_credit_review",
        details: {
          comment: body.comment,
          supportingDocumentsCount: body.supportingDocuments?.length || 0,
        },
      });

      // Send email notification if next approver is provided
      if (body.nextApprover?.nextApproverEmail) {
        const stageDisplayName = "Head of Credit Review";
        const adminPortalUrl = (process.env.ADMIN_URL || process.env.APP_URL || "#").replace(
          /\/$/,
          ""
        );

        try {
          const [business, entrepreneur, loanProduct] = await Promise.all([
            db.query.businessProfiles.findFirst({
              where: and(
                eq(businessProfiles.id, loanApp.businessId),
                isNull(businessProfiles.deletedAt)
              ),
              columns: {
                name: true,
              },
            }),
            db.query.users.findFirst({
              where: and(eq(users.id, loanApp.entrepreneurId), isNull(users.deletedAt)),
              columns: {
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              },
            }),
            db.query.loanProducts.findFirst({
              where: and(eq(loanProducts.id, loanApp.loanProductId), isNull(loanProducts.deletedAt)),
              columns: {
                name: true,
                termUnit: true,
              },
            }),
          ]);

          const applicantName = formatFullName(
            entrepreneur?.firstName || "",
            entrepreneur?.lastName || ""
          );

          const formattedAmount = formatCurrency(loanApp.fundingAmount, loanApp.fundingCurrency);
          const preferredTenure = formatTenure(
            loanApp.repaymentPeriod,
            loanProduct?.termUnit || "months"
          );

          await emailService.sendLoanStageReviewNotificationEmail({
            to: body.nextApprover.nextApproverEmail,
            approverName: body.nextApprover.nextApproverName,
            stageName: stageDisplayName,
            companyName: business?.name || "Unknown Company",
            applicantName,
            applicantEmail: entrepreneur?.email || "N/A",
            applicantPhone: entrepreneur?.phoneNumber || null,
            loanType: loanProduct?.name || "Loan Product",
            loanRequested: formattedAmount,
            preferredTenure,
            useOfFunds: loanApp.intendedUseOfFunds || "Not provided",
            loginUrl: `${adminPortalUrl}/login`,
          });
        } catch (error) {
          logger.error("Failed to send loan stage review notification email", error);
        }
      }

      return {
        loanApplicationId,
        status: "head_of_credit_review",
        completedAt: now.toISOString(),
        completedBy: {
          id: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
        },
        creditAssessmentComment: body.comment,
        supportingDocuments: result.createdDocuments,
      };
    } catch (error: any) {
      logger.error("Error completing credit assessment:", error);
      if (error?.status) throw error;
      throw httpError(500, "[COMPLETE_CREDIT_ASSESSMENT_ERROR] Failed to complete credit assessment");
    }
  }
}
