import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ClerkWebhookService } from "../services/clerk-webhook.service";
import { type DocuSignWebhookEvent, docuSignService } from "../services/docusign.service";
import { SignRequestWebhookService } from "../services/signrequest-webhook.service";
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

  // SignRequest webhook endpoint (Events callback)
  fastify.post(
    "/signrequest",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rawBody: any = (request as any).rawBody || request.body;
        const payload =
          typeof rawBody === "string" || Buffer.isBuffer(rawBody)
            ? rawBody
            : JSON.stringify(rawBody ?? {});

        const payloadString =
          typeof payload === "string" ? payload : payload.toString("utf8");

        let event: any;
        try {
          event = JSON.parse(payloadString);
        } catch {
          return reply.code(400).send({
            error: "Invalid JSON body",
            code: "INVALID_JSON",
          });
        }

        // Verify event_hash using API token as per SignRequest docs:
        // event_hash = HMAC_SHA256(key=API_TOKEN, data=event_time + event_type)
        const apiToken = process.env.SIGNREQUEST_API_TOKEN;
        if (!apiToken) {
          logger.error("SIGNREQUEST_API_TOKEN is not configured");
          return reply.code(500).send({
            error: "Webhook secret not configured",
            code: "SIGNREQUEST_API_TOKEN_MISSING",
          });
        }

        const eventTime = event.event_time as string | undefined;
        const eventType = event.event_type as string | undefined;
        const eventHash = event.event_hash as string | undefined;

        if (!eventTime || !eventType || !eventHash) {
          logger.error("[SignRequestWebhook] Missing event_time, event_type, or event_hash");
          return reply.code(400).send({
            error: "Missing event_time, event_type, or event_hash",
            code: "INVALID_EVENT",
          });
        }

        const dataToSign = `${eventTime}${eventType}`;
        const expectedHash = crypto
          .createHmac("sha256", apiToken)
          .update(dataToSign)
          .digest("hex");

        let isValid = false;
        try {
          isValid = crypto.timingSafeEqual(
            Buffer.from(eventHash),
            Buffer.from(expectedHash)
          );
        } catch {
          isValid = false;
        }

        if (!isValid) {
          logger.error("Invalid SignRequest event_hash");
          return reply.code(401).send({
            error: "Invalid signature",
            code: "INVALID_SIGNATURE",
          });
        }

        logger.info("[SignRequestWebhook] Received webhook event", {
          eventType,
          documentUuid: event.document?.uuid,
        });

        // Process asynchronously, but after acknowledging receipt
        void SignRequestWebhookService.processWebhookEvent(event);

        return reply.code(200).send({ received: true });
      } catch (error: any) {
        logger.error("Error processing SignRequest webhook:", error);
        return reply.code(500).send({
          error: "Failed to process SignRequest webhook",
          code: "SIGNREQUEST_WEBHOOK_ERROR",
        });
      }
    }
  );
  // Health check for webhooks
  fastify.get("/health", async (_request, reply) => {
    reply.code(200).send({ status: "healthy", timestamp: new Date().toISOString() });
  });
}
