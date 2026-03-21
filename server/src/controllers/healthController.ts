import type { RequestHandler } from "express";

import { getHealthStatus } from "../services/healthService.js";

/**
 * Returns the current application health status using the standard API envelope.
 */
export const getHealthController: RequestHandler = async (_request, response, next): Promise<void> => {
  try {
    response.json({
      success: true,
      data: await getHealthStatus()
    });
  } catch (error) {
    next(error);
  }
};
