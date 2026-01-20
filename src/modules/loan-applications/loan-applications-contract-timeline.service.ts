import { and, asc, eq, isNull, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  loanApplicationAuditTrail,
  loanApplications,
  users,
  type LoanApplicationAuditEventType,
} from "../../db/schema";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export interface ContractTimelineEvent {
  id: string;
  type: LoanApplicationAuditEventType;
  title: string;
  description?: string;
  createdAt: string;
  performedBy?: string;
  performedById?: string;
}

export interface ContractTimelineResponse {
  currentStatus: string | null;
  events: ContractTimelineEvent[];
}

const CONTRACT_EVENT_TYPES: LoanApplicationAuditEventType[] = [
  "contract_uploaded",
  "contract_sent_for_signing",
  "contract_signer_opened",
  "contract_signed_by_signer",
  "contract_fully_signed",
  "contract_voided",
  "contract_expired",
];

/**
 * Contract Timeline Service
 *
 * Returns contract-specific audit events and current contract status
 * for a given loan application.
 */
export abstract class LoanApplicationContractTimelineService {
  static async getContractTimeline(
    applicationId: string,
    clerkId?: string
  ): Promise<ContractTimelineResponse> {
    try {
      // Verify loan application exists
      const application = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)),
        columns: {
          id: true,
          entrepreneurId: true,
          contractStatus: true,
        },
      });

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Authorization: if clerkId is provided, ensure user is admin/member or the entrepreneur
      if (clerkId) {
        const requestingUser = await db.query.users.findFirst({
          where: eq(users.clerkId, clerkId),
          columns: { id: true, role: true },
        });

        if (!requestingUser) {
          throw httpError(403, "[FORBIDDEN] User not found");
        }

        const isAdminOrMember =
          requestingUser.role === "admin" ||
          requestingUser.role === "super-admin" ||
          requestingUser.role === "member";
        const isEntrepreneur = requestingUser.id === application.entrepreneurId;

        if (!isAdminOrMember && !isEntrepreneur) {
          throw httpError(
            403,
            "[FORBIDDEN] You do not have permission to view this contract timeline"
          );
        }
      }

      // Fetch contract-related audit entries
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
        .where(
          and(
            eq(loanApplicationAuditTrail.loanApplicationId, applicationId),
            inArray(loanApplicationAuditTrail.eventType, CONTRACT_EVENT_TYPES)
          )
        )
        .orderBy(asc(loanApplicationAuditTrail.createdAt));

      const events: ContractTimelineEvent[] = auditEntries.map((entry) => {
        const { audit, user } = entry;
        const performedBy = user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined
          : undefined;

        return {
          id: audit.id,
          type: audit.eventType,
          title: audit.title,
          description: audit.description || undefined,
          createdAt: audit.createdAt?.toISOString?.() ?? new Date().toISOString(),
          performedBy,
          performedById: audit.performedById || undefined,
        };
      });

      return {
        currentStatus: application.contractStatus || null,
        events,
      };
    } catch (error: any) {
      logger.error("Error getting contract timeline for loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[GET_CONTRACT_TIMELINE_ERROR] Failed to get contract timeline for loan application"
      );
    }
  }
}

