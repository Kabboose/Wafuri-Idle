import { v4 as uuidv4 } from "uuid";

import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { createSession } from "./cacheService.js";

export type GuestAuthResponse = {
  token: string;
  playerId: string;
};

export async function createGuestSession(): Promise<GuestAuthResponse> {
  const now = new Date();
  const player = await prisma.player.create({
    data: {
      mana: 0,
      manaGenerationRate: 1,
      teamPower: 10,
      lastUpdateTimestamp: now
    }
  });

  const token = uuidv4();
  await createSession(token, { playerId: player.id }, config.sessionTtlSeconds);

  return {
    token,
    playerId: player.id
  };
}

