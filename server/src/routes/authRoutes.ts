import { Router } from "express";

import {
  createGuestSessionController,
  loginController,
  refreshSessionController,
  requestPasswordResetController,
  resetPasswordController,
  upgradeAccountController
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

/** Auth routes expose login/session creation endpoints only. */
const authRoutes = Router();

authRoutes.post("/guest", createGuestSessionController);
authRoutes.post("/login", loginController);
authRoutes.post("/refresh", refreshSessionController);
authRoutes.post("/request-password-reset", requestPasswordResetController);
authRoutes.post("/reset-password", resetPasswordController);
authRoutes.post("/upgrade", requireAuth, upgradeAccountController);

export { authRoutes };
