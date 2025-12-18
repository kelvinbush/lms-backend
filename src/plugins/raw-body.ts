/**
 * Raw body plugin wrapper (flattened)
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import rawBody from "fastify-raw-body";

export const rawBodyPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });
});
