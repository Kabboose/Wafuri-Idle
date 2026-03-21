import { createHash, randomBytes } from "crypto";

import jwt, { type SignOptions } from "jsonwebtoken";

import { config } from "../../config/index.js";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
};

/**
 * Signs a short-lived access JWT for the provided authenticated identity.
 * Expects authoritative account and player ids and uses the configured signing secret.
 */
export function createAccessToken(accountId: string, playerId: string): string {
  return jwt.sign({ accountId, playerId }, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn as SignOptions["expiresIn"]
  });
}

/**
 * Generates a high-entropy opaque refresh token for session storage.
 * Returns the raw token only to the caller.
 */
export function createRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

/**
 * Hashes a refresh token before persistence so raw refresh tokens never reach the database.
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/**
 * Calculates the expiry timestamp for a newly issued refresh token.
 * Accepts the authoritative issue time so callers can keep request timing deterministic.
 */
export function getRefreshTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + config.refreshTokenTtlMs);
}

/**
 * Creates the full access and refresh token bundle needed by auth services.
 * Accepts the current time so token expiry is derived from one captured instant.
 */
export function createAuthTokens(accountId: string, playerId: string, now: Date): AuthTokens {
  const refreshToken = createRefreshToken();

  return {
    accessToken: createAccessToken(accountId, playerId),
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpiresAt: getRefreshTokenExpiresAt(now)
  };
}
