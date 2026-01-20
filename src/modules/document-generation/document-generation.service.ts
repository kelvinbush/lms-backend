import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  loanApplications,
  loanContractSignatories,
  loanDocuments,
  users,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { LoanApplicationAuditService } from "../loan-applications/loan-applications-audit.service";
import type { DocumentGenerationModel } from "./document-generation.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

/**
 * Document Generation Service
 *
 * Handles uploading the final loan contract and moving the loan application
 * from document_generation to signing_execution status.
 */
export abstract class DocumentGenerationService {
  /**
   * Complete document generation step
   *
   * @description Uploads a single loan contract document and moves the loan
   * application from document_generation to signing_execution status.
   *
   * @param loanApplicationId - The loan application ID
   * @param clerkId - Clerk ID of the admin uploading the contract
   * @param body - Contract details (URL, optional name and notes)
   */
  static async completeDocumentGeneration(
    loanApplicationId: string,
    clerkId: string,
    body: DocumentGenerationModel.CompleteDocumentGenerationBody
  ): Promise<DocumentGenerationModel.CompleteDocumentGenerationResponse> {
    try {
      // Get loan application with required columns
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, loanApplicationId), isNull(loanApplications.deletedAt)),
        columns: {
          id: true,
          status: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "document_generation") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'document_generation' status. Current status: ${loanApp.status}`
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

      // Use transaction to ensure consistency and enforce single-contract rule
      const result = await db.transaction(async (tx) => {
        // Check if a contract already exists for this loan application
        const existingContract = await tx.query.loanDocuments.findFirst({
          where: and(
            eq(loanDocuments.loanApplicationId, loanApplicationId),
            eq(loanDocuments.documentType, "contract"),
            isNull(loanDocuments.deletedAt)
          ),
        });

        if (existingContract) {
          throw httpError(
            400,
            "[CONTRACT_ALREADY_EXISTS] A loan contract has already been uploaded for this application"
          );
        }

        // Insert contract document
        const [insertedContract] = await tx
          .insert(loanDocuments)
          .values({
            loanApplicationId,
            documentType: "contract",
            docUrl: body.contractUrl,
            docName: body.docName || null,
            uploadedBy: adminUser.id,
            notes: body.notes || null,
          })
          .returning();

        // Update loan application status to next step: signing_execution
        await tx
          .update(loanApplications)
          .set({
            status: "signing_execution",
            contractStatus: "contract_uploaded",
            lastUpdatedBy: adminUser.id,
            lastUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(loanApplications.id, loanApplicationId));

        return {
          contract: insertedContract,
        };
      });

      // Create audit trail entry (specific event type)
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType: "contract_uploaded",
        title: LoanApplicationAuditService.getEventTitle("contract_uploaded"),
        description:
          "Loan contract uploaded and loan moved from document generation to signing and execution.",
        status: "signing_execution",
        previousStatus: "document_generation",
        newStatus: "signing_execution",
        details: {
          contractDocumentId: result.contract.id,
          contractUrl: result.contract.docUrl,
          contractName: result.contract.docName,
        },
      });

      return {
        loanApplicationId,
        status: "signing_execution",
        uploadedAt: result.contract.createdAt?.toISOString?.() ?? now.toISOString(),
        uploadedBy: {
          id: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
        },
        contract: {
          id: result.contract.id,
          docUrl: result.contract.docUrl,
          docName: result.contract.docName ?? undefined,
          notes: result.contract.notes ?? undefined,
        },
      };
    } catch (error: any) {
      logger.error("Error completing document generation (contract upload):", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[COMPLETE_DOCUMENT_GENERATION_ERROR] Failed to complete document generation step"
      );
    }
  }

  /**
   * Persist contract signatories and mark contract as sent for signing.
   *
   * @description Receives MK (company) and client signatories, persists them,
   * and updates contractStatus to contract_sent_for_signing.
   */
  static async setContractSignatories(
    loanApplicationId: string,
    clerkId: string,
    body: DocumentGenerationModel.SetContractSignatoriesBody
  ): Promise<DocumentGenerationModel.SetContractSignatoriesResponse> {
    try {
      // Get loan application with required columns
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, loanApplicationId), isNull(loanApplications.deletedAt)),
        columns: {
          id: true,
          status: true,
          contractStatus: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      if (loanApp.status !== "signing_execution") {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application must be in 'signing_execution' status to set contract signatories. Current status: ${loanApp.status}`
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

