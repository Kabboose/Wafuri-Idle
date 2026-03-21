import type { RequestHandler } from "express";
import { getPlayerState, upgradePlayer } from "../services/player.service.js";
import { logger } from "../utils/logger.js";

export const getPlayerStateController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerState = await getPlayerState(request.user!.playerId);

    logger.info({ playerId: request.user!.playerId }, "state fetched");
    response.json(playerState);
  } catch (error) {
    next(error);
  }
};

export const upgradePlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerState = await upgradePlayer(request.user!.playerId);

    logger.info({ playerId: request.user!.playerId }, "player upgraded");
    response.json(playerState);
  } catch (error) {
    next(error);
  }
};

export const tickPlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerState = await getPlayerState(request.user!.playerId);

    logger.info({ playerId: request.user!.playerId }, "tick processed");
    response.json(playerState);
  } catch (error) {
    next(error);
  }
};
