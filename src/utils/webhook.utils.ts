import type { WebhookEvent } from "@clerk/fastify";
import { Webhook } from "svix";
import { logger } from "./logger";

export interface WebhookVerificationResult {
  success: boolean;
  event?: WebhookEvent;
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Verifies a Clerk webhook request
 * @param body The request body
 * @param headers The request headers containing svix-id, svix-timestamp, and svix-signature
 * @returns WebhookVerificationResult with success status and event data or error
 */
export const verifyClerkWebhook = (
  body: any,
  headers: {
    "svix-id"?: string;
    "svix-timestamp"?: string;
    "svix-signature"?: string;
  }
): WebhookVerificationResult => {
  try {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      return {
        success: false,
        error: {
          message: "WEBHOOK_SECRET is not set",
          code: "WEBHOOK_SECRET_MISSING",
        },
      };
    }

    const svix_id = headers["svix-id"];
    const svix_timestamp = headers["svix-timestamp"];
    const svix_signature = headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return {
        success: false,
        error: {
          message: "Missing svix headers",
          code: "SVIX_HEADERS_MISSING",
        },
      };
    }

    const wh = new Webhook(WEBHOOK_SECRET);

    // Use raw payload when provided; fallback to JSON stringified body
    const payload = typeof body === "string" ? body : JSON.stringify(body);

    const evt: WebhookEvent = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;

    return {
      success: true,
      event: evt,
    };
  } catch (error) {
    logger.error("Error verifying webhook:", error);
    return {
      success: false,
      error: {
        message: "Failed to verify webhook signature",
        code: "WEBHOOK_VERIFICATION_FAILED",
      },
    };
  }
};
