import { prisma } from "./prisma.js";
import type { CreatePlayerInput, PlayerRecord } from "../utils/identityTypes.js";

function mapPlayerRecord(player: {
  id: string;
  accountId: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  version: number;
  lastUpdateTimestampMs: Date;
  createdAt: Date;
  updatedAt: Date;
}): PlayerRecord {
  return {
    id: player.id,
    accountId: player.accountId,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    version: player.version,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs.toISOString(),
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString()
  };
}

/**
 * Creates a player row linked to an account.
 * Expects caller-provided progression values and timestamp.
 */
export async function createPlayer(input: CreatePlayerInput): Promise<PlayerRecord> {
  const player = await prisma.player.create({
    data: {
      accountId: input.accountId,
      mana: input.mana,
      manaGenerationRate: input.manaGenerationRate,
      teamPower: input.teamPower,
      version: input.version ?? 0,
      lastUpdateTimestampMs: input.lastUpdateTimestampMs
    }
  });

  return mapPlayerRecord(player);
}

/** Finds a player row by its primary key. */
export async function findPlayerById(playerId: string): Promise<PlayerRecord | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  return player ? mapPlayerRecord(player) : null;
}

/** Finds a player row by its linked account id. */
export async function findPlayerByAccountId(accountId: string): Promise<PlayerRecord | null> {
  const player = await prisma.player.findUnique({
    where: { accountId }
  });

  return player ? mapPlayerRecord(player) : null;
}
