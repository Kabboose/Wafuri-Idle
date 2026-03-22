import type { RunInput, RunResult, TriggerEvent } from "../utils/runTypes.js";

const DEFAULT_RUN_DURATION_MS = 10_000;
const CRIT_MULTIPLIER = 2n;
const CRIT_CHANCE_SCALE = 10_000;
const SPEED_SCALE = 1_000;

/** Hashes the provided seed string into a deterministic 32-bit unsigned integer. */
function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/** Builds a deterministic pseudo-random generator for the provided seed. */
function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Clamps percentage-like basis-point values into a deterministic supported range. */
function clampBps(value: number): number {
  return Math.min(Math.max(Math.floor(value), 0), CRIT_CHANCE_SCALE);
}

/** Converts the provided speed stat into a deterministic hit count over the run duration. */
function calculateHitCount(speed: number, durationMs: number): number {
  const normalizedSpeed = Math.max(Math.floor(speed), 0);

  return Math.floor((normalizedSpeed * durationMs) / SPEED_SCALE);
}

/** Simulates a deterministic fixed-duration run and returns aggregate combat output only. */
export function simulateRun(input: RunInput): RunResult {
  const durationMs = Math.max(Math.floor(input.runDurationMs), 0) || DEFAULT_RUN_DURATION_MS;
  const power = BigInt(input.combatStats.power);
  const critChance = clampBps(input.combatStats.critChance);
  const hitCount = calculateHitCount(input.combatStats.speed, durationMs);
  const nextRandom = createSeededRng(input.seed);
  const triggers: TriggerEvent[] = [];
  let totalDamage = 0n;
  let comboCount = 0;

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    const isCriticalHit = nextRandom() < critChance / CRIT_CHANCE_SCALE;
    const hitDamage = isCriticalHit ? power * CRIT_MULTIPLIER : power;
    const timestampMs = input.nowMs + Math.floor(((hitIndex + 1) * durationMs) / Math.max(hitCount, 1));

    totalDamage += hitDamage;
    comboCount += 1;

    triggers.push({
      type: isCriticalHit ? "critical-hit" : "hit",
      source: "basic-attack",
      timestampMs,
      value: hitDamage.toString(),
      comboDelta: 1
    });
  }

  return {
    totalDamage: totalDamage.toString(),
    comboCount,
    triggers,
    durationMs
  };
}
