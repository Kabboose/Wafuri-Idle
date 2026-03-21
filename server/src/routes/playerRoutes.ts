import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getPlayerState, upgradePlayer } from "../services/playerService.js";

const playerRoutes = Router();

playerRoutes.use(requireAuth);

playerRoutes.get("/state", async (request: AuthenticatedRequest, response, next) => {
  try {
    response.json(await getPlayerState(request.playerId!));
  } catch (error) {
    next(error);
  }
});

playerRoutes.post("/upgrade", async (request: AuthenticatedRequest, response, next) => {
  try {
    response.json(await upgradePlayer(request.playerId!));
  } catch (error) {
    next(error);
  }
});

export { playerRoutes };

