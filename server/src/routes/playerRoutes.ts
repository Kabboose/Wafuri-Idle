import { Router } from "express";

import { getPlayerStateController, upgradePlayerController } from "../controllers/playerController.js";
import { requireAuth } from "../middleware/auth.js";

const playerRoutes = Router();

playerRoutes.use(requireAuth);

playerRoutes.get("/state", getPlayerStateController);
playerRoutes.post("/upgrade", upgradePlayerController);

export { playerRoutes };
