import { GAME_CONFIG } from "../config/index.js";
import type { PlayerMutation } from "../utils/playerTypes.js";

const RUN_ENERGY_COST = BigInt(GAME_CONFIG.run.runEnergyCost);

type RunEligiblePlayerState = Pick<
  PlayerMutation,
  "energy" | "maxEnergy" | "currency" | "progression" | "energyPerSecond" | "teamPower" | "lastUpdateTimestampMs"
>;

/** Returns whether the player has enough energy to pay the configured run cost. */
export function canStartRun(playerState: Pick<RunEligiblePlayerState, "energy">): boolean {
  return playerState.energy >= RUN_ENERGY_COST;
}

/** Deducts the configured run energy cost once and returns the updated player resource state. */
export function spendRunEnergy(playerState: RunEligiblePlayerState): PlayerMutation {
  if (!canStartRun(playerState)) {
    throw new Error("Not enough energy to start run");
  }

  return {
    ...playerState,
    energy: playerState.energy - RUN_ENERGY_COST
  };
}
