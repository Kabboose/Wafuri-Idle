import type { PlayerState } from "../utils/playerTypes.js";
import { redis } from "../db/redis.js";

const PLAYER_CACHE_PREFIX = "player";
const PLAYER_CACHE_TTL_SECONDS = 60;

/** Builds the Redis cache key for a specific player state entry. */
function getPlayerCacheKey(playerId: string): string {
  return `${PLAYER_CACHE_PREFIX}:${playerId}`;
}

/** Loads a cached player snapshot from Redis when present. */
export async function getCachedPlayerState(playerId: string): Promise<PlayerState | null> {
  const cachedState = await redis.get(getPlayerCacheKey(playerId));

  return cachedState ? (JSON.parse(cachedState) as PlayerState) : null;
}

/** Stores the latest player snapshot in Redis after a successful DB-backed read or write. */
export async function setCachedPlayerState(playerId: string, state: PlayerState): Promise<void> {
  await redis.set(getPlayerCacheKey(playerId), JSON.stringify(state), "EX", PLAYER_CACHE_TTL_SECONDS);
}

/** Removes a cached player snapshot. Retained for flows that need explicit eviction. */
export async function invalidateCachedPlayerState(playerId: string): Promise<void> {
  await redis.del(getPlayerCacheKey(playerId));
}
