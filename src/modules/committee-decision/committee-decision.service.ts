import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  loanApplications,
  users,
  businessProfiles,
  loanProducts,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { LoanApplicationAuditService } from "../loan-applications/loan-applications-audit.service";
import type { CommitteeDecisionModel } from "./committee-decision.model";
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
 * Committee Decision Service
 *
 * Handles committee decision workflow for loan applications.
 * Moves loan applications from committee_decision to sme_offer_approval status.
 * Uploads term sheet and sends notifications to Head of Credit and applicant.
 */
export abstract class CommitteeDecisionService {
  /**
   * Complete committee decision step
   *
   * @description Marks the committee decision step as complete by uploading term sheet and moves loan application to sme_offer_approval status.
   * Sends two emails: one to Head of Credit and one to the applicant.
   *
   * @param loanApplicationId - The loan application ID
   * @param clerkId - Clerk ID of the admin uploading term sheet
   * @param body - Term sheet details
   * @returns Updated loan application details
   *
   * @throws {400} If validation fails
   * @throws {404} If loan application not found
   * @throws {500} If completion fails
   */
  static async completeCommitteeDecision(
    loanApplicationId: string,
    clerkId: string,
    body: CommitteeDecisionModel.CompleteCommitteeDecisionBody
  ): Promise<CommitteeDecisionModel.CompleteCommitteeDecisionResponse> {
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

      if (loanApp.status !== "committee_decision") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'committee_decision' status. Current status: ${loanApp.status}`
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

      // Update loan application status and term sheet URL
      await db
        .update(loanApplications)
        .set({
          status: "sme_offer_approval",
          termSheetUrl: body.termSheetUrl,
          termSheetUploadedAt: now,
          termSheetUploadedBy: adminUser.id,
          lastUpdatedBy: adminUser.id,
          lastUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(loanApplications.id, loanApplicationId));

      // Create audit trail entry
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType: "status_changed",
        title: "Committee decision completed - Term sheet uploaded",
        description: "Term sheet uploaded and loan application moved to SME offer approval stage.",
        status: "sme_offer_approval",
        previousStatus: "committee_decision",
        newStatus: "sme_offer_approval",
        details: {
          termSheetUrl: body.termSheetUrl,
        },
      });

      // Send emails (non-blocking)
      const adminPortalUrl = (process.env.ADMIN_URL || process.env.APP_URL || "#").replace(/\/$/, "");
      const appUrl = (process.env.APP_URL || "#").replace(/\/$/, "");

      // Fetch loan application details for emails and send emails (non-blocking)
      (async () => {
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

          // Send email to Head of Credit (hardcoded: kelybush@gmail.com, Kelvin Wachiye)
          await emailService.sendDocumentGenerationNotificationEmail({
            to: "kelybush@gmail.com",
            approverName: "Kelvin Wachiye",
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

          // Send email to applicant
          if (entrepreneur?.email) {
            await emailService.sendTermSheetApprovalNotificationEmail({
              to: entrepreneur.email,
              firstName: entrepreneur.firstName || undefined,
              loginUrl: `${appUrl}/login`,
            });
          }
        } catch (error) {
          logger.error("Failed to send committee decision notification emails", error);
        }
      })();

      return {
        loanApplicationId,
        status: "sme_offer_approval",
        termSheetUrl: body.termSheetUrl,
        uploadedAt: now.toISOString(),
        uploadedBy: {
          id: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
        },
      };
    } catch (error: any) {
      logger.error("Error completing committee decision:", error);
      if (error?.status) throw error;
      throw httpError(500, "[COMPLETE_COMMITTEE_DECISION_ERROR] Failed to complete committee decision");
    }
  }
}
