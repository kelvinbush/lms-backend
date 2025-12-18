import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OfferLettersModel } from "../modules/offer-letters/offer-letters.model";
import { OfferLettersService } from "../modules/offer-letters/offer-letters.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function offerLettersRoutes(fastify: FastifyInstance) {
  // CREATE offer letter
  fastify.post(
    "/",
    {
      schema: {
        body: OfferLettersModel.CreateOfferLetterBodySchema,
        response: {
          200: OfferLettersModel.CreateOfferLetterResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await OfferLettersService.create(
          userId,
          request.body as OfferLettersModel.CreateOfferLetterBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create offer letter", code: "CREATE_OFFER_LETTER_FAILED" });
      }
    }
  );

  // SEND offer letter via DocuSign
  fastify.post(
    "/:id/send",
    {
      schema: {
        params: OfferLettersModel.OfferLetterIdParamsSchema,
        body: OfferLettersModel.SendOfferLetterBodySchema,
        response: {
          200: OfferLettersModel.SendOfferLetterResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await OfferLettersService.sendOfferLetter(
          userId,
          id,
          request.body as OfferLettersModel.SendOfferLetterBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error sending offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to send offer letter", code: "SEND_OFFER_LETTER_FAILED" });
      }
    }
  );

  // LIST offer letters with optional query parameters
  fastify.get(
    "/",
    {
      schema: {
        querystring: OfferLettersModel.ListOfferLettersQuerySchema,
        response: {
          200: OfferLettersModel.ListOfferLettersResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const query = (request.query as any) || {};
        const result = await OfferLettersService.list(userId, query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing offer letters:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list offer letters", code: "LIST_OFFER_LETTERS_FAILED" });
      }
    }
  );

  // GET offer letter by ID
  fastify.get(
    "/:id",
    {
      schema: {
        params: OfferLettersModel.OfferLetterIdParamsSchema,
        response: {
          200: OfferLettersModel.GetOfferLetterResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await OfferLettersService.getById(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get offer letter", code: "GET_OFFER_LETTER_FAILED" });
      }
    }
  );

  // UPDATE offer letter
  fastify.patch(
    "/:id",
    {
      schema: {
        params: OfferLettersModel.OfferLetterIdParamsSchema,
        body: OfferLettersModel.UpdateOfferLetterBodySchema,
        response: {
          200: OfferLettersModel.UpdateOfferLetterResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await OfferLettersService.update(
          userId,
          id,
          request.body as OfferLettersModel.UpdateOfferLetterBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update offer letter", code: "UPDATE_OFFER_LETTER_FAILED" });
      }
    }
  );

  // VOID offer letter
  fastify.patch(
    "/:id/void",
    {
      schema: {
        params: OfferLettersModel.OfferLetterIdParamsSchema,
        response: {
          200: OfferLettersModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await OfferLettersService.voidOfferLetter(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error voiding offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to void offer letter", code: "VOID_OFFER_LETTER_FAILED" });
      }
    }
  );

  // DELETE offer letter (soft delete)
  fastify.delete(
    "/:id",
    {
      schema: {
        params: OfferLettersModel.OfferLetterIdParamsSchema,
        response: {
          200: OfferLettersModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await OfferLettersService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting offer letter:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete offer letter", code: "DELETE_OFFER_LETTER_FAILED" });
      }
    }
  );

  // DOCUSIGN WEBHOOK - Handle DocuSign status updates
  fastify.post(
    "/webhooks/docusign",
    {
      schema: {
        body: OfferLettersModel.DocuSignWebhookBodySchema,
        response: {
          200: OfferLettersModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["offer-letters", "webhooks"],
      },
      config: { rawBody: true }, // For webhook signature verification
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add DocuSign webhook signature verification
        // const signature = request.headers['x-docusign-signature'];
        // const isValid = verifyDocuSignWebhook(body, signature);
        // if (!isValid) return reply.code(401).send({ error: "Invalid signature" });

        const result = await OfferLettersService.handleDocuSignWebhook(
          request.body as OfferLettersModel.DocuSignWebhookBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error processing DocuSign webhook:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to process DocuSign webhook", code: "DOCUSIGN_WEBHOOK_FAILED" });
      }
    }
  );
}
