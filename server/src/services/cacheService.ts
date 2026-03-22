import type { PlayerState } from "../utils/playerTypes.js";
import { redis } from "../db/redis.js";
import { parseFixed, stringifyFixed } from "../utils/fixedPoint.js";

const PLAYER_CACHE_PREFIX = "player";
const PLAYER_CACHE_TTL_SECONDS = 60;

type CachedPlayerState = {
  id: string;
  energy: string;
  energyPerSecond: string;
  teamPower: number;
  version: number;
  lastUpdateTimestampMs: number;
  createdAt: number;
  updatedAt: number;
};

/** Builds the Redis cache key for a specific player state entry. */
function getPlayerCacheKey(playerId: string): string {
  return `${PLAYER_CACHE_PREFIX}:${playerId}`;
}

/** Converts an internal bigint-based player snapshot into a Redis-safe JSON shape. */
function serializeCachedPlayerState(state: PlayerState): CachedPlayerState {
  return {
    ...state,
    energy: stringifyFixed(state.energy),
    energyPerSecond: stringifyFixed(state.energyPerSecond)
  };
}

/** Converts a Redis JSON snapshot back into the internal bigint-based player state shape. */
function deserializeCachedPlayerState(state: CachedPlayerState): PlayerState {
  return {
    ...state,
    energy: parseFixed(state.energy),
    energyPerSecond: parseFixed(state.energyPerSecond)
  };
}

/** Loads a cached player snapshot from Redis when present. */
export async function getCachedPlayerState(playerId: string): Promise<PlayerState | null> {
  const cachedState = await redis.get(getPlayerCacheKey(playerId));

  return cachedState ? deserializeCachedPlayerState(JSON.parse(cachedState) as CachedPlayerState) : null;
}

/** Stores the latest player snapshot in Redis after a successful DB-backed read or write. */
export async function setCachedPlayerState(playerId: string, state: PlayerState): Promise<void> {
  await redis.set(
    getPlayerCacheKey(playerId),
    JSON.stringify(serializeCachedPlayerState(state)),
    "EX",
    PLAYER_CACHE_TTL_SECONDS
  );
}

/** Removes a cached player snapshot. Retained for flows that need explicit eviction. */
export async function invalidateCachedPlayerState(playerId: string): Promise<void> {
  await redis.del(getPlayerCacheKey(playerId));
}
