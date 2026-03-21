import { Router } from "express";

import { createGuestSessionController } from "../controllers/authController.js";

const authRoutes = Router();

authRoutes.post("/guest", createGuestSessionController);

export { authRoutes };
