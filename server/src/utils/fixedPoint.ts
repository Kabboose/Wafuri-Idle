const SCALE = 1_000_000n;
const MULTIPLIER_SCALE = 10_000n;
const TEAM_POWER_BONUS_BPS = 200n;

export const BASE_RATE = SCALE;
export const RATE_UPGRADE_INCREMENT = 500_000n;

export function parseFixed(value: string): bigint {
  return BigInt(value);
}

export function stringifyFixed(value: bigint): string {
  return value.toString();
}

export function getEffectiveRate(rate: bigint, teamPower: number): bigint {
  const multiplier = MULTIPLIER_SCALE + BigInt(teamPower) * TEAM_POWER_BONUS_BPS;
  return (rate * multiplier) / MULTIPLIER_SCALE;
}

export function calculateManaGain(elapsedMilliseconds: number, rate: bigint, teamPower: number): bigint {
  const elapsed = BigInt(Math.max(elapsedMilliseconds, 0));
  return (elapsed * getEffectiveRate(rate, teamPower)) / 1000n;
}

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
