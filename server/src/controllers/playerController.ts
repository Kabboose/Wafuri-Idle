import type { RequestHandler } from "express";
import { getPlayerState, upgradePlayer } from "../services/player.service.js";
import { logger } from "../utils/logger.js";

export const getPlayerStateController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerId = request.user?.playerId;

    if (!playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await getPlayerState(playerId);

    logger.info(
      {
        playerId,
        mana: playerState.mana,
        manaGenerationRate: playerState.manaGenerationRate,
        teamPower: playerState.teamPower
      },
      "state fetched"
    );
    response.json({
      success: true,
      data: playerState
    });
  } catch (error) {
    next(error);
  }
};

export const upgradePlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerId = request.user?.playerId;

    if (!playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await upgradePlayer(playerId);

    logger.info(
      {
        playerId,
        mana: playerState.mana,
        manaGenerationRate: playerState.manaGenerationRate,
        teamPower: playerState.teamPower
      },
      "player upgraded"
    );
    response.json({
      success: true,
      data: playerState
    });
  } catch (error) {
    next(error);
  }
};

export const tickPlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerId = request.user?.playerId;

    if (!playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await getPlayerState(playerId);

    logger.info(
      {
        playerId,
        mana: playerState.mana,
        manaGenerationRate: playerState.manaGenerationRate,
        teamPower: playerState.teamPower
      },
      "tick processed"
    );
    response.json({
      success: true,
      data: playerState
    });
  } catch (error) {
    next(error);
  }
};
