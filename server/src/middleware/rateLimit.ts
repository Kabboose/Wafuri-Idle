import rateLimit from "express-rate-limit";

const errorResponse = {
  success: false,
  error: "Too many requests"
};

export const upgradeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse
});

export const tickRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse
});

