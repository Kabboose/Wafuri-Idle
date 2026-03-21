import { GAME_CONFIG } from "../config/index.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";
import { calculateManaGain, getEffectiveRate, RATE_UPGRADE_INCREMENT } from "../utils/fixedPoint.js";

export function getEffectiveManaRate(player: Pick<PlayerState, "manaGenerationRate" | "teamPower">): bigint {
  return getEffectiveRate(player.manaGenerationRate, player.teamPower);
}

export function calculateIdleProgress(player: PlayerState, now: number): PlayerMutation {
  const elapsed = Math.max(now - player.lastUpdateTimestamp, 0);

  return {
    mana: player.mana + calculateManaGain(elapsed, player.manaGenerationRate, player.teamPower),
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: now
  };
}

export function applyUpgrade(player: PlayerState, now: number): PlayerMutation {
  const progressed = calculateIdleProgress(player, now);

  return {
    ...progressed,
    manaGenerationRate: progressed.manaGenerationRate + RATE_UPGRADE_INCREMENT,
    teamPower: progressed.teamPower + GAME_CONFIG.upgrade.teamPowerGain
  };
}
