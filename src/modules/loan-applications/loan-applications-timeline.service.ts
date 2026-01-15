import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { loanApplicationAuditTrail, loanApplications, users } from "../../db/schema";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

/**
 * Timeline Event for Loan Application
 */
export interface TimelineEvent {
  id: string;
  type:
    | "submitted"
    | "cancelled"
    | "review_in_progress"
    | "rejected"
    | "approved"
    | "awaiting_disbursement"
    | "disbursed";
  title: string;
  description?: string;
  date: string; // ISO date string or formatted date (e.g., "2025-01-25" or "Jan 25, 2025")
  time?: string; // Optional: Time string (e.g., "6:04PM" or "18:04")
  updatedDate?: string; // Optional: For in-progress events, when it was last updated
  updatedTime?: string; // Optional: Time of last update
  performedBy?: string; // Optional: Name of person who performed the action (e.g., "Shalyne Waweru")
  performedById?: string; // Optional: ID of the user who performed the action
  lineColor?: "green" | "orange" | "grey"; // Optional: Visual indicator color
}

/**
 * Timeline Service for Loan Applications
 * Retrieves and formats timeline events for loan applications
 */
export abstract class LoanApplicationTimelineService {
  /**
   * Get timeline events for a loan application
   *
   * @param applicationId - The loan application ID
   * @param clerkId - Optional Clerk ID of the requesting user (for authorization check)
   * @returns Array of timeline events
   *
   * @throws {403} If user is not authorized to view this application
   * @throws {404} If loan application is not found
   * @throws {500} If retrieval fails
   */
  static async getTimeline(
    applicationId: string,
    clerkId?: string
  ): Promise<{ data: TimelineEvent[] }> {
    try {
      // Verify loan application exists
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)))
        .limit(1);

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Check authorization if clerkId is provided
      if (clerkId) {
        const requestingUser = await db.query.users.findFirst({
          where: eq(users.clerkId, clerkId),
          columns: { id: true, role: true },
        });

        if (!requestingUser) {
          throw httpError(403, "[FORBIDDEN] User not found");
        }

        // Allow access if user is admin/member OR if user is the entrepreneur
        const isAdminOrMember =
          requestingUser.role === "admin" ||
          requestingUser.role === "super-admin" ||
          requestingUser.role === "member";
        const isEntrepreneur = requestingUser.id === application.entrepreneurId;

        if (!isAdminOrMember && !isEntrepreneur) {
          throw httpError(
            403,
            "[FORBIDDEN] You do not have permission to view this loan application"
          );
        }
      }

      // Get all audit trail entries for this application, ordered by creation date
      const auditEntries = await db
        .select({
          audit: loanApplicationAuditTrail,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(loanApplicationAuditTrail)
        .leftJoin(users, eq(loanApplicationAuditTrail.performedById, users.id))
        .where(eq(loanApplicationAuditTrail.loanApplicationId, applicationId))
        .orderBy(asc(loanApplicationAuditTrail.createdAt));

      // Also include initial creation event if no submitted event exists
      const hasSubmittedEvent = auditEntries.some((entry) => entry.audit.eventType === "submitted");

      const events: TimelineEvent[] = [];

      // Add submitted event from application creation if not already in audit trail
      if (!hasSubmittedEvent && application.submittedAt) {
        const creator = await db.query.users.findFirst({
          where: eq(users.id, application.createdBy),
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });

        events.push({
          id: `submitted-${application.id}`,
          type: "submitted",
          title: "Loan submitted successfully",
          description: `Loan application ${application.loanId} submitted successfully`,
          date: LoanApplicationTimelineService.formatDate(application.submittedAt),
          time: LoanApplicationTimelineService.formatTime(application.submittedAt),
          performedBy: creator
            ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || undefined
            : undefined,
          performedById: creator?.id,
          lineColor: "green",
        });
      }

      // Map audit trail entries to timeline events
      for (const entry of auditEntries) {
        const event = LoanApplicationTimelineService.mapAuditEntryToTimelineEvent(
          entry.audit,
          entry.user
        );
        if (event) {
          events.push(event);
        }
      }

      // Sort events by date (oldest first)
      events.sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? ` ${a.time}` : "")).getTime();
        const dateB = new Date(b.date + (b.time ? ` ${b.time}` : "")).getTime();
        return dateA - dateB;
      });

      return { data: events };
    } catch (error: any) {
      logger.error("Error getting loan application timeline:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_TIMELINE_ERROR] Failed to get loan application timeline");
    }
  }

  /**
   * Map audit trail entry to timeline event
   */
  private static mapAuditEntryToTimelineEvent(
    audit: typeof loanApplicationAuditTrail.$inferSelect,
    user?: { id: string; firstName: string | null; lastName: string | null } | null
  ): TimelineEvent | null {
    const eventType = audit.eventType as TimelineEvent["type"];

    // Determine line color based on event type
    let lineColor: "green" | "orange" | "grey" = "grey";
    if (eventType === "submitted" || eventType === "approved" || eventType === "disbursed") {
      lineColor = "green";
    } else if (eventType === "rejected" || eventType === "cancelled") {
      lineColor = "orange";
    } else if (eventType === "review_in_progress" || eventType === "awaiting_disbursement") {
      lineColor = "orange";
    }

    // Format user name
    const performedBy = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined
      : undefined;

    return {
      id: audit.id,
      type: eventType,
      title: audit.title,
      description: audit.description || undefined,
      date: LoanApplicationTimelineService.formatDate(audit.createdAt),
      time: LoanApplicationTimelineService.formatTime(audit.createdAt),
      performedBy,
      performedById: audit.performedById || undefined,
      lineColor,
    };
  }

  /**
   * Format date to ISO date string (YYYY-MM-DD)
   * Uses local timezone for display
   */
  private static formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Format time to 12-hour format (e.g., "6:04PM")
   * Uses local timezone for display
   */
  private static formatTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, "0");
    return `${hours12}:${minutesStr}${ampm}`;
  }
}
