import { prisma } from "./prisma.js";
import type { AccountRecord, CreateAccountInput, CreatePlayerInput, PlayerRecord } from "../utils/identityTypes.js";

/**
 * Maps a Prisma account row into the shared identity record shape.
 * Converts timestamps to ISO strings for service-layer consumption.
 */
function mapAccountRecord(account: {
  id: string;
  type: "GUEST" | "REGISTERED";
  username: string | null;
  usernameNormalized: string | null;
  email: string | null;
  emailNormalized: string | null;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AccountRecord {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    usernameNormalized: account.usernameNormalized,
    email: account.email,
    emailNormalized: account.emailNormalized,
    passwordHash: account.passwordHash,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

/**
 * Maps a Prisma player row into the shared player record shape.
 * Converts timestamps to ISO strings for service-layer consumption.
 */
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

export type CreateGuestAccountIdentityInput = {
  account: CreateAccountInput;
  player: Omit<CreatePlayerInput, "accountId">;
};

export type CreateGuestAccountIdentityResult = {
  account: AccountRecord;
  player: PlayerRecord;
};

/**
 * Creates a guest account and linked player row atomically.
 * Expects the caller to provide all balance values and the authoritative timestamp.
 */
export async function createGuestAccountIdentity(
  input: CreateGuestAccountIdentityInput
): Promise<CreateGuestAccountIdentityResult> {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        type: input.account.type ?? "GUEST",
        username: input.account.username ?? null,
        usernameNormalized: input.account.usernameNormalized ?? null,
        email: input.account.email ?? null,
        emailNormalized: input.account.emailNormalized ?? null,
        passwordHash: input.account.passwordHash ?? null
      }
    });

    const player = await tx.player.create({
      data: {
        accountId: account.id,
        mana: input.player.mana,
        manaGenerationRate: input.player.manaGenerationRate,
        teamPower: input.player.teamPower,
        version: input.player.version ?? 0,
        lastUpdateTimestampMs: input.player.lastUpdateTimestampMs
      }
    });

    return {
      account: mapAccountRecord(account),
      player: mapPlayerRecord(player)
    };
  });
}
