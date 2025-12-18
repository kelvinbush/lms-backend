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

/**
 * Require authentication (either admin/member or entrepreneur)
 * Returns the authenticated user
 */
export async function requireAuth(request: FastifyRequest) {
  const { userId } = getAuth(request);
  if (!userId) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  const current = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
  if (!current) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return current;
}

/**
 * Check if user is an admin/member (has a role)
 */
export function isAdminOrMember(user: { role: string | null }): boolean {
  return user.role === "admin" || user.role === "super-admin" || user.role === "member";
}

/**
 * Check if user is an entrepreneur (no admin role)
 */
export function isEntrepreneur(user: { role: string | null }): boolean {
  return !isAdminOrMember(user);
}
