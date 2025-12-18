import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ClerkWebhookService } from "../services/clerk-webhook.service";
import { DocuSignWebhookService } from "../services/docusign-webhook.service";
import { type DocuSignWebhookEvent, docuSignService } from "../services/docusign.service";
import { logger } from "../utils/logger";
import { verifyClerkWebhook } from "../utils/webhook.utils";

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
      await DocuSignWebhookService.handleStatusUpdate(event as DocuSignWebhookEvent);

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

  // Health check for webhooks
  fastify.get("/health", async (_request, reply) => {
    reply.code(200).send({ status: "healthy", timestamp: new Date().toISOString() });
  });
}
