import { prisma } from "./prisma.js";
import { redis } from "./redis.js";

/**
 * Verifies PostgreSQL connectivity with a trivial query.
 * Throws when the database cannot be reached.
 */
export async function checkDatabaseHealth(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

/**
 * Verifies Redis connectivity with a ping.
 * Throws when Redis cannot be reached.
 */
export async function checkCacheHealth(): Promise<void> {
  await redis.ping();
}
