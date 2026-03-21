import type { Player, Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { getCachedPlayerState, invalidateCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import type { SerializedPlayerState } from "../types.js";

const TEAM_POWER_BONUS_PER_POINT = 0.02;
const TEAM_POWER_UPGRADE_GAIN = 1;
const MANA_RATE_UPGRADE_GAIN = 0.5;

function getEffectiveManaRate(player: Pick<Player, "manaGenerationRate" | "teamPower">): number {
  return player.manaGenerationRate * (1 + player.teamPower * TEAM_POWER_BONUS_PER_POINT);
}

function serializePlayer(player: Player): SerializedPlayerState {
  return {
    id: player.id,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: player.lastUpdateTimestamp.getTime(),
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString()
  };
}

function applyIdleValues(player: Player, now: Date): Prisma.PlayerUpdateInput {
  const elapsedMilliseconds = Math.max(now.getTime() - player.lastUpdateTimestamp.getTime(), 0);
  const elapsedSeconds = elapsedMilliseconds / 1000;
  const manaGain = elapsedSeconds * getEffectiveManaRate(player);

  return {
    mana: player.mana + manaGain,
    lastUpdateTimestamp: now
  };
}

async function lockAndLoadPlayer(tx: Prisma.TransactionClient, playerId: string): Promise<Player> {
  await tx.$queryRaw`SELECT id FROM "players" WHERE id = ${playerId}::uuid FOR UPDATE`;

  const player = await tx.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    throw new Error("Player not found");
  }

  return player;
}

export async function getPlayerState(playerId: string): Promise<SerializedPlayerState> {
  await getCachedPlayerState(playerId);

  const now = new Date();
  const player = await prisma.$transaction(async (tx) => {
    const currentPlayer = await lockAndLoadPlayer(tx, playerId);

    return tx.player.update({
      where: { id: playerId },
      data: applyIdleValues(currentPlayer, now)
    });
  });

  const serializedPlayer = serializePlayer(player);
  await setCachedPlayerState(playerId, serializedPlayer);

  return serializedPlayer;
}

export async function upgradePlayer(playerId: string): Promise<SerializedPlayerState> {
  const now = new Date();
  const player = await prisma.$transaction(async (tx) => {
    const currentPlayer = await lockAndLoadPlayer(tx, playerId);

    return tx.player.update({
      where: { id: playerId },
      data: {
        ...applyIdleValues(currentPlayer, now),
        teamPower: currentPlayer.teamPower + TEAM_POWER_UPGRADE_GAIN,
        manaGenerationRate: currentPlayer.manaGenerationRate + MANA_RATE_UPGRADE_GAIN
      }
    });
  });

  const serializedPlayer = serializePlayer(player);
  await invalidateCachedPlayerState(playerId);
  await setCachedPlayerState(playerId, serializedPlayer);

  return serializedPlayer;
}
