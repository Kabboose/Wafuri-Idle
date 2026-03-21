import { Redis } from "ioredis";

import { config } from "../config/index.js";

/** Shared Redis client instance for cache access in the server process. */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1
});
