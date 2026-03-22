import rateLimit from "express-rate-limit";

const errorResponse = {
  success: false,
  error: "Too many requests"
};

/** Rate limit for upgrade requests, which mutate player progression. */
export const upgradeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse
});

/** Rate limit for tick requests, which can be spammed by aggressive polling. */
export const tickRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse
});

/** Rate limit for run requests, which trigger a full gameplay mutation flow. */
export const runRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse
});
