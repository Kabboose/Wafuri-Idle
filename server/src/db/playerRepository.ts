import type { Player, Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import { parseFixed, stringifyFixed } from "../utils/fixedPoint.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";

export async function createPlayer(data: Prisma.PlayerCreateInput): Promise<Player> {
  return prisma.player.create({ data });
}

function mapPlayerRecord(player: Player): PlayerState {
  return {
    id: player.id,
    mana: parseFixed(player.mana),
    manaGenerationRate: parseFixed(player.manaGenerationRate),
    teamPower: player.teamPower,
    version: player.version,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs.getTime(),
    createdAt: player.createdAt.getTime(),
    updatedAt: player.updatedAt.getTime()
  };
}

function mapMutationToUpdate(mutation: PlayerMutation): Prisma.PlayerUpdateInput {
  return {
    mana: stringifyFixed(mutation.mana),
    manaGenerationRate: stringifyFixed(mutation.manaGenerationRate),
    teamPower: mutation.teamPower,
    lastUpdateTimestampMs: new Date(mutation.lastUpdateTimestampMs)
  };
}

async function findPlayerRecordById(playerId: string): Promise<Player> {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    throw new Error("Player not found");
  }

  return player;
}

export async function getPlayerById(playerId: string): Promise<PlayerState> {
  return mapPlayerRecord(await findPlayerRecordById(playerId));
}

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
    currentState = null;
  }

  throw new Error("Concurrent player update conflict");
}
