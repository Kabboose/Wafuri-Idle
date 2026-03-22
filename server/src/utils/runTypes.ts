/** Serialized bigint values shared across run simulation and reward-result shapes. */
export type BigIntString = string;

/** Combat-relevant player stats captured as plain input for a deterministic run simulation. */
export interface PlayerCombatStats {
  power: BigIntString;
  speed: number;
  critChance: number;
}

/** Team-provided combat configuration used to derive a single run simulation input. */
export interface TeamConfig {
  power: BigIntString;
  speed: number;
  critChance: number;
  runDurationMs?: number;
}

/** Plain input required to simulate a single deterministic run. */
export interface RunInput {
  playerId: string;
  nowMs: number;
  seed: string;
  runDurationMs: number;
  combatStats: PlayerCombatStats;
}

/** Summary-level trigger emitted during a run for later reward processing or compact result display. */
export interface RunTriggerEvent {
  type: string;
  source: string;
  timestampMs: number;
  value?: BigIntString;
  comboDelta?: number;
}

/** Arena snapshot used to replay a simulated run in normalized space. */
export interface ArenaSnapshot {
  width: number;
  height: number;
  zones: Array<Record<string, never>>;
}

/** Entity participating in run playback with a deterministic normalized spawn position. */
export interface PlaybackEntity {
  id: string;
  kind: "BALL" | "ENEMY";
  spawnX: number;
  spawnY: number;
}

/** Straight-line movement segment for the ball through normalized arena coordinates. */
export interface BallPathEvent {
  kind: "BALL_PATH";
  tStart: number;
  tEnd: number;
  entityId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Spatial collision between two playback entities. */
export interface CollisionEvent {
  kind: "COLLISION";
  timestampMs: number;
  sourceEntityId: string;
  targetEntityId: string;
  collisionKind: "BALL_ENEMY";
  x: number;
  y: number;
}

/** Damage application event with the resulting combo and damage payload. */
export interface DamageEvent {
  kind: "DAMAGE";
  timestampMs: number;
  sourceEntityId: string;
  targetEntityId: string;
  x: number;
  y: number;
  damage: BigIntString;
  comboAfter: number;
  isCrit: boolean;
}

/** Extensible playback trigger hook for future effects layered onto the timeline. */
export interface TriggerEvent {
  kind: "TRIGGER";
  timestampMs: number;
  triggerType: string;
  sourceEntityId: string;
  x?: number;
  y?: number;
  value?: BigIntString;
  comboDelta?: number;
}

/** High-level run playback marker used to segment the replay timeline. */
export interface PhaseEvent {
  kind: "PHASE";
  timestampMs: number;
  phase: "RUN_START" | "FINISH";
}

/** Ordered deterministic playback output derived from the server-side run simulation. */
export interface RunPlayback {
  durationMs: number;
  arena: ArenaSnapshot;
  entities: PlaybackEntity[];
  events: PlaybackEvent[];
}

/** All playback timeline events supported by the current replay model. */
export type PlaybackEvent = BallPathEvent | CollisionEvent | DamageEvent | TriggerEvent | PhaseEvent;

/** Result of a deterministic run simulation. */
export interface RunResult {
  totalDamage: BigIntString;
  comboCount: number;
  triggers: RunTriggerEvent[];
  durationMs: number;
  playback: RunPlayback;
}

/** Reward output derived from a completed run result. */
export interface RewardResult {
  grantedResources: Record<string, BigIntString>;
  bonusTriggers: RunTriggerEvent[];
  summary: string[];
}
