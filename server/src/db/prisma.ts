import { PrismaClient } from "@prisma/client";

/** Shared Prisma client instance for all database access in the server process. */
export const prisma = new PrismaClient();
