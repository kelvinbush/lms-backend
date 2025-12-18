import { getAuth } from "@clerk/fastify";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db";
import { users } from "../db/schema";

export async function requireRole(
  request: FastifyRequest,
  role: "super-admin" | "admin" | "member"
) {
  const { userId } = getAuth(request);
  if (!userId) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  const current = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
  if (!current || !current.role) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  const order = ["member", "admin", "super-admin"];
  if (order.indexOf(current.role as any) < order.indexOf(role)) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return current;
}

export async function requireSuperAdmin(request: FastifyRequest) {
  return requireRole(request, "super-admin");
}