      // Ensure at least one signatory in each category (extra safety on top of JSON schema)
      if (!body.mkSignatories?.length || !body.clientSignatories?.length) {
        throw httpError(
          400,
          "[INVALID_SIGNATORIES] Both MK and client signatories must have at least one entry"
        );
      }

      // Ensure a contract document exists for this loan application
      const contractDocument = await db.query.loanDocuments.findFirst({
        where: and(
          eq(loanDocuments.loanApplicationId, loanApplicationId),
          eq(loanDocuments.documentType, "contract"),
          isNull(loanDocuments.deletedAt)
        ),
      });

      if (!contractDocument) {
        throw httpError(
          400,
          "[CONTRACT_NOT_FOUND] Contract document must be uploaded before setting signatories"
        );
      }

      const now = new Date();

      const result = await db.transaction(async (tx) => {
        // Clear existing signatories for this contract (if any)
        await tx
          .delete(loanContractSignatories)
          .where(
            and(
              eq(loanContractSignatories.loanApplicationId, loanApplicationId),
              eq(loanContractSignatories.contractDocumentId, contractDocument.id)
            )
          );

        const mkValues = body.mkSignatories.map(
          (s: DocumentGenerationModel.ContractSignatoryInput) => ({
            loanApplicationId,
            contractDocumentId: contractDocument.id,
            category: "mk" as const,
            fullName: s.fullName,
            email: s.email,
            roleTitle: s.roleTitle || null,
            signingOrder: s.signingOrder ?? null,
          })
        );

        const clientValues = body.clientSignatories.map(
          (s: DocumentGenerationModel.ContractSignatoryInput) => ({
            loanApplicationId,
            contractDocumentId: contractDocument.id,
            category: "client" as const,
            fullName: s.fullName,
            email: s.email,
            roleTitle: s.roleTitle || null,
            signingOrder: s.signingOrder ?? null,
          })
        );

        const insertedMk = await tx
          .insert(loanContractSignatories)
          .values(mkValues)
          .returning();

        const insertedClient = await tx
          .insert(loanContractSignatories)
          .values(clientValues)
          .returning();

        // Update contractStatus to indicate documents are out for signing
        await tx
          .update(loanApplications)
          .set({
            contractStatus: "contract_sent_for_signing",
            lastUpdatedBy: adminUser.id,
            lastUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(loanApplications.id, loanApplicationId));

        return { insertedMk, insertedClient };
      });

      const totalSignatories = result.insertedMk.length + result.insertedClient.length;

      // Audit event: contract sent for signing (documents out for signing)
      await LoanApplicationAuditService.logEvent({
        loanApplicationId,
        clerkId,
        eventType: "contract_sent_for_signing",
        title: LoanApplicationAuditService.getEventTitle("contract_sent_for_signing"),
        description: `Contract sent for signing with ${result.insertedMk.length} MK signatory(ies) and ${result.insertedClient.length} client signatory(ies).`,
        status: "signing_execution",
        previousStatus: loanApp.contractStatus || "contract_uploaded",
        newStatus: "contract_sent_for_signing",
        details: {
          contractDocumentId: contractDocument.id,
          mkSignatories: result.insertedMk.map((s: typeof loanContractSignatories.$inferSelect) => ({
            id: s.id,
            fullName: s.fullName,
            email: s.email,
          })),
          clientSignatories: result.insertedClient.map(
            (s: typeof loanContractSignatories.$inferSelect) => ({
              id: s.id,
              fullName: s.fullName,
              email: s.email,
            })
          ),
        },
      });

      return {
        loanApplicationId,
        contractStatus: "contract_sent_for_signing",
        totalSignatories,
        mkSignatories: result.insertedMk.map((s: typeof loanContractSignatories.$inferSelect) => ({
          id: s.id,
          category: "mk" as const,
          fullName: s.fullName,
          email: s.email,
          roleTitle: s.roleTitle ?? undefined,
          signingOrder: s.signingOrder ?? undefined,
          hasSigned: s.hasSigned,
          signedAt: s.signedAt?.toISOString?.(),
        })),
        clientSignatories: result.insertedClient.map(
          (s: typeof loanContractSignatories.$inferSelect) => ({
          id: s.id,
          category: "client" as const,
          fullName: s.fullName,
          email: s.email,
          roleTitle: s.roleTitle ?? undefined,
          signingOrder: s.signingOrder ?? undefined,
          hasSigned: s.hasSigned,
          signedAt: s.signedAt?.toISOString?.(),
        })),
      };
    } catch (error: any) {
      logger.error("Error setting contract signatories:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[SET_CONTRACT_SIGNATORIES_ERROR] Failed to set contract signatories for loan application"
      );
    }
  }
}

