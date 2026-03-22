import { createHash } from "crypto";

import { revokeSessionByTokenHash } from "../../db/sessionRepo.js";

export type LogoutSessionInput = {
  refreshToken: string;
  now: Date;
};

export type LogoutSessionResult = {
  success: true;
};

/** Hashes the raw refresh token before repository access so the DB never receives raw token values. */
function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/**
 * Soft-revokes the current session referenced by a refresh token.
 * Succeeds safely even when the session is already missing, expired, or revoked.
 */
export async function logoutSession(input: LogoutSessionInput): Promise<LogoutSessionResult> {
  const tokenHash = hashRefreshToken(input.refreshToken);

  await revokeSessionByTokenHash(tokenHash, input.now);

  return {
    success: true
  };
}
