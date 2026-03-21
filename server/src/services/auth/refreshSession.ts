import { createHash } from "crypto";

import { findAccountById } from "../../db/accountRepo.js";
import { findPlayerIdentityByAccountId } from "../../db/identityRepo.js";
import { deleteExpiredSessions, findByRefreshTokenHash } from "../../db/sessionRepo.js";

export type RefreshSessionInput = {
  refreshToken: string;
  nowMs: number;
};

export type RefreshSessionResult = {
  accountId: string;
  playerId: string;
};

/** Hashes a raw refresh token before session lookup so the DB never relies on raw token values. */
function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/** Validates a refresh token and returns the linked account and player ids. */
export async function refreshSession(input: RefreshSessionInput): Promise<RefreshSessionResult> {
  await deleteExpiredSessions(input.nowMs);

  const tokenHash = hashRefreshToken(input.refreshToken);
  const session = await findByRefreshTokenHash(tokenHash, input.nowMs);

  if (!session) {
    throw new Error("Invalid refresh token");
  }

  const account = await findAccountById(session.accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  const player = await findPlayerIdentityByAccountId(account.id);

  if (!player) {
    throw new Error("Player not found");
  }

  return {
    accountId: account.id,
    playerId: player.id
  };
}
