import { Router } from "express";

import { createGuestSession } from "../services/authService.js";

const authRoutes = Router();

authRoutes.post("/guest", async (_request, response, next) => {
  try {
    response.json(await createGuestSession());
  } catch (error) {
    next(error);
  }
});

export { authRoutes };

