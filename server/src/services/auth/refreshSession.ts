import { createHash } from "crypto";

import { findAccountById } from "../../db/accountRepo.js";
import { findPlayerIdentityByAccountId } from "../../db/identityRepo.js";
import {
  deleteExpiredSessions,
  findAnyByRefreshTokenHash,
  findByRefreshTokenHash,
  revokeAllSessionsForAccount,
  rotateRefreshSession
} from "../../db/sessionRepo.js";
import { logger } from "../../utils/logger.js";
import { createAuthTokens } from "./sessionTokens.js";

export type RefreshSessionInput = {
  refreshToken: string;
  nowMs: number;
};

export type RefreshSessionResult = {
  accountId: string;
  playerId: string;
  accessToken: string;
  refreshToken: string;
};

/** Hashes a raw refresh token before session lookup so the DB never relies on raw token values. */
function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/** Validates a refresh token, rotates the session, and returns the next auth token pair. */
export async function refreshSession(input: RefreshSessionInput): Promise<RefreshSessionResult> {
  await deleteExpiredSessions(input.nowMs);

  const tokenHash = hashRefreshToken(input.refreshToken);
  const session = await findByRefreshTokenHash(tokenHash, input.nowMs);

  if (!session) {
    const historicalSession = await findAnyByRefreshTokenHash(tokenHash);

    if (historicalSession?.revokedAt) {
      const revokedSessionCount = await revokeAllSessionsForAccount(
        historicalSession.accountId,
        new Date(input.nowMs)
      );

      logger.warn(
        {
          accountId: historicalSession.accountId,
          revokedSessionCount
        },
        "refresh token replay detected"
      );
    }

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

  const nextTokens = createAuthTokens(account.id, player.id, account.sessionVersion, new Date(input.nowMs));

  await rotateRefreshSession(session.id, {
    accountId: account.id,
    tokenHash: nextTokens.refreshTokenHash,
    expiresAt: nextTokens.refreshTokenExpiresAt,
    revokedAt: new Date(input.nowMs)
  });

  return {
    accountId: account.id,
    playerId: player.id,
    accessToken: nextTokens.accessToken,
    refreshToken: nextTokens.refreshToken
  };
}
