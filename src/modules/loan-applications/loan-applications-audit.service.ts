import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  loanApplicationAuditTrail,
  users,
  type LoanApplicationAuditEventType,
} from "../../db/schema";
import { logger } from "../../utils/logger";

export interface LoanApplicationAuditLogParams {
  loanApplicationId: string;
  clerkId?: string; // Clerk ID of the user performing the action (optional for system events)
  eventType: LoanApplicationAuditEventType;
  title: string;
  description?: string;
  status?: string; // Current status at time of event
  previousStatus?: string; // Previous status (for status changes)
  newStatus?: string; // New status (for status changes)
  details?: Record<string, any>; // Additional details about the event
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Service for Loan Application Events
 * Logs all events and status changes for loan applications
 */
export abstract class LoanApplicationAuditService {
  /**
   * Log a loan application event
   * Non-blocking: errors are logged but don't throw
   */
  static async logEvent(params: LoanApplicationAuditLogParams): Promise<void> {
    try {
      // Resolve user ID from Clerk ID if provided
      let performedById: string | null = null;
      if (params.clerkId) {
        const user = await db.query.users.findFirst({
          where: eq(users.clerkId, params.clerkId),
          columns: { id: true },
        });

        if (user) {
          performedById = user.id;
        } else {
          logger.warn("[LoanApplication Audit] User not found for Clerk ID", {
            clerkId: params.clerkId,
          });
        }
      }

      // Helper to safely stringify objects (filters out undefined, keeps null)
      const stringifyObject = (obj: Record<string, any> | undefined): string | null => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
          return null;
        }

        // Filter out undefined values, keep null (null is meaningful)
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }

        // Only stringify if there are actual properties
        return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
      };

      // Insert audit trail entry
      await db.insert(loanApplicationAuditTrail).values({
        loanApplicationId: params.loanApplicationId,
        performedById,
        eventType: params.eventType,
        title: params.title,
        description: params.description || null,
        status: params.status || null,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus || null,
        details: stringifyObject(params.details),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      } as any);

      logger.debug("[LoanApplication Audit] Event logged", {
        loanApplicationId: params.loanApplicationId,
        eventType: params.eventType,
      });
    } catch (error: any) {
      // Non-blocking: log error but don't throw
      logger.error("[LoanApplication Audit] Failed to log event", {
        error: error.message,
        loanApplicationId: params.loanApplicationId,
        eventType: params.eventType,
      });
    }
  }

  /**
   * Extract request metadata from Fastify request
   */
  static extractRequestMetadata(request: any): {
    ipAddress?: string;
    userAgent?: string;
  } {
    return {
      ipAddress:
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (request.headers["x-real-ip"] as string) ||
        request.ip ||
        request.socket?.remoteAddress,
      userAgent: (request.headers["user-agent"] as string) || undefined,
    };
  }

  /**
   * Map loan application status to timeline event type
   */
  static mapStatusToEventType(status: string): LoanApplicationAuditEventType | null {
    const statusMap: Record<string, LoanApplicationAuditEventType> = {
      kyc_kyb_verification: "review_in_progress",
      eligibility_check: "review_in_progress",
      credit_analysis: "review_in_progress",
      head_of_credit_review: "review_in_progress",
      internal_approval_ceo: "review_in_progress",
      committee_decision: "review_in_progress",
      sme_offer_approval: "review_in_progress",
      document_generation: "review_in_progress",
      signing_execution: "review_in_progress",
      awaiting_disbursement: "awaiting_disbursement",
      approved: "approved",
      rejected: "rejected",
      disbursed: "disbursed",
      cancelled: "cancelled",
    };

    return statusMap[status] || "status_changed";
  }

  /**
   * Get event title based on event type and status
   */
  static getEventTitle(eventType: LoanApplicationAuditEventType, status?: string): string {
    const titles: Record<LoanApplicationAuditEventType, string> = {
      submitted: "Loan submitted successfully",
      cancelled: "Loan application cancelled",
      review_in_progress: LoanApplicationAuditService.getReviewInProgressTitle(status),
      rejected: "Loan application rejected",
      approved: "Loan application approved",
      awaiting_disbursement: "Awaiting disbursement",
      disbursed: "Loan disbursed",
      status_changed: LoanApplicationAuditService.getStatusChangedTitle(status),
      document_verified_approved: "Document verified and approved",
      document_verified_rejected: "Document verification rejected",
      kyc_kyb_completed: "KYC/KYB verification completed",
      eligibility_assessment_completed: "Eligibility assessment completed",
      credit_assessment_completed: "Credit assessment completed",
      head_of_credit_review_completed: "Head of credit review completed",
      internal_approval_ceo_completed: "Internal approval CEO completed",
    };

    return titles[eventType];
  }

  /**
   * Get review in progress title based on specific status
   */
  private static getReviewInProgressTitle(status?: string): string {
    const statusTitles: Record<string, string> = {
      kyc_kyb_verification: "KYC/KYB verification in progress",
      eligibility_check: "Eligibility check in progress",
      credit_analysis: "Credit analysis in progress",
      head_of_credit_review: "Head of credit review in progress",
      internal_approval_ceo: "Internal approval (CEO) in progress",
      committee_decision: "Committee decision in progress",
      sme_offer_approval: "SME offer approval in progress",
      document_generation: "Document generation in progress",
      signing_execution: "Signing and execution in progress",
    };

    return statusTitles[status || ""] || "Review in progress";
  }

  /**
   * Get status changed title based on specific status
   */
  private static getStatusChangedTitle(status?: string): string {
    if (!status) return "Status changed";
    return `Status changed to ${status.replace(/_/g, " ")}`;
  }
}
