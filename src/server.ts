/**
 * Fastify server entry point - consolidated from app.ts, index.ts, and server.ts
 */
import "dotenv/config";
import { clerkClient, clerkPlugin, getAuth } from "@clerk/fastify";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import requestId from "fastify-request-id";
import { ResponseCachingService } from "./modules/response-caching/response-caching.service";
import { corsPlugin } from "./plugins/cors";
import { databasePlugin } from "./plugins/database";
import { helmetPlugin } from "./plugins/helmet";
import { rateLimitPlugin } from "./plugins/rate-limit";
import { rawBodyPlugin } from "./plugins/raw-body";
import { requestLoggerPlugin } from "./plugins/request-logger";
import { swaggerPlugin } from "./plugins/swagger";
import { adminInternalUsersRoutes } from "./routes/admin-internal-users.routes";
import { adminSMERoutes } from "./routes/admin-sme.routes";
import { businessDocumentsRoutes } from "./routes/business-documents.routes";
import { businessRoutes } from "./routes/business.routes";
import { documentsRoutes } from "./routes/documents.routes";
// TODO: Re-add loan applications routes when loan applications are re-implemented
// import { loanApplicationsRoutes } from './routes/loan-applications.routes';
// TODO: Re-add offer letters routes when offer letters are re-implemented
// import { offerLettersRoutes } from './routes/offer-letters.routes';
import { investorOpportunitiesRoutes } from "./routes/investor-opportunities.routes";
import { loanFeesRoutes } from "./routes/loan-fees.routes";
import { loanProductsRoutes } from "./routes/loan-products.routes";
import { organizationsRoutes } from "./routes/organizations.routes";
// TODO: Re-add webhook routes when docusign webhook is re-implemented
// import { webhookRoutes } from './routes/webhooks.routes';
// TODO: Re-add document requests routes when document requests are re-implemented
// import { documentRequestsRoutes } from './routes/document-requests.routes';
import { userGroupsRoutes } from "./routes/user-groups.routes";
import { userRoutes } from "./routes/user.routes";
import { errorHandler } from "./utils/error-handler";
import { logger } from "./utils/logger";

config();

const PORT = Number(process.env.PORT || 8081);
const HOST = process.env.HOST || "0.0.0.0";

const app: FastifyInstance = Fastify({
  logger: true,
});

export async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(errorHandler);

  // Configure Ajv with $data support and formats for JSON schema validation
  const ajv = new Ajv({ allErrors: true, $data: true, removeAdditional: false, strict: false });
  addFormats(ajv);
  fastify.setValidatorCompiler(({ schema /*, method, url, httpPart */ }) => {
    return ajv.compile(schema as any);
  });

  await fastify.register(requestId);
  await fastify.register(rawBodyPlugin);

  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(requestLoggerPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(databasePlugin);

  await fastify.register(clerkPlugin);

  // Register response caching plugin
  await fastify.register(ResponseCachingService.createPlugin());

  await fastify.register(userRoutes, { prefix: "/user" });
  await fastify.register(adminInternalUsersRoutes);
  await fastify.register(adminSMERoutes);
  await fastify.register(businessRoutes, { prefix: "/business" });
  await fastify.register(documentsRoutes, { prefix: "/documents" });
  await fastify.register(businessDocumentsRoutes, { prefix: "/business" });
  await fastify.register(loanProductsRoutes, { prefix: "/loan-products" });
  // TODO: Re-add loan applications routes when loan applications are re-implemented
  // await fastify.register(loanApplicationsRoutes, { prefix: '/loan-applications' });
  // TODO: Re-add offer letters routes when offer letters are re-implemented
  // await fastify.register(offerLettersRoutes, { prefix: '/offer-letters' });
  await fastify.register(investorOpportunitiesRoutes, { prefix: "/investor-opportunities" });
  // TODO: Re-add document requests routes when document requests are re-implemented
  // await fastify.register(documentRequestsRoutes, { prefix: '/document-requests' });
  await fastify.register(userGroupsRoutes, { prefix: "/user-groups" });
  await fastify.register(organizationsRoutes, { prefix: "/organizations" });
  await fastify.register(loanFeesRoutes, { prefix: "/loan-fees" });
  // TODO: Re-add webhook routes when docusign webhook is re-implemented
  // await fastify.register(webhookRoutes, { prefix: '/webhooks' });

  fastify.get("/", async () => {
    return { message: "Hello from Fastify!" };
  });

  fastify.get("/health", async (request, reply) => {
    try {
      const _result = await fastify.db.execute(sql`SELECT 1 AS ok`);
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: { connected: true },
        version: process.env.npm_package_version || "1.0.0",
      };
    } catch (err) {
      request.log.error(err, "Database health check failed");
      return reply.status(500).send({
        status: "error",
        timestamp: new Date().toISOString(),
        database: { connected: false },
        error: "Database connection failed",
      });
    }
  });

  fastify.get("/protected", async (request, reply) => {
    try {
      const { isAuthenticated, userId } = getAuth(request);
      if (!isAuthenticated || !userId) {
        return reply.code(401).send({ error: "User not authenticated" });
      }
      const user = await clerkClient.users.getUser(userId);
      return reply.send({ message: "User retrieved successfully", user });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Failed to retrieve user" });
    }
  });
}

export async function startServer(): Promise<FastifyInstance> {
  try {
    await registerPlugins(app);
    await app.listen({ port: PORT, host: HOST });
    const address = app.server.address();
    const serverPort = typeof address === "object" && address !== null ? address.port : PORT;
    logger.info(`🚀 Fastify server running at http://${HOST}:${serverPort}`);
    return app;
  } catch (err: any) {
    logger.error(err?.message);
    process.exit(1);
  }
}

export { app };

// Start the server when this module is executed directly
// This works for both development (`bun run src/server.ts`) and production (`bun run dist/server.js`)
if (import.meta.main) {
  void startServer();
}
