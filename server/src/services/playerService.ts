import { updatePlayerWithLock } from "../db/playerRepository.js";
import { getCachedPlayerState, invalidateCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import type { SerializedPlayerState } from "../utils/playerTypes.js";
import { buildIdleProgressUpdate, buildUpgradeUpdate, serializePlayer } from "../utils/gameMath.js";

export async function getPlayerState(playerId: string): Promise<SerializedPlayerState> {
  await getCachedPlayerState(playerId);

  const player = await updatePlayerWithLock(playerId, (currentPlayer) => buildIdleProgressUpdate(currentPlayer, new Date()));

  const serializedPlayer = serializePlayer(player);
  await setCachedPlayerState(playerId, serializedPlayer);

  return serializedPlayer;
}

export async function upgradePlayer(playerId: string): Promise<SerializedPlayerState> {
  const player = await updatePlayerWithLock(playerId, (currentPlayer) => buildUpgradeUpdate(currentPlayer, new Date()));

  const serializedPlayer = serializePlayer(player);
  await invalidateCachedPlayerState(playerId);
  await setCachedPlayerState(playerId, serializedPlayer);

  return serializedPlayer;
}
