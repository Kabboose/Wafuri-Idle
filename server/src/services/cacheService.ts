import type { SerializedPlayerState } from "../utils/playerTypes.js";
import { redis } from "../db/redis.js";

const PLAYER_CACHE_PREFIX = "player-state";
const PLAYER_CACHE_TTL_SECONDS = 60;

function getPlayerCacheKey(playerId: string): string {
  return `${PLAYER_CACHE_PREFIX}:${playerId}`;
}

export async function getCachedPlayerState(playerId: string): Promise<SerializedPlayerState | null> {
  const cachedState = await redis.get(getPlayerCacheKey(playerId));

  return cachedState ? (JSON.parse(cachedState) as SerializedPlayerState) : null;
}

export async function setCachedPlayerState(playerId: string, state: SerializedPlayerState): Promise<void> {
  await redis.set(getPlayerCacheKey(playerId), JSON.stringify(state), "EX", PLAYER_CACHE_TTL_SECONDS);
}

export async function invalidateCachedPlayerState(playerId: string): Promise<void> {
  await redis.del(getPlayerCacheKey(playerId));
}
