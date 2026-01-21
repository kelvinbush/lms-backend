import { logger } from "../utils/logger";
import "dotenv/config";
import { config } from "dotenv";

config()

/**
 * SignRequest API service
 *
 * Based on the official OpenAPI definition in swagger.json:
 * - Base URL: https://signrequest.com/api/v1
 * - Auth: Authorization: Token YOUR_TOKEN_HERE
 * - Quick create endpoint: POST /signrequest-quick-create/
 *   (operationId: signrequest-quick-create_create)
 */

const SIGNREQUEST_API_BASE_URL =
  process.env.SIGNREQUEST_API_BASE_URL || "https://signrequest.com/api/v1";
const SIGNREQUEST_API_TOKEN = process.env.SIGNREQUEST_API_TOKEN;

export interface SignRequestSignerInput {
  name: string;
  email: string;
  /**
   * Signing order for sequential workflows.
   * Lower numbers sign first.
   */
  order: number;
}

export interface SignRequestCreateQuickParams {
  /**
   * Human-readable name for the envelope (used as document name / subject).
   */
  name: string;
  /**
   * Public URL to the PDF document for this specific loan.
   * Will be passed as file_from_url to SignRequest.
   */
  documentUrl: string;
  /**
   * Sender email (must be a validated email in the SignRequest team).
   */
  fromEmail: string;
  /**
   * Recipients for the signing request.
   */
  recipients: SignRequestSignerInput[];
}

export class SignRequestService {
  private getApiToken(): string {
    if (!SIGNREQUEST_API_TOKEN) {
      throw new Error(
        "SIGNREQUEST_API_TOKEN is not configured. Please set it in your environment variables."
      );
    }
    return SIGNREQUEST_API_TOKEN;
  }

  /**
   * Quick create a SignRequest (document + signrequest in one call).
   *
   * Uses POST /signrequest-quick-create/ with:
   * - file_from_url: your contract URL
   * - from_email: MK sender
   * - signers: mapped from recipients
   */
  async createQuickSignRequest(
    params: SignRequestCreateQuickParams
  ): Promise<any> {
    const apiToken = this.getApiToken();
    const url = `${SIGNREQUEST_API_BASE_URL}/signrequest-quick-create/`;

    const signers = params.recipients.map((recipient) => {
      const parts = recipient.name.trim().split(/\s+/);
      const firstName = parts[0] || recipient.name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

      return {
        email: recipient.email,
        first_name: firstName,
        last_name: lastName,
        order: recipient.order,
      };
    });

    const payload = {
      from_email: params.fromEmail,
      file_from_url: params.documentUrl,
      name: params.name,
      // Only others sign (MK sender gets a copy)
      who: "o" as const,
      signers,
      // Let SignRequest send emails & handle reminders by default
      send_reminders: true,
    };

    logger.info("[SignRequest] Creating quick signrequest", {
      url,
      recipientCount: signers.length,
      documentUrl: params.documentUrl,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("[SignRequest] Failed to create quick signrequest", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      throw new Error(
        `[SIGNREQUEST_QUICK_CREATE_FAILED] ${response.status} ${response.statusText}`
      );
    }

    try {
      const data = await response.json();
      logger.info("[SignRequest] Quick signrequest created successfully", {
        documentUrl: data?.document,
      });
      return data;
    } catch (_error) {
      logger.warn("[SignRequest] Quick signrequest created but response was not JSON");
      return undefined;
    }
  }

  /**
   * Resend SignRequest emails to all pending signers for a given signrequest UUID.
   *
   * Uses POST /signrequests/{uuid}/resend_signrequest_email/
   */
  async resendSignRequestEmail(signrequestUuid: string): Promise<void> {
    const apiToken = this.getApiToken();
    const url = `${SIGNREQUEST_API_BASE_URL}/signrequests/${signrequestUuid}/resend_signrequest_email/`;

    logger.info("[SignRequest] Resending signrequest emails", {
      url,
      signrequestUuid,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("[SignRequest] Failed to resend signrequest emails", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      throw new Error(
        `[SIGNREQUEST_RESEND_EMAIL_FAILED] ${response.status} ${response.statusText}`
      );
    }
  }
}

export const signRequestService = new SignRequestService();

