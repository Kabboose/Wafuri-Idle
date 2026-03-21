import { GAME_CONFIG } from "../../config/index.js";
import { createAccount } from "../../db/accountRepo.js";
import { createPlayer } from "../../db/playerRepo.js";

export type GuestAccountResult = {
  accountId: string;
  playerId: string;
};

/**
 * Creates a guest account and its linked player record using the repository layer only.
 * Accepts no input and returns the created account/player identifiers as plain data.
 */
export async function createGuestAccount(): Promise<GuestAccountResult> {
  const now = new Date();
  const account = await createAccount({
    type: "GUEST"
  });
  const player = await createPlayer({
    accountId: account.id,
    mana: GAME_CONFIG.player.startingMana,
    manaGenerationRate: GAME_CONFIG.idle.baseRate,
    teamPower: GAME_CONFIG.player.startingTeamPower,
    lastUpdateTimestampMs: now
  });

  return {
    accountId: account.id,
    playerId: player.id
  };
}
