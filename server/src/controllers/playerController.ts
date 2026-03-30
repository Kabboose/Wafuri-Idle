import type { RequestHandler } from "express";
import { getPlayerState, upgradePlayer } from "../services/player.service.js";
import { runPlayerAction } from "../services/runAction.service.js";
import type { TeamConfig } from "../utils/runTypes.js";
import { logger } from "../utils/logger.js";

/** Validates and extracts the team config payload for a run request. */
function parseTeamConfig(body: unknown): TeamConfig {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid run request");
  }

  const { speed, critChance, runDurationMs } = body as Record<string, unknown>;

  if (typeof speed !== "number" || typeof critChance !== "number") {
    throw new Error("Invalid run request");
  }

  if (!Number.isFinite(speed) || !Number.isFinite(critChance)) {
    throw new Error("Invalid run request");
  }

  if (runDurationMs !== undefined && (typeof runDurationMs !== "number" || !Number.isFinite(runDurationMs))) {
    throw new Error("Invalid run request");
  }

  return {
    speed,
    critChance,
    ...(runDurationMs !== undefined ? { runDurationMs } : {})
  };
}

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
        energy: playerState.energy,
        maxEnergy: playerState.maxEnergy,
        energyPerSecond: playerState.energyPerSecond,
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
        energy: playerState.energy,
        maxEnergy: playerState.maxEnergy,
        energyPerSecond: playerState.energyPerSecond,
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
        energy: playerState.energy,
        maxEnergy: playerState.maxEnergy,
        energyPerSecond: playerState.energyPerSecond,
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

/** Executes the authenticated player's full run lifecycle for the provided team config. */
export const runPlayerController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = Date.now();
    const accountId = request.user?.accountId;
    const playerId = request.user?.playerId;

    if (!accountId || !playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const teamConfig = parseTeamConfig(request.body);
    const runActionResult = await runPlayerAction(accountId, teamConfig, now);

    logger.info(
      {
        playerId,
        energy: runActionResult.player.energy,
        currency: runActionResult.player.currency,
        progression: runActionResult.player.progression,
        comboCount: runActionResult.runResult.comboCount,
        totalDamage: runActionResult.runResult.totalDamage
      },
      "run processed"
    );
    response.json({
      success: true,
      data: runActionResult
    });
  } catch (error) {
    next(error);
  }
};
