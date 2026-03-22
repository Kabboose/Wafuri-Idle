import { GAME_CONFIG } from "../../config/index.js";
import { createGuestAccountIdentity } from "../../db/identityRepo.js";

export type GuestAccountResult = {
  accountId: string;
  playerId: string;
};

/**
 * Creates a guest account and its linked player record using the repository layer only.
 * Accepts the captured request time and returns the created account/player identifiers as plain data.
 */
export async function createGuestAccount(input: { now: Date }): Promise<GuestAccountResult> {
  const identity = await createGuestAccountIdentity({
    account: {
      type: "GUEST"
    },
    player: {
      energy: GAME_CONFIG.player.startingEnergy,
      maxEnergy: GAME_CONFIG.player.startingMaxEnergy,
      energyPerSecond: GAME_CONFIG.idle.baseRate,
      teamPower: GAME_CONFIG.player.startingTeamPower,
      lastUpdateTimestampMs: input.now
    }
  });

  return {
    accountId: identity.account.id,
    playerId: identity.player.id
  };
}
