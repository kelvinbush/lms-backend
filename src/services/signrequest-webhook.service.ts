import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  loanApplications,
  loanContractSignatories,
} from "../db/schema";
import { LoanApplicationAuditService } from "../modules/loan-applications/loan-applications-audit.service";
import { logger } from "../utils/logger";

/**
 * SignRequest Events webhook service
 *
 * Based on swagger.json "Events" section:
 * - event_type: one of convert_error, converted, sending_error, sent, declined,
 *   cancelled, expired, signed, signer_signed, signer_viewed, signer_email_bounced, etc.
 * - document: embedded Document object (with uuid, status, signers, etc.)
 *
 * We care about:
 * - signer_signed: individual signer finished -> contract_signed_by_signer
 * - signed: document fully signed -> contract_fully_signed
 * - signer_viewed: signer viewed document -> contract_signer_opened / contract_in_signing
 * - cancelled: document cancelled -> contract_voided
 * - expired: document expired -> contract_expired
 * - declined: document declined -> contract_voided
 */

interface SignRequestEventDocument {
  uuid: string;
  status?: string;
  signers?: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    signed?: boolean;
    signed_on?: string | null;
    declined?: boolean;
  }>;
}

interface SignRequestEventSigner {
  email?: string;
  first_name?: string;
  last_name?: string;
  signed?: boolean;
  signed_on?: string | null;
}

interface SignRequestWebhookEvent {
  event_type: string;
  event_time: string;
  status: string;
  document?: SignRequestEventDocument | null;
  signer?: SignRequestEventSigner | null;
}

export abstract class SignRequestWebhookService {
  static async processWebhookEvent(event: SignRequestWebhookEvent): Promise<void> {
    try {
      const eventType = event.event_type;

      switch (eventType) {
        case "signer_signed":
          await this.handleSignerSigned(event);
          break;
        case "signed":
          await this.handleDocumentSigned(event);
          break;
        case "signer_viewed":
          await this.handleSignerViewed(event);
          break;
        case "cancelled":
          await this.handleDocumentCancelled(event);
          break;
        case "expired":
          await this.handleDocumentExpired(event);
          break;
        case "declined":
          await this.handleDocumentDeclined(event);
          break;
        default:
          logger.info("[SignRequestWebhook] Ignoring unsupported event type", {
            eventType,
          });
      }
    } catch (error: any) {
      logger.error("[SignRequestWebhook] Error processing webhook event", {
        eventType: event.event_type,
        error: error?.message || String(error),
      });
      throw error;
    }
  }

  private static getDocumentUuid(event: SignRequestWebhookEvent): string | null {
    return event.document?.uuid ?? null;
  }

  private static async findLoanByDocumentUuid(documentUuid: string) {
    return db.query.loanApplications.findFirst({
      where: and(
        eq(loanApplications.signrequestDocumentUuid, documentUuid),
        isNull(loanApplications.deletedAt)
      ),
      columns: {
        id: true,
        contractStatus: true,
      },
    });
  }

