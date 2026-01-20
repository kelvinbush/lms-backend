import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  loanApplications,
  loanContractSignatories,
} from "../db/schema";
import { LoanApplicationAuditService } from "../modules/loan-applications/loan-applications-audit.service";
import { logger } from "../utils/logger";

interface FirmaRecipientPayload {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  finished_date?: string | null;
}

interface FirmaWebhookEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  data?: {
    signing_request_id?: string;
    status?: string;
    finished_date?: string | null;
    recipients?: FirmaRecipientPayload[];
  };
}

export abstract class FirmaWebhookService {
  /**
   * Process a verified Firma webhook event.
   *
   * We focus on:
   * - signing_request.signed: individual recipient finished
   * - signing_request.completed: all recipients finished
   */
  static async processWebhookEvent(event: FirmaWebhookEvent): Promise<void> {
    try {
      switch (event.event_type) {
        case "signing_request.signed":
          await this.handleRecipientSigned(event);
          break;
        case "signing_request.completed":
          await this.handleSigningCompleted(event);
          break;
        default:
          logger.info("[FirmaWebhook] Ignoring unsupported event type", {
            eventType: event.event_type,
          });
      }
    } catch (error: any) {
      logger.error("[FirmaWebhook] Error processing webhook event", {
        eventType: event.event_type,
        eventId: event.event_id,
        error: error?.message || String(error),
      });
      throw error;
    }
  }

  private static async handleRecipientSigned(event: FirmaWebhookEvent): Promise<void> {
    const data = event.data;
    if (!data?.signing_request_id || !data.recipients || data.recipients.length === 0) {
      logger.warn("[FirmaWebhook] signing_request.signed missing required data", { event });
      return;
    }

    const signingRequestId = data.signing_request_id;

    const loan = await db.query.loanApplications.findFirst({
      where: and(
        eq(loanApplications.firmaSigningRequestId, signingRequestId),
        isNull(loanApplications.deletedAt)
      ),
      columns: {
        id: true,
        contractStatus: true,
      },
    });

    if (!loan) {
      logger.warn("[FirmaWebhook] No loan application found for signing_request_id", {
        signingRequestId,
      });
      return;
    }

    const loanApplicationId = loan.id;

    const recipients = data.recipients;
    const now = new Date();

    for (const recipient of recipients) {
      // Update matching signatory by email
      const [updated] = await db
        .update(loanContractSignatories)
        .set({
          hasSigned: true,
          signedAt: recipient.finished_date
            ? new Date(recipient.finished_date)
            : now,
        })
        .where(
          and(
            eq(loanContractSignatories.loanApplicationId, loanApplicationId),
            eq(loanContractSignatories.email, recipient.email)
          )
        )
        .returning();

      if (!updated) {
        logger.warn("[FirmaWebhook] No matching signatory for recipient email", {
          loanApplicationId,
          email: recipient.email,
        });
        continue;
      }

      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        eventType: "contract_signed_by_signer",
        title: LoanApplicationAuditService.getEventTitle("contract_signed_by_signer"),
        description: `Successfully signed by ${recipient.first_name} ${recipient.last_name || ""}`.trim(),
        status: loan.contractStatus || "contract_partially_signed",
        details: {
          recipientEmail: recipient.email,
          recipientId: recipient.id,
        },
      });
    }

    // Recompute contract status: if all signatories have signed, mark as fully signed
    const allSignatories = await db.query.loanContractSignatories.findMany({
      where: eq(loanContractSignatories.loanApplicationId, loanApplicationId),
      columns: {
        hasSigned: true,
      },
    });

    const allSigned = allSignatories.length > 0 && allSignatories.every((s) => s.hasSigned);

    if (allSigned) {
      await db
        .update(loanApplications)
        .set({
          contractStatus: "contract_fully_signed",
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, loanApplicationId));

      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        eventType: "contract_fully_signed",
        title: LoanApplicationAuditService.getEventTitle("contract_fully_signed"),
        description: "All recipients have completed signing the contract.",
        status: "contract_fully_signed",
      });
    } else if (loan.contractStatus !== "contract_partially_signed") {
      await db
        .update(loanApplications)
        .set({
          contractStatus: "contract_partially_signed",
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, loanApplicationId));
    }
  }

  private static async handleSigningCompleted(event: FirmaWebhookEvent): Promise<void> {
    const data = event.data;
    if (!data?.signing_request_id) {
      logger.warn("[FirmaWebhook] signing_request.completed missing signing_request_id", {
        event,
      });
      return;
    }

    const signingRequestId = data.signing_request_id;

    const loan = await db.query.loanApplications.findFirst({
      where: and(
        eq(loanApplications.firmaSigningRequestId, signingRequestId),
        isNull(loanApplications.deletedAt)
      ),
      columns: {
        id: true,
      },
    });

    if (!loan) {
      logger.warn("[FirmaWebhook] No loan application found for signing_request_id", {
        signingRequestId,
      });
      return;
    }

    const loanApplicationId = loan.id;

    // As a safety, mark all signatories as signed if recipients are provided
    if (data.recipients && data.recipients.length > 0) {
      const now = new Date();
      for (const recipient of data.recipients) {
        await db
          .update(loanContractSignatories)
          .set({
            hasSigned: true,
            signedAt: recipient.finished_date
              ? new Date(recipient.finished_date)
              : now,
          })
          .where(
            and(
              eq(loanContractSignatories.loanApplicationId, loanApplicationId),
              eq(loanContractSignatories.email, recipient.email)
            )
          );
      }
    }

    await db
      .update(loanApplications)
      .set({
        contractStatus: "contract_fully_signed",
        lastUpdatedAt: new Date(),
      })
      .where(eq(loanApplications.id, loanApplicationId));

    await LoanApplicationAuditService.logEvent({
      loanApplicationId,
      eventType: "contract_fully_signed",
      title: LoanApplicationAuditService.getEventTitle("contract_fully_signed"),
      description: "All recipients have completed signing the contract.",
      status: "contract_fully_signed",
      details: {
        signingRequestId,
        finishedDate: data.finished_date || event.timestamp,
      },
    });
  }
}

