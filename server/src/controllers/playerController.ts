import type { RequestHandler } from "express";
import { getPlayerState, upgradePlayer } from "../services/player.service.js";
import { logger } from "../utils/logger.js";

/** Loads and returns the latest player state for the authenticated player. */
export const getPlayerStateController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = Date.now();
    const accountId = request.user?.accountId;
    const playerId = request.user?.playerId;

    if (!accountId || !playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await getPlayerState(accountId, playerId, now);

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

/** Applies idle progress plus an upgrade mutation for the authenticated player. */
export const upgradePlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = Date.now();
    const accountId = request.user?.accountId;
    const playerId = request.user?.playerId;

    if (!accountId || !playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await upgradePlayer(accountId, playerId, now);

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

/** Advances the authenticated player's state without applying any extra action. */
export const tickPlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = Date.now();
    const accountId = request.user?.accountId;
    const playerId = request.user?.playerId;

    if (!accountId || !playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const playerState = await getPlayerState(accountId, playerId, now);

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
