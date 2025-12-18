import { clerkClient, getAuth } from "@clerk/fastify";
/**
 * User routes for Fastify (flattened)
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UserModel } from "../modules/user/user.model";
import { User } from "../modules/user/user.service";
import { logger } from "../utils/logger";

export async function userRoutes(fastify: FastifyInstance) {
  // POST /user/send-phone-otp — requires auth
  fastify.post(
    "/send-phone-otp",
    {
      schema: {
        body: UserModel.OtpRequestBodySchema,
        response: {
          200: UserModel.OtpResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await User.sendPhoneVerificationOtp(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error sending phone OTP:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({ error: "Failed to send OTP", code: "OTP_SEND_FAILED" });
      }
    }
  );

  // POST /user/verify-phone-otp — requires auth
  fastify.post(
    "/verify-phone-otp",
    {
      schema: {
        body: UserModel.OtpVerificationBodySchema,
        response: {
          200: UserModel.OtpVerificationResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { otp } = (request.body as any) || {};
        if (!otp) {
          return reply.code(400).send({ error: "OTP is required", code: "INVALID_INPUT" });
        }
        const result = await User.verifyPhoneOtp(userId, otp);

        // If verification succeeded, update Clerk public metadata so session claims reflect the change
        if (result.success) {
          try {
            await clerkClient.users.updateUser(userId, {
              publicMetadata: { isPhoneVerified: true },
            });
          } catch (e) {
            logger.error("Failed to update Clerk publicMetadata.isPhoneVerified:", e);
            // Do not fail the request if metadata update fails; client already verified OTP
          }
        }

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error verifying phone OTP:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to verify OTP",
          code: "OTP_VERIFICATION_FAILED",
        });
      }
    }
  );

  // GET /user/resend-phone-otp — requires auth
  fastify.get(
    "/resend-phone-otp",
    {
      schema: {
        response: {
          200: UserModel.OtpResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await User.resendPhoneVerificationOtp(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error resending phone OTP:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({ error: "Failed to resend OTP", code: "OTP_RESEND_FAILED" });
      }
    }
  );

  // POST /user/edit-phone — requires auth
  fastify.post(
    "/edit-phone",
    {
      schema: {
        body: UserModel.EditPhoneBodySchema,
        response: {
          200: UserModel.EditPhoneResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { phoneNumber } = (request.body as any) || {};

        const result = await User.updatePhoneNumber(userId, phoneNumber);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating phone:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to update phone",
          code: "PHONE_UPDATE_FAILED",
        });
      }
    }
  );

  // POST /user/update-docs — update user fields and attach personal documents
  fastify.post(
    "/update-docs",
    {
      schema: {
        body: UserModel.UpdateUserAndDocumentsBodySchema,
        response: {
          200: UserModel.UpdateUserAndDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const result = await User.updateUserAndDocuments(
          userId,
          request.body as UserModel.UpdateUserAndDocumentsBody
        );

        if (result.success) {
          try {
            await clerkClient.users.updateUser(userId, {
              publicMetadata: { onBoardingStage: 1, isPhoneVerified: true },
            });
          } catch (e) {
            logger.error("Failed to update Clerk publicMetadata.isPhoneVerified:", e);
          }
        }

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating user and documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to update user and documents",
          code: "UPDATE_USER_DOCS_FAILED",
        });
      }
    }
  );

  // PUT /user/edit-profile — requires auth
  fastify.put(
    "/edit-profile",
    {
      schema: {
        body: UserModel.EditUserProfileBodySchema,
        response: {
          200: UserModel.EditUserProfileResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await User.editProfile(
          userId,
          request.body as UserModel.EditUserProfileBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error editing profile:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to edit profile",
          code: "PROFILE_EDIT_FAILED",
        });
      }
    }
  );

  // GET /user — requires auth
  fastify.get(
    "/profile",
    {
      schema: {
        response: {
          200: UserModel.GetUserProfileResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await User.getUserProfile(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting user profile:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get user profile",
          code: "GET_PROFILE_ERROR",
        });
      }
    }
  );
}
