import { getPlayerById, updatePlayerOptimistically } from "../db/playerRepository.js";
import { getCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import { progressPlayer, upgradePlayer as applyPlayerUpgrade } from "./idle.service.js";
import { stringifyFixed } from "../utils/fixedPoint.js";
import type { PlayerState, SerializedPlayerState } from "../utils/playerTypes.js";

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

export async function getPlayerState(playerId: string): Promise<SerializedPlayerState> {
  const now = Date.now();
  let cachedPlayer = await getCachedPlayerState(playerId);

  if (!cachedPlayer) {
    cachedPlayer = await getPlayerById(playerId);
    await setCachedPlayerState(playerId, cachedPlayer);
  }

  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) =>
    progressPlayer(currentPlayer, now)
  );
  const serialized = serializePlayer(player);

  await setCachedPlayerState(playerId, player);

  return serialized;
}

export async function upgradePlayer(playerId: string): Promise<SerializedPlayerState> {
  const now = Date.now();
  const cachedPlayer = await getCachedPlayerState(playerId);
  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) => {
    const progressedPlayer = progressPlayer(currentPlayer, now);

    return applyPlayerUpgrade(progressedPlayer);
  });
  const serialized = serializePlayer(player);

  await setCachedPlayerState(playerId, player);

  return serialized;
}
