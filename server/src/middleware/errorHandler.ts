import type { ErrorRequestHandler } from "express";

import { logger } from "../utils/logger.js";

/** Logs unhandled request errors and returns the standard API error envelope. */
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const message = error instanceof Error ? error.message : "Internal server error";

  logger.error({
    method: request.method,
    path: request.originalUrl,
    error
  }, "request failed");

  response.status(500).json({
    success: false,
    error: message
  });
};
