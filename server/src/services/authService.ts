import jwt, { type SignOptions } from "jsonwebtoken";

import { config } from "../config/index.js";
import { createGuestAccount } from "./auth/createGuestAccount.js";

export type GuestAuthResponse = {
  token: string;
  playerId: string;
};

/** Signs a JWT for the provided player id using the configured auth secret and expiry. */
export function issueAuthToken(playerId: string): string {
  return jwt.sign({ playerId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"]
  });
}

/** Creates a new anonymous player and signs a JWT for subsequent authenticated requests. */
export async function createGuestSession(): Promise<GuestAuthResponse> {
  const guestAccount = await createGuestAccount();

  return {
    token: issueAuthToken(guestAccount.playerId),
    playerId: guestAccount.playerId
  };
}
