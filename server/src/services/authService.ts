import jwt, { type SignOptions } from "jsonwebtoken";

import { config } from "../config/index.js";
import { createGuestAccount } from "./auth/createGuestAccount.js";

export type GuestAuthResponse = {
  token: string;
  playerId: string;
};

/** Creates a new anonymous player and signs a JWT for subsequent authenticated requests. */
export async function createGuestSession(): Promise<GuestAuthResponse> {
  const guestAccount = await createGuestAccount();

  const token = jwt.sign({ playerId: guestAccount.playerId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"]
  });

  return {
    token,
    playerId: guestAccount.playerId
  };
}
