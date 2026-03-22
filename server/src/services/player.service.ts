import { getPlayerById, updatePlayerOptimistically } from "../db/playerRepository.js";
import { findAccountById } from "../db/accountRepo.js";
import { getCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import { progressPlayer, upgradePlayer as applyPlayerUpgrade } from "./idle.service.js";
import { stringifyFixed } from "../utils/fixedPoint.js";
import type { PlayerState, SerializedPlayerState } from "../utils/playerTypes.js";

/** Converts the internal bigint-based state into the API response shape. */
function serializePlayer(player: PlayerState, accountType: "GUEST" | "REGISTERED"): SerializedPlayerState {
  return {
    id: player.id,
    accountType,
    mana: stringifyFixed(player.mana),
    manaGenerationRate: stringifyFixed(player.manaGenerationRate),
    teamPower: player.teamPower,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs,
    createdAt: new Date(player.createdAt).toISOString(),
    updatedAt: new Date(player.updatedAt).toISOString()
  };
}

/** Loads the authenticated account type needed for player-facing auth-aware UI state. */
async function getAccountType(accountId: string): Promise<"GUEST" | "REGISTERED"> {
  const account = await findAccountById(accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  return account.type;
}

/**
 * Loads, progresses, persists, and returns the latest state for a player.
 * Accepts the request's captured time so progression stays deterministic for the request.
 */
export async function getPlayerState(accountId: string, playerId: string, now: number): Promise<SerializedPlayerState> {
  let cachedPlayer = await getCachedPlayerState(playerId);

  if (!cachedPlayer) {
    cachedPlayer = await getPlayerById(playerId);
    await setCachedPlayerState(playerId, cachedPlayer);
  }

  // The repository handles optimistic retries if the cached snapshot is stale.
  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) =>
    progressPlayer(currentPlayer, now)
  );
  const serialized = serializePlayer(player, await getAccountType(accountId));

  await setCachedPlayerState(playerId, player);

  return serialized;
}

/**
 * Loads, progresses, upgrades, persists, and returns the latest state for a player.
 * Accepts the request's captured time so progression stays deterministic for the request.
 */
export async function upgradePlayer(
  accountId: string,
  playerId: string,
  now: number
): Promise<SerializedPlayerState> {
  const cachedPlayer = await getCachedPlayerState(playerId);
  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) => {
    const progressedPlayer = progressPlayer(currentPlayer, now);

    return applyPlayerUpgrade(progressedPlayer);
  });
  const serialized = serializePlayer(player, await getAccountType(accountId));

  await setCachedPlayerState(playerId, player);

  return serialized;
}
