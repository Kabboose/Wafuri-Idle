import { Router } from "express";

import { getPlayerStateController, tickPlayerController, upgradePlayerController } from "../controllers/playerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tickRateLimiter, upgradeRateLimiter } from "../middleware/rateLimit.js";

/** Player routes define authenticated state and progression endpoints only. */
const playerRoutes = Router();

playerRoutes.use(requireAuth);

playerRoutes.get("/state", getPlayerStateController);
playerRoutes.post("/tick", tickRateLimiter, tickPlayerController);
playerRoutes.post("/upgrade", upgradeRateLimiter, upgradePlayerController);

export { playerRoutes };
