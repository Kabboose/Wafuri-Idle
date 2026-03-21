import { Router } from "express";

import { createGuestSessionController } from "../controllers/authController.js";

/** Auth routes expose login/session creation endpoints only. */
const authRoutes = Router();

authRoutes.post("/guest", createGuestSessionController);

export { authRoutes };
