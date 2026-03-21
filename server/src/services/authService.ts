import jwt, { type SignOptions } from "jsonwebtoken";

import { config } from "../config/index.js";
import { createPlayer } from "../db/playerRepository.js";

export type GuestAuthResponse = {
  token: string;
  playerId: string;
};

export async function createGuestSession(): Promise<GuestAuthResponse> {
  const now = new Date();
  const player = await createPlayer({
    mana: 0,
    manaGenerationRate: 1,
    teamPower: 10,
    lastUpdateTimestamp: now
  });

  const token = jwt.sign({ playerId: player.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"]
  });

  return {
    token,
    playerId: player.id
  };
}
