/** Serialized bigint values shared across run simulation and reward-result shapes. */
export type BigIntString = string;

/** Combat-relevant player stats captured as plain input for a deterministic run simulation. */
export interface PlayerCombatStats {
  teamPower: number;
  baseDamage: BigIntString;
  attackIntervalMs: number;
  critChanceBps: number;
  critDamageMultiplierBps: number;
}

/** Plain input required to simulate a single deterministic run. */
export interface RunInput {
  playerId: string;
  nowMs: number;
  seed: string;
  runDurationMs: number;
  combatStats: PlayerCombatStats;
}

/** Structured event emitted during a run for later result and reward processing. */
export interface TriggerEvent {
  type: string;
  source: string;
  timestampMs: number;
  value?: BigIntString;
  comboDelta?: number;
}

/** Result of a deterministic run simulation. */
export interface RunResult {
  totalDamage: BigIntString;
  comboCount: number;
  triggers: TriggerEvent[];
  durationMs: number;
}

/** Reward output derived from a completed run result. */
export interface RewardResult {
  grantedResources: Record<string, BigIntString>;
  bonusTriggers: TriggerEvent[];
  summary: string[];
}
