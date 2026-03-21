import { GAME_CONFIG } from "../config/index.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";
import { calculateManaGain, getEffectiveRate, RATE_UPGRADE_INCREMENT } from "../utils/fixedPoint.js";

/** Returns the effective mana generation rate after applying team power scaling. */
export function getEffectiveManaRate(player: Pick<PlayerState, "manaGenerationRate" | "teamPower">): bigint {
  return getEffectiveRate(player.manaGenerationRate, player.teamPower);
}

/** Advances a player forward in time, capped by the configured offline progress limit. */
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

/** Applies the upgrade mutation to an already-progressed player state snapshot. */
export function upgradePlayer(player: PlayerMutation): PlayerMutation {
  return {
    ...player,
    manaGenerationRate: player.manaGenerationRate + RATE_UPGRADE_INCREMENT,
    teamPower: player.teamPower + GAME_CONFIG.upgrade.teamPowerGain
  };
}
