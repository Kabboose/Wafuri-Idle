import { GAME_CONFIG } from "../config/index.js";
import type { RewardResult, RunResult } from "../utils/runTypes.js";

const CURRENCY_PER_DAMAGE = BigInt(GAME_CONFIG.rewards.currencyPerDamage);
const PROGRESSION_PER_COMBO = BigInt(GAME_CONFIG.rewards.progressionPerCombo);

/** Clamps combo counts into a deterministic non-negative integer for reward conversion. */
function normalizeComboCount(comboCount: number): bigint {
  return BigInt(Math.max(Math.floor(comboCount), 0));
}

/** Calculates deterministic run rewards from run output only. */
export function calculateRewards(result: RunResult): RewardResult {
  const totalDamage = BigInt(result.totalDamage);
  const comboCount = normalizeComboCount(result.comboCount);
  const currency = totalDamage * CURRENCY_PER_DAMAGE;
  const progression = comboCount * PROGRESSION_PER_COMBO;

  return {
    grantedResources: {
      currency: currency.toString(),
      progression: progression.toString()
    },
    bonusTriggers: [],
    summary: [
      `currency:${currency.toString()}`,
      `progression:${progression.toString()}`
    ]
  };
}