  private static async handleSignerSigned(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    const signer = event.signer;

    if (!documentUuid || !signer?.email) {
      logger.warn("[SignRequestWebhook] signer_signed missing document or signer email", {
        event,
      });
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);

    if (!loan) {
      logger.warn("[SignRequestWebhook] No loan application found for document uuid", {
        documentUuid,
      });
      return;
    }

    const loanApplicationId = loan.id;
    const now = new Date();

    const [updated] = await db
      .update(loanContractSignatories)
      .set({
        hasSigned: true,
        signedAt: signer.signed_on ? new Date(signer.signed_on) : now,
      })
      .where(
        and(
          eq(loanContractSignatories.loanApplicationId, loanApplicationId),
          eq(loanContractSignatories.email, signer.email)
        )
      )
      .returning();

    if (updated) {
      const signerName =
        `${signer.first_name || ""} ${signer.last_name || ""}`.trim() || signer.email;

      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        eventType: "contract_signed_by_signer",
        title: LoanApplicationAuditService.getEventTitle("contract_signed_by_signer"),
        description: `Successfully signed by ${signerName}`,
        status: loan.contractStatus || "contract_partially_signed",
        details: {
          recipientEmail: signer.email,
        },
      });
    }

    // If all signatories have signed, mark as fully signed
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

  private static async handleDocumentSigned(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    if (!documentUuid) {
      logger.warn("[SignRequestWebhook] signed event missing document uuid", { event });
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);
    if (!loan) {
      logger.warn("[SignRequestWebhook] No loan application found for document uuid", {
        documentUuid,
      });
      return;
    }

    const loanApplicationId = loan.id;
    const now = new Date();

    // Mark all signatories as signed
    await db
      .update(loanContractSignatories)
      .set({
        hasSigned: true,
        signedAt: now,
      })
      .where(
        and(
          eq(loanContractSignatories.loanApplicationId, loanApplicationId),
          eq(loanContractSignatories.hasSigned, false)
        )
      );

    await db
      .update(loanApplications)
      .set({
        contractStatus: "contract_fully_signed",
        lastUpdatedAt: now,
      })
      .where(eq(loanApplications.id, loanApplicationId));

    await LoanApplicationAuditService.logEvent({
      loanApplicationId,
      eventType: "contract_fully_signed",
      title: LoanApplicationAuditService.getEventTitle("contract_fully_signed"),
      description: "All recipients have completed signing the contract.",
      status: "contract_fully_signed",
      details: {
        documentUuid,
        finishedAt: event.event_time,
      },
    });
  }

  private static async handleSignerViewed(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    if (!documentUuid) {
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);
    if (!loan) {
      return;
    }

    await LoanApplicationAuditService.logEvent({
      loanApplicationId: loan.id,
      eventType: "contract_signer_opened",
      title: LoanApplicationAuditService.getEventTitle("contract_signer_opened"),
      description: "Contract opened by signer",
      status: "contract_in_signing",
      details: {
        documentUuid,
      },
    });

    if (
      loan.contractStatus !== "contract_in_signing" &&
      loan.contractStatus !== "contract_partially_signed" &&
      loan.contractStatus !== "contract_fully_signed"
    ) {
      await db
        .update(loanApplications)
        .set({
          contractStatus: "contract_in_signing",
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, loan.id));
    }
  }

  private static async handleDocumentCancelled(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    if (!documentUuid) {
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);
    if (!loan) {
      return;
    }

    await db
      .update(loanApplications)
      .set({
        contractStatus: "contract_voided",
        lastUpdatedAt: new Date(),
      })
      .where(eq(loanApplications.id, loan.id));

    await LoanApplicationAuditService.logEvent({
      loanApplicationId: loan.id,
      eventType: "contract_voided",
      title: LoanApplicationAuditService.getEventTitle("contract_voided"),
      description: "Contract signing was cancelled",
      status: "contract_voided",
      details: {
        documentUuid,
        cancelledAt: event.event_time,
      },
    });
  }

  private static async handleDocumentExpired(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    if (!documentUuid) {
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);
    if (!loan) {
      return;
    }

    await db
      .update(loanApplications)
      .set({
        contractStatus: "contract_expired",
        lastUpdatedAt: new Date(),
      })
      .where(eq(loanApplications.id, loan.id));

    await LoanApplicationAuditService.logEvent({
      loanApplicationId: loan.id,
      eventType: "contract_expired",
      title: LoanApplicationAuditService.getEventTitle("contract_expired"),
      description: "Contract expired without being fully signed.",
      status: "contract_expired",
      details: {
        documentUuid,
        expiredAt: event.event_time,
      },
    });
  }

  private static async handleDocumentDeclined(
    event: SignRequestWebhookEvent
  ): Promise<void> {
    const documentUuid = this.getDocumentUuid(event);
    if (!documentUuid) {
      return;
    }

    const loan = await this.findLoanByDocumentUuid(documentUuid);
    if (!loan) {
      return;
    }

    await db
      .update(loanApplications)
      .set({
        contractStatus: "contract_voided",
        lastUpdatedAt: new Date(),
      })
      .where(eq(loanApplications.id, loan.id));

    await LoanApplicationAuditService.logEvent({
      loanApplicationId: loan.id,
      eventType: "contract_voided",
      title: LoanApplicationAuditService.getEventTitle("contract_voided"),
      description: "Contract was declined by a recipient.",
      status: "contract_voided",
      details: {
        documentUuid,
        declinedAt: event.event_time,
      },
    });
  }
}

