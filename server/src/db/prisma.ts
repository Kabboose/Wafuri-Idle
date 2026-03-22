import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { config } from "../config/index.js";
import { PrismaClient } from "../generated/prisma/client.js";

const pool = new Pool({
  connectionString: config.databaseUrl
});

const adapter = new PrismaPg(pool);

/** Shared Prisma client instance for all database access in the server process. */
export const prisma = new PrismaClient({
  adapter
});
