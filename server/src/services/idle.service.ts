import { GAME_CONFIG } from "../config/index.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";
import { calculateManaGain, getEffectiveRate, RATE_UPGRADE_INCREMENT } from "../utils/fixedPoint.js";

export function getEffectiveManaRate(player: Pick<PlayerState, "manaGenerationRate" | "teamPower">): bigint {
  return getEffectiveRate(player.manaGenerationRate, player.teamPower);
}

export function progressPlayer(player: PlayerState, now: number): PlayerMutation {
  const elapsedMs = Math.min(
    Math.max(now - player.lastUpdateTimestampMs, 0),
    GAME_CONFIG.idle.maxOfflineProgressMs
  );

  return {
    mana: player.mana + calculateManaGain(elapsedMs, player.manaGenerationRate, player.teamPower),
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestampMs: now
  };
}

export function upgradePlayer(player: PlayerMutation): PlayerMutation {
  return {
    ...player,
    manaGenerationRate: player.manaGenerationRate + RATE_UPGRADE_INCREMENT,
    teamPower: player.teamPower + GAME_CONFIG.upgrade.teamPowerGain
  };
}
