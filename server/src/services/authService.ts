import jwt, { type SignOptions } from "jsonwebtoken";

import { config, GAME_CONFIG } from "../config/index.js";
import { createPlayer } from "../db/playerRepository.js";

export type GuestAuthResponse = {
  token: string;
  playerId: string;
};

/** Creates a new anonymous player and signs a JWT for subsequent authenticated requests. */
export async function createGuestSession(): Promise<GuestAuthResponse> {
  const now = new Date();
  const player = await createPlayer({
    mana: GAME_CONFIG.player.startingMana,
    manaGenerationRate: GAME_CONFIG.idle.baseRate,
    teamPower: GAME_CONFIG.player.startingTeamPower,
    lastUpdateTimestampMs: now
  });

  const token = jwt.sign({ playerId: player.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"]
  });

  return {
    token,
    playerId: player.id
  };
}
