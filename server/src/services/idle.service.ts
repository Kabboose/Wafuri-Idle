import { GAME_CONFIG } from "../config/index.js";
import type { PlayerMutation, PlayerState } from "../utils/playerTypes.js";
import { calculateEnergyGain, getEffectiveRate, RATE_UPGRADE_INCREMENT } from "../utils/fixedPoint.js";

/** Returns the effective energy generation rate after applying team power scaling. */
export function getEffectiveEnergyRate(player: Pick<PlayerState, "energyPerSecond" | "teamPower">): bigint {
  return getEffectiveRate(player.energyPerSecond, player.teamPower);
}

/** Clamps energy to the player's current cap using bigint-safe comparisons only. */
function clampEnergyToMax(energy: bigint, maxEnergy: bigint): bigint {
  return energy > maxEnergy ? maxEnergy : energy;
}

/** Advances a player forward in time, capped by the configured offline progress limit. */
export function progressPlayer(player: PlayerState, now: number): PlayerMutation {
  const elapsedMs = Math.min(
    Math.max(now - player.lastUpdateTimestampMs, 0),
    GAME_CONFIG.idle.maxOfflineProgressMs
  );

  return {
    energy: clampEnergyToMax(
      player.energy + calculateEnergyGain(elapsedMs, player.energyPerSecond, player.teamPower),
      player.maxEnergy
    ),
    maxEnergy: player.maxEnergy,
    energyPerSecond: player.energyPerSecond,
    teamPower: player.teamPower,
    lastUpdateTimestampMs: now
  };
}

/** Applies the upgrade mutation to an already-progressed player state snapshot. */
export function upgradePlayer(player: PlayerMutation): PlayerMutation {
  return {
    ...player,
    energyPerSecond: player.energyPerSecond + RATE_UPGRADE_INCREMENT,
    teamPower: player.teamPower + GAME_CONFIG.upgrade.teamPowerGain
  };
}
