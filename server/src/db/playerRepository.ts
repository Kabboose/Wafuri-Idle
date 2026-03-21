import type { Player, Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";

export async function createPlayer(data: Prisma.PlayerCreateInput): Promise<Player> {
  return prisma.player.create({ data });
}

function mapPlayerRecord(player: Player): PlayerState {
  return {
    id: player.id,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    version: player.version,
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

async function findPlayerById(playerId: string): Promise<Player> {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    throw new Error("Player not found");
  }

  return player;
}

export async function updatePlayerWithLock(
  playerId: string,
  buildUpdate: (player: PlayerState) => PlayerMutation
): Promise<PlayerState> {
  let attempts = 0;

  while (attempts < 2) {
    const player = await findPlayerById(playerId);
    const currentState = mapPlayerRecord(player);
    const mutation = buildUpdate(currentState);
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
      return {
        ...currentState,
        ...mutation,
        version: currentState.version + 1,
        updatedAt: Date.now()
      };
    }

    attempts += 1;
  }

  throw new Error("Concurrent player update conflict");
}
