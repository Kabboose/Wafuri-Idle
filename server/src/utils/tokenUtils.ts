import { createHash, randomBytes } from "crypto";

import jwt, { type SignOptions } from "jsonwebtoken";

import { config } from "../config/index.js";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
};

/** Signs a short-lived access JWT for the provided player id. */
export function createAccessToken(playerId: string): string {
  return jwt.sign({ playerId }, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn as SignOptions["expiresIn"]
  });
}

/** Generates a high-entropy opaque refresh token for session storage. */
export function createRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

/** Hashes a refresh token before persistence so raw refresh tokens never reach the database. */
export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/** Calculates the expiry timestamp for a newly issued refresh token. */
export function getRefreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + config.refreshTokenTtlMs);
}

/** Creates the full access/refresh token bundle needed by auth controllers. */
export function createAuthTokens(playerId: string): AuthTokens {
  const refreshToken = createRefreshToken();

  return {
    accessToken: createAccessToken(playerId),
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpiresAt: getRefreshTokenExpiresAt()
  };
}
