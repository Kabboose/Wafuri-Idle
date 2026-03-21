import type { Player, Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";

async function lockPlayerRow(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "players" WHERE id = ${playerId}::uuid FOR UPDATE`;
}

export async function createPlayer(data: Prisma.PlayerCreateInput): Promise<Player> {
  return prisma.player.create({ data });
}

export async function updatePlayerWithLock(
  playerId: string,
  buildUpdate: (player: Player) => Prisma.PlayerUpdateInput
): Promise<Player> {
  return prisma.$transaction(async (tx) => {
    await lockPlayerRow(tx, playerId);

    const player = await tx.player.findUnique({
      where: { id: playerId }
    });

    if (!player) {
      throw new Error("Player not found");
    }

    return tx.player.update({
      where: { id: playerId },
      data: buildUpdate(player)
    });
  });
}

