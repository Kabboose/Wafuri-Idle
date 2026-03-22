import "dotenv/config";

import {
  applyTestDatabaseMigrations,
  ensureTestDatabaseExists,
  getTestDatabaseUrl,
  wipeTestDatabase
} from "./testDatabase.js";

/**
 * Prepares the dedicated integration-test database before the auth test suite runs.
 */
export async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = getTestDatabaseUrl();

  await ensureTestDatabaseExists();
  await applyTestDatabaseMigrations();
  await wipeTestDatabase();
}

/**
 * Cleans the dedicated integration-test database after the auth test suite completes.
 */
export async function globalTeardown(): Promise<void> {
  process.env.DATABASE_URL = getTestDatabaseUrl();
  await wipeTestDatabase();
}
