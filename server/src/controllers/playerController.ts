import type { RequestHandler } from "express";
import { getPlayerState, upgradePlayer } from "../services/playerService.js";

export const getPlayerStateController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    response.json(await getPlayerState(request.user!.playerId));
  } catch (error) {
    next(error);
  }
};

export const upgradePlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    response.json(await upgradePlayer(request.user!.playerId));
  } catch (error) {
    next(error);
  }
};
