import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
/**
 * Swagger/OpenAPI plugin (flattened)
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

export const swaggerPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Melanin Kapital API",
        description: "API documentation for Melanin Kapital backend",
        version: "1.0.0",
      },
      servers: [
        {
          url: process.env.API_URL || `http://localhost:${process.env.PORT || 8081}`,
          description: "Server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  // Only register UI when enabled
  if ((process.env.SWAGGER_UI_ENABLED || "true").toLowerCase() === "true") {
    await fastify.register(fastifySwaggerUi, {
      routePrefix: "/documentation",
      uiConfig: { docExpansion: "list", deepLinking: true },
      staticCSP: true,
      transformSpecificationClone: true,
    });
  }
});
