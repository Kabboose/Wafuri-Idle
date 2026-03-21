import { checkCacheHealth, checkDatabaseHealth } from "../db/healthRepo.js";

export type HealthStatus = {
  status: "ok";
};

/**
 * Verifies the application's backing services and returns the public health payload.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  await checkDatabaseHealth();
  await checkCacheHealth();

  return {
    status: "ok"
  };
}
