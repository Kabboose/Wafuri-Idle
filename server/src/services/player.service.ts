import { getPlayerById, updatePlayerOptimistically } from "../db/playerRepository.js";
import { getCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import { progressPlayer, upgradePlayer as applyPlayerUpgrade } from "./idle.service.js";
import { stringifyFixed } from "../utils/fixedPoint.js";
import type { PlayerState, SerializedPlayerState } from "../utils/playerTypes.js";

/** Converts the internal bigint-based state into the API response shape. */
function serializePlayer(player: PlayerState): SerializedPlayerState {
  return {
    id: player.id,
    mana: stringifyFixed(player.mana),
    manaGenerationRate: stringifyFixed(player.manaGenerationRate),
    teamPower: player.teamPower,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs,
    createdAt: new Date(player.createdAt).toISOString(),
    updatedAt: new Date(player.updatedAt).toISOString()
  };
}

/**
 * Loads, progresses, persists, and returns the latest state for a player.
 * Accepts the request's captured time so progression stays deterministic for the request.
 */
export async function getPlayerState(playerId: string, now: number): Promise<SerializedPlayerState> {
  let cachedPlayer = await getCachedPlayerState(playerId);

  if (!cachedPlayer) {
    cachedPlayer = await getPlayerById(playerId);
    await setCachedPlayerState(playerId, cachedPlayer);
  }

  // The repository handles optimistic retries if the cached snapshot is stale.
  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) =>
    progressPlayer(currentPlayer, now)
  );
  const serialized = serializePlayer(player);

  await setCachedPlayerState(playerId, player);

  return serialized;
}

/**
 * Loads, progresses, upgrades, persists, and returns the latest state for a player.
 * Accepts the request's captured time so progression stays deterministic for the request.
 */
export async function upgradePlayer(playerId: string, now: number): Promise<SerializedPlayerState> {
  const cachedPlayer = await getCachedPlayerState(playerId);
  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) => {
    const progressedPlayer = progressPlayer(currentPlayer, now);

    return applyPlayerUpgrade(progressedPlayer);
  });
  const serialized = serializePlayer(player);

  await setCachedPlayerState(playerId, player);

  return serialized;
}
