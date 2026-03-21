import pino from "pino";

/** Shared structured logger used by middleware, controllers, and server bootstrap. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});
