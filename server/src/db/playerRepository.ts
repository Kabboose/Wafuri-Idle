import type { Player, Prisma } from "../generated/prisma/client.js";

import { prisma } from "./prisma.js";
import { parseFixed, stringifyFixed } from "../utils/fixedPoint.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";

/** Converts the Prisma player record into the internal bigint-based domain shape. */
function mapPlayerRecord(player: Player): PlayerState {
  return {
    id: player.id,
    energy: parseFixed(player.energy),
    maxEnergy: parseFixed(player.maxEnergy),
    currency: parseFixed(player.currency),
    progression: parseFixed(player.progression),
    energyPerSecond: parseFixed(player.energyPerSecond),
    teamPower: player.teamPower,
    version: player.version,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs.getTime(),
    createdAt: player.createdAt.getTime(),
    updatedAt: player.updatedAt.getTime()
  };
}

/** Converts a domain mutation into the Prisma update payload for persistence. */
function mapMutationToUpdate(mutation: PlayerMutation): Prisma.PlayerUpdateInput {
  return {
    energy: stringifyFixed(mutation.energy),
    maxEnergy: stringifyFixed(mutation.maxEnergy),
    currency: stringifyFixed(mutation.currency),
    progression: stringifyFixed(mutation.progression),
    energyPerSecond: stringifyFixed(mutation.energyPerSecond),
    teamPower: mutation.teamPower,
    lastUpdateTimestampMs: new Date(mutation.lastUpdateTimestampMs)
  };
}

/** Loads a player row directly from Postgres and throws when it does not exist. */
async function findPlayerRecordById(playerId: string): Promise<Player> {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    throw new Error("Player not found");
  }

  return player;
}

/** Returns the current source-of-truth player state from Postgres. */
export async function getPlayerById(playerId: string): Promise<PlayerState> {
  return mapPlayerRecord(await findPlayerRecordById(playerId));
}

/**
 * Applies an optimistic-lock update using the player's current version.
 * Accepts cached state as an optional first attempt, then falls back to fresh DB state on conflict.
 */
export async function updatePlayerOptimistically(
  playerId: string,
  initialPlayerState: PlayerState | null,
  buildUpdate: (player: PlayerState) => PlayerMutation
): Promise<PlayerState> {
  let attempts = 0;
  let currentState = initialPlayerState;

  while (attempts < 2) {
    if (!currentState) {
      currentState = await getPlayerById(playerId);
    }

    const mutation = buildUpdate(currentState);
    // The version check prevents stale cached state from blindly overwriting newer DB state.
    const updateResult = await prisma.player.updateMany({
      where: {
        id: playerId,
        version: currentState.version
      },
      data: {
        ...mapMutationToUpdate(mutation),
        version: {
          increment: 1
        }
      }
    });

    if (updateResult.count === 1) {
      return getPlayerById(playerId);
    }

    attempts += 1;
    currentState = null;
  }

  throw new Error("Concurrent player update conflict");
}
