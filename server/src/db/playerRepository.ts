import type { Player, Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";

async function lockPlayerRow(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "players" WHERE id = ${playerId}::uuid FOR UPDATE`;
}

export async function createPlayer(data: Prisma.PlayerCreateInput): Promise<Player> {
  return prisma.player.create({ data });
}

function mapPlayerRecord(player: Player): PlayerState {
  return {
    id: player.id,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: player.lastUpdateTimestamp.getTime(),
    createdAt: player.createdAt.getTime(),
    updatedAt: player.updatedAt.getTime()
  };
}

function mapMutationToUpdate(mutation: PlayerMutation): Prisma.PlayerUpdateInput {
  return {
    mana: mutation.mana,
    manaGenerationRate: mutation.manaGenerationRate,
    teamPower: mutation.teamPower,
    lastUpdateTimestamp: new Date(mutation.lastUpdateTimestamp)
  };
}

export async function updatePlayerWithLock(
  playerId: string,
  buildUpdate: (player: PlayerState) => PlayerMutation
): Promise<PlayerState> {
  return prisma.$transaction(async (tx) => {
    await lockPlayerRow(tx, playerId);

    const player = await tx.player.findUnique({
      where: { id: playerId }
    });

    if (!player) {
      throw new Error("Player not found");
    }

    const updated = await tx.player.update({
      where: { id: playerId },
      data: mapMutationToUpdate(buildUpdate(mapPlayerRecord(player)))
    });

    return mapPlayerRecord(updated);
  });
}
