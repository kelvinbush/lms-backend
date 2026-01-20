import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ClerkWebhookService } from "../services/clerk-webhook.service";
import { type DocuSignWebhookEvent, docuSignService } from "../services/docusign.service";
import { FirmaWebhookService } from "../services/firma-webhook.service";
import { logger } from "../utils/logger";
import { verifyClerkWebhook } from "../utils/webhook.utils";
import crypto from "crypto";

export async function webhookRoutes(fastify: FastifyInstance) {
  // DocuSign webhook endpoint
  fastify.post("/docusign", async (request, reply) => {
    try {
      const event = request.body as any; // Use any for better debugging

      logger.info("Received DocuSign webhook - Raw payload:", JSON.stringify(event, null, 2));

      // Check if the event has the expected structure
      if (!event || !event.event) {
        logger.error("Invalid webhook payload - missing event field:", event);
        reply.code(400).send({ error: "Invalid webhook payload" });
        return;
      }

      // Try to extract envelope information with fallback
      let envelopeId: string;
      let status: string;

      if (event.data?.envelopeSummary) {
        envelopeId = event.data.envelopeSummary.envelopeId;
        status = event.data.envelopeSummary.status;
      } else if (event.data?.envelopeId) {
        envelopeId = event.data.envelopeId;
        status = event.data.status || "unknown";
      } else {
        logger.error("Invalid webhook payload - missing envelope information:", event);
        reply.code(400).send({ error: "Missing envelope information" });
        return;
      }

      logger.info("Received DocuSign webhook:", {
        event: event.event,
        envelopeId: envelopeId,
        status: status,
      });

      // Process the webhook event
      await docuSignService.processWebhookEvent(event as DocuSignWebhookEvent);

      // Update offer letter and loan application status based on DocuSign event
      await docuSignService.processWebhookEvent(event as DocuSignWebhookEvent);

      reply.code(200).send({ success: true });
    } catch (error) {
      logger.error("Error processing DocuSign webhook:", error);
      reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Clerk webhook endpoint
  fastify.post(
    "/clerk",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Verify webhook signature
        const body: any = (request as any).rawBody || request.body;
        const headers = {
          "svix-id": (request.headers["svix-id"] as string) || undefined,
          "svix-timestamp": (request.headers["svix-timestamp"] as string) || undefined,
          "svix-signature": (request.headers["svix-signature"] as string) || undefined,
        } as const;

        const webhookResult = verifyClerkWebhook(body, headers);
        if (!webhookResult.success) {
          return reply.code(400).send({
            error: webhookResult.error?.message || "Invalid webhook signature",
            code: webhookResult.error?.code || "WEBHOOK_VERIFICATION_FAILED",
          });
        }

        // Route event to appropriate handler
        const { event } = webhookResult;
        if (!event) {
          return reply.code(400).send({
            error: "Missing event in webhook payload",
            code: "MISSING_EVENT",
          });
        }

        const result = await ClerkWebhookService.handleWebhookEvent(event);

        // Handle response based on result
        if (!result.success) {
          const statusCode =
            result.error?.code?.includes("EXTRACTION") || result.error?.code?.includes("INVALID")
              ? 400
              : 500;
          return reply.code(statusCode).send({
            error: result.error?.message || "Failed to process webhook",
            code: result.error?.code || "WEBHOOK_HANDLER_ERROR",
          });
        }

        return reply.send(result.data || { received: true });
      } catch (err) {
        logger.error("Unexpected error while handling Clerk webhook:", err);
        return reply.code(500).send({
          error: "Unexpected error while handling Clerk webhook",
          code: "UNEXPECTED_ERROR",
        });
      }
    }
  );

 // Firma.dev webhook endpoint
  fastify.post(
    "/firma",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rawBody: any = (request as any).rawBody || request.body;
        const payload =
          typeof rawBody === "string" || Buffer.isBuffer(rawBody)
            ? rawBody
            : JSON.stringify(rawBody ?? {});

        const signature = request.headers["x-firma-signature"] as string | undefined;
        const signatureOld = request.headers["x-firma-signature-old"] as string | undefined;
        const signingSecret = process.env.FIRMA_WEBHOOK_SECRET;

        // VERY VERBOSE DEBUG LOGGING – safe to remove once things are stable
        const payloadString =
          typeof payload === "string" ? payload : payload.toString("utf8");
        logger.info("[FirmaWebhook] Full incoming request debug", {
          method: request.method,
          url: request.url,
          headers: request.headers,
          rawBodyType: typeof rawBody,
          rawBodyIsBuffer: Buffer.isBuffer(rawBody),
          rawBodyLength: Buffer.isBuffer(rawBody) ? rawBody.length : payloadString.length,
          rawBodyString: payloadString,
          signature,
          signatureOld,
          signingSecretLength: signingSecret?.length ?? null,
        });

        if (!signingSecret) {
          logger.error("FIRMA_WEBHOOK_SECRET is not configured");
          return reply.code(500).send({
            error: "Webhook secret not configured",
            code: "FIRMA_WEBHOOK_SECRET_MISSING",
          });
        }

        // Firma signature verification
        // Header format: "t=<timestamp>,v1=<hex_signature>"
        // Firma signs: HMAC-SHA256(secret, timestamp + "." + payload)
        const parseSignatureHeader = (
          raw?: string
        ): { timestamp?: string; signature?: string } => {
          if (!raw) return {};
          const result: { timestamp?: string; signature?: string } = {};
          for (const part of raw.split(",")) {
            const trimmed = part.trim();
            if (trimmed.startsWith("t=")) {
              result.timestamp = trimmed.slice(2);
            } else if (trimmed.startsWith("v1=")) {
              result.signature = trimmed.slice(3);
            }
          }
          return result;
        };

        const verifySignature = (rawSig?: string): boolean => {
          const { timestamp, signature: sig } = parseSignatureHeader(rawSig);
          if (!sig) return false;

          // Firma signs: timestamp + "." + payload (Stripe-style)
          const signedPayload = timestamp ? `${timestamp}.${payloadString}` : payloadString;

          const expectedSignature = crypto
            .createHmac("sha256", signingSecret)
            .update(signedPayload)
            .digest("hex");

          logger.info("[FirmaWebhook] Verifying signature", {
            timestamp: timestamp || "none",
            providedLength: sig.length,
            expectedLength: expectedSignature.length,
            providedPrefix: sig.slice(0, 8),
            expectedPrefix: expectedSignature.slice(0, 8),
            signedPayloadLength: signedPayload.length,
            signedPayloadPrefix: signedPayload.slice(0, 50),
          });

          try {
            return crypto.timingSafeEqual(
              Buffer.from(sig),
              Buffer.from(expectedSignature)
            );
          } catch {
            return false;
          }
        };

        // Check current signature first, then old signature during rotation
        if (!verifySignature(signature) && !verifySignature(signatureOld)) {
          logger.error("Invalid Firma webhook signature", {
            hasSignature: !!signature,
            hasOldSignature: !!signatureOld,
          });
          return reply.code(401).send({
            error: "Invalid signature",
            code: "INVALID_SIGNATURE",
          });
        }

        const event =
          typeof payload === "string"
            ? JSON.parse(payload)
            : JSON.parse(payload.toString("utf8"));

        // Process asynchronously, but after acknowledging receipt
        void FirmaWebhookService.processWebhookEvent(event);

        return reply.code(200).send({ received: true });
      } catch (error: any) {
        logger.error("Error processing Firma webhook:", error);
        return reply.code(500).send({
          error: "Failed to process Firma webhook",
          code: "FIRMA_WEBHOOK_ERROR",
        });
      }
    }
  );
  // Health check for webhooks
  fastify.get("/health", async (_request, reply) => {
    reply.code(200).send({ status: "healthy", timestamp: new Date().toISOString() });
  });
}
