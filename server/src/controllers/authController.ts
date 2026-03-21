import type { RequestHandler } from "express";

import { createGuestSession } from "../services/authService.js";

export const createGuestSessionController: RequestHandler = async (_request, response, next): Promise<void> => {
  try {
    response.json({
      success: true,
      data: await createGuestSession()
    });
  } catch (error) {
    next(error);
  }
};
