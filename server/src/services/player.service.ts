import { updatePlayerWithLock } from "../db/playerRepository.js";
import { getCachedPlayerState, invalidateCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import { applyUpgrade, calculateIdleProgress } from "./idle.service.js";
import type { PlayerState, SerializedPlayerState } from "../utils/playerTypes.js";

function serializePlayer(player: PlayerState): SerializedPlayerState {
  return {
    id: player.id,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: player.lastUpdateTimestamp,
    createdAt: new Date(player.createdAt).toISOString(),
    updatedAt: new Date(player.updatedAt).toISOString()
  };
}

export async function getPlayerState(playerId: string): Promise<SerializedPlayerState> {
  await getCachedPlayerState(playerId);

  const player = await updatePlayerWithLock(playerId, (currentPlayer) => calculateIdleProgress(currentPlayer, Date.now()));
  const serialized = serializePlayer(player);

  await setCachedPlayerState(playerId, serialized);

  return serialized;
}

export async function upgradePlayer(playerId: string): Promise<SerializedPlayerState> {
  const player = await updatePlayerWithLock(playerId, (currentPlayer) => applyUpgrade(currentPlayer, Date.now()));
  const serialized = serializePlayer(player);

  await invalidateCachedPlayerState(playerId);
  await setCachedPlayerState(playerId, serialized);

  return serialized;
}
