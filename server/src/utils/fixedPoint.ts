import { GAME_CONFIG } from "../config/index.js";

const SCALE = BigInt(GAME_CONFIG.idle.fixedScale);
const MULTIPLIER_SCALE = BigInt(GAME_CONFIG.idle.multiplierScale);
const TEAM_POWER_BONUS_BPS = BigInt(GAME_CONFIG.idle.teamPowerBonusBps);

export const BASE_RATE = BigInt(GAME_CONFIG.idle.baseRate);
export const RATE_UPGRADE_INCREMENT = BigInt(GAME_CONFIG.upgrade.energyPerSecondIncrement);

/** Parses a fixed-point numeric string from storage into bigint form. */
export function parseFixed(value: string): bigint {
  return BigInt(value);
}

/** Serializes an internal bigint fixed-point value for storage or transport. */
export function stringifyFixed(value: bigint): string {
  return value.toString();
}

/** Applies the team power multiplier to a base fixed-point energy rate. */
export function getEffectiveRate(rate: bigint, teamPower: number): bigint {
  const multiplier = MULTIPLIER_SCALE + BigInt(teamPower) * TEAM_POWER_BONUS_BPS;
  return (rate * multiplier) / MULTIPLIER_SCALE;
}

/** Calculates energy gained over the provided elapsed milliseconds using fixed-point math. */
export function calculateEnergyGain(elapsedMilliseconds: number, rate: bigint, teamPower: number): bigint {
  const elapsed = BigInt(Math.max(elapsedMilliseconds, 0));
  return (elapsed * getEffectiveRate(rate, teamPower)) / 1000n;
}

/** Formats a fixed-point numeric string into a human-readable decimal string. */
export function formatFixed(value: string): string {
  const bigintValue = BigInt(value);
  const negative = bigintValue < 0n;
  const absolute = negative ? -bigintValue : bigintValue;
  const whole = absolute / SCALE;
  const fraction = absolute % SCALE;

  if (fraction === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const trimmedFraction = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${trimmedFraction}`;
}
