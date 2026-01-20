import { logger } from "../utils/logger";

/**
 * Firma.dev API configuration
 *
 * Notes based on official docs:
 * - Recommended server for signing requests:
 *   https://api.firma.dev/functions/v1/signing-request-api
 * - Authentication is via Authorization header with the raw API key.
 * - POST /signing-requests accepts either:
 *   - document-based body (we use this), or
 *   - template-based body (not used here).
 */

const FIRMA_API_BASE_URL =
  process.env.FIRMA_API_BASE_URL || "https://api.firma.dev/functions/v1/signing-request-api";
const FIRMA_API_KEY = process.env.FIRMA_API_KEY;

export interface FirmaSignerInput {
  name: string;
  email: string;
  /**
   * Signing order for sequential workflows.
   * Lower numbers sign first. Required by Firma for all recipients.
   */
  order: number;
}

export interface FirmaCreateDocumentSigningRequestParams {
  /**
   * Human-readable name for the signing request (e.g. "Loan Contract LN-123").
   */
  name: string;
  /**
   * Public URL to the PDF document for this specific loan.
   * The service will fetch and base64-encode it for Firma.
   */
  documentUrl: string;
  /**
   * Recipients for the signing request.
   * Will be mapped to Firma's Recipient schema.
   */
  recipients: FirmaSignerInput[];
}

export interface FirmaSendSigningRequestParams {
  /**
   * ID of the signing request returned by createDocumentSigningRequest
   */
  signingRequestId: string;
  /**
   * Optional custom message shown in the email invite to all recipients.
   */
  customMessage?: string;
}

export class FirmaService {
  private getApiKey(): string {
    if (!FIRMA_API_KEY) {
      throw new Error(
        "FIRMA_API_KEY is not configured. Please set it in your environment variables."
      );
    }
    return FIRMA_API_KEY;
  }

  /**
   * Create a document-based signing request in Firma.dev.
   *
   * This follows the "document" variant of PatchSigningRequestBodySchema:
   *
   * {
   *   "document": "<base64-pdf>",
   *   "name": "Contract for Client X",
   *   "recipients": [
   *     {
   *       "id": "temp_1",
   *       "first_name": "John",
   *       "last_name": "Doe",
   *       "email": "john@example.com",
   *       "designation": "Signer",
   *       "order": 1
   *     }
   *   ]
   * }
   */
  async createDocumentSigningRequest(
    params: FirmaCreateDocumentSigningRequestParams
  ): Promise<any> {
    const apiKey = this.getApiKey();
    const url = `${FIRMA_API_BASE_URL}/signing-requests`;

    // Fetch and base64-encode the PDF from the provided URL
    const docResponse = await fetch(params.documentUrl);
    if (!docResponse.ok) {
      const text = await docResponse.text().catch(() => "");
      logger.error("[Firma] Failed to fetch contract document", {
        status: docResponse.status,
        statusText: docResponse.statusText,
        body: text,
        documentUrl: params.documentUrl,
      });
      throw new Error(
        `[FIRMA_DOCUMENT_FETCH_FAILED] ${docResponse.status} ${docResponse.statusText}`
      );
    }

    const arrayBuffer = await docResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const documentBase64 = buffer.toString("base64");

    const recipients = params.recipients.map((recipient, index) => {
      const parts = recipient.name.trim().split(/\s+/);
      const firstName = parts[0] || recipient.name;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;

      return {
        id: `temp_${index + 1}`,
        first_name: firstName,
        last_name: lastName,
        email: recipient.email,
        designation: "Signer" as const,
        order: recipient.order,
      };
    });

    const payload = {
      document: documentBase64,
      name: params.name,
      recipients,
    };

    logger.info("[Firma] Creating document-based signing request", {
      url,
      recipientCount: recipients.length,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Per OpenAPI: use Authorization header with raw API key
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("[Firma] Failed to create signing request", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      throw new Error(
        `[FIRMA_SIGNING_REQUEST_FAILED] ${response.status} ${response.statusText}`
      );
    }

    try {
      const data = await response.json();
      logger.info("[Firma] Signing request created successfully", {
        signingRequestId: data?.id,
      });
      return data;
    } catch (_error) {
      // If response is not JSON or empty, still treat as success but return undefined
      logger.warn("[Firma] Signing request created but response was not JSON");
      return undefined;
    }
  }

  /**
   * Send a previously created signing request via email to all recipients.
   *
   * This calls:
   *   POST /signing-requests/{signing_request_id}/send
   * with an optional { custom_message } body.
   */
  async sendSigningRequest(params: FirmaSendSigningRequestParams): Promise<any> {
    const apiKey = this.getApiKey();
    const url = `${FIRMA_API_BASE_URL}/signing-requests/${params.signingRequestId}/send`;

    const body: any = {};
    if (params.customMessage && params.customMessage.trim().length > 0) {
      body.custom_message = params.customMessage;
    }

    logger.info("[Firma] Sending signing request emails", {
      url,
      signingRequestId: params.signingRequestId,
      hasCustomMessage: !!body.custom_message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : "{}",
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("[Firma] Failed to send signing request emails", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      throw new Error(
        `[FIRMA_SEND_SIGNING_REQUEST_FAILED] ${response.status} ${response.statusText}`
      );
    }

    try {
      const data = await response.json();
      logger.info("[Firma] Signing request emails sent successfully", {
        signingRequestId: params.signingRequestId,
      });
      return data;
    } catch (_error) {
      logger.warn("[Firma] Signing request emails sent but response was not JSON");
      return undefined;
    }
  }
}

export const firmaService = new FirmaService();

