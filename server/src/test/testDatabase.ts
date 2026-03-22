import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

const execFileAsync = promisify(execFile);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Returns the configured dedicated test database URL or throws when missing.
 */
export function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? deriveTestDatabaseUrl(process.env.DATABASE_URL);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is required for server integration tests");
  }

  return databaseUrl;
}

function deriveTestDatabaseUrl(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) {
    return null;
  }

  const parsedUrl = new URL(databaseUrl);
  const databaseName = parsedUrl.pathname.replace(/^\//, "");

  if (!databaseName) {
    return null;
  }

  parsedUrl.pathname = `/${databaseName}_test`;
  return parsedUrl.toString();
}

function createAdminDatabaseUrl(databaseUrl: string): string {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  return adminUrl.toString();
}

function getDatabaseName(databaseUrl: string): string {
  const parsedUrl = new URL(databaseUrl);
  return decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
}

/**
 * Creates the dedicated test database when it does not already exist.
 */
export async function ensureTestDatabaseExists(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const databaseName = getDatabaseName(databaseUrl);
  const adminPool = new Pool({
    connectionString: createAdminDatabaseUrl(databaseUrl)
  });

  try {
    const existingDatabase = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    );

    if (existingDatabase.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${databaseName.replaceAll("\"", "\"\"")}"`);
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * Applies the checked-in Prisma migrations to the dedicated test database.
 */
export async function applyTestDatabaseMigrations(): Promise<void> {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  await execFileAsync(
    npxCommand,
    ["prisma", "migrate", "deploy"],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        DATABASE_URL: getTestDatabaseUrl()
      }
    }
  );
}

/**
 * Deletes all application data from the dedicated test database.
 */
export async function wipeTestDatabase(): Promise<void> {
  const pool = new Pool({
    connectionString: getTestDatabaseUrl()
  });

  try {
    await pool.query(`
      TRUNCATE TABLE
        sessions,
        password_reset_tokens,
        players,
        accounts
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await pool.end();
  }
}
