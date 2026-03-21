import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";

const TEAM_POWER_BONUS_PER_POINT = 0.02;
const TEAM_POWER_UPGRADE_GAIN = 1;
const MANA_RATE_UPGRADE_GAIN = 0.5;

export function getEffectiveManaRate(player: Pick<PlayerState, "manaGenerationRate" | "teamPower">): number {
  return player.manaGenerationRate * (1 + player.teamPower * TEAM_POWER_BONUS_PER_POINT);
}

export function calculateIdleProgress(player: PlayerState, now: number): PlayerMutation {
  const elapsed = Math.max(now - player.lastUpdateTimestamp, 0) / 1000;

  return {
    mana: player.mana + elapsed * getEffectiveManaRate(player),
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: now
  };
}

export function applyUpgrade(player: PlayerState, now: number): PlayerMutation {
  const progressed = calculateIdleProgress(player, now);

  return {
    ...progressed,
    manaGenerationRate: progressed.manaGenerationRate + MANA_RATE_UPGRADE_GAIN,
    teamPower: progressed.teamPower + TEAM_POWER_UPGRADE_GAIN
  };
}

