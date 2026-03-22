import { GAME_CONFIG } from "../config/index.js";
import type {
  BallPathEvent,
  CollisionEvent,
  DamageEvent,
  PhaseEvent,
  PlaybackEntity,
  PlaybackEvent,
  RunInput,
  RunPlayback,
  RunResult,
  RunTriggerEvent
} from "../utils/runTypes.js";

const DEFAULT_RUN_DURATION_MS = GAME_CONFIG.run.defaultDurationMs;
const BASE_CRIT_DAMAGE_MULTIPLIER = BigInt(GAME_CONFIG.run.baseCritDamageMultiplier);
const BASE_CRIT_CHANCE_SCALE = GAME_CONFIG.run.baseCritChanceScale;
const SPEED_SCALE = GAME_CONFIG.run.speedScale;

type SimulatedHit = {
  damage: bigint;
  comboAfter: number;
  isCrit: boolean;
  timestampMs: number;
};

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
  return Math.min(Math.max(Math.floor(value), 0), BASE_CRIT_CHANCE_SCALE);
}

/** Converts the provided speed stat into a deterministic hit count over the run duration. */
function calculateHitCount(speed: number, durationMs: number): number {
  const normalizedSpeed = Math.max(Math.floor(speed), 0);

  return Math.floor((normalizedSpeed * durationMs) / SPEED_SCALE);
}

/** Maps a seeded random value into a normalized inclusive range. */
function normalizePosition(nextRandom: () => number, min: number, max: number): number {
  return min + nextRandom() * (max - min);
}

/** Builds the deterministic entity layout for the run playback snapshot. */
function createPlaybackEntities(seed: string): PlaybackEntity[] {
  const nextRandom = createSeededRng(`${seed}:playback-layout`);

  return [
    {
      id: "ball-1",
      kind: "BALL",
      spawnX: 0.5,
      spawnY: 0.15
    },
    {
      id: "enemy-1",
      kind: "ENEMY",
      spawnX: normalizePosition(nextRandom, 0.2, 0.8),
      spawnY: normalizePosition(nextRandom, 0.55, 0.85)
    }
  ];
}

/** Clamps normalized coordinates into the supported playback space. */
function clampNormalized(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Returns the primary timeline timestamp used to order mixed playback event types. */
function getPlaybackEventTime(event: PlaybackEvent): number {
  if (event.kind === "BALL_PATH") {
    return event.tStart;
  }

  return event.timestampMs;
}

/** Validates that a playback timeline is replay-safe and internally consistent. */
function validatePlayback(playback: RunPlayback): void {
  const entityIds = new Set(playback.entities.map((entity) => entity.id));
  let previousEventTime = -1;

  for (const event of playback.events) {
    const eventTime = getPlaybackEventTime(event);

    if (event.kind === "BALL_PATH") {
      if (event.tStart < 0 || event.tEnd < 0) {
        throw new Error("Playback contains negative path timestamps");
      }

      if (event.tEnd < event.tStart) {
        throw new Error("Playback contains inverted path timing");
      }

      if (!entityIds.has(event.entityId)) {
        throw new Error("Playback references unknown path entity");
      }
    } else {
      if (event.timestampMs < 0) {
        throw new Error("Playback contains negative event timestamps");
      }
    }

    if (eventTime < previousEventTime) {
      throw new Error("Playback events are out of order");
    }

    if (event.kind === "COLLISION" || event.kind === "DAMAGE") {
      if (!entityIds.has(event.sourceEntityId) || !entityIds.has(event.targetEntityId)) {
        throw new Error("Playback references unknown collision or damage entity");
      }
    }

    if (event.kind === "TRIGGER" && !entityIds.has(event.sourceEntityId)) {
      throw new Error("Playback references unknown trigger entity");
    }

    previousEventTime = eventTime;
  }
}

/** Builds simple deterministic straight-line ball path, collision, and damage events in normalized space. */
function createMotionTimeline(entities: PlaybackEntity[], durationMs: number, hits: SimulatedHit[]): PlaybackEvent[] {
  const ballEntity = entities.find((entity) => entity.kind === "BALL");
  const enemyEntity = entities.find((entity) => entity.kind === "ENEMY");

  if (!ballEntity || !enemyEntity || durationMs <= 0 || hits.length === 0) {
    return [];
  }

  const motionHitCount = hits.length;
  const segmentCount = motionHitCount * 2;
  const segmentDurationMs = Math.max(Math.floor(durationMs / segmentCount), 1);
  const events: PlaybackEvent[] = [];
  let currentX = ballEntity.spawnX;
  let currentY = ballEntity.spawnY;

  for (let hitIndex = 0; hitIndex < hits.length; hitIndex += 1) {
    const hit = hits[hitIndex];
    const approachStart = hitIndex * 2 * segmentDurationMs;
    const approachEnd = hitIndex === motionHitCount - 1
      ? Math.min(approachStart + segmentDurationMs, durationMs)
      : Math.min((hitIndex * 2 + 1) * segmentDurationMs, durationMs);
    const reboundStart = approachEnd;
    const reboundEnd = hitIndex === motionHitCount - 1
      ? durationMs
      : Math.min((hitIndex * 2 + 2) * segmentDurationMs, durationMs);
    const reboundDirection = hitIndex % 2 === 0 ? -1 : 1;
    const reboundX = clampNormalized(enemyEntity.spawnX + reboundDirection * 0.18);
    const reboundY = clampNormalized(enemyEntity.spawnY - 0.08 + (hitIndex % 3) * 0.04);

    const approachEvent: BallPathEvent = {
      kind: "BALL_PATH",
      tStart: approachStart,
      tEnd: approachEnd,
      entityId: ballEntity.id,
      fromX: currentX,
      fromY: currentY,
      toX: enemyEntity.spawnX,
      toY: enemyEntity.spawnY
    };
    const collisionEvent: CollisionEvent = {
      kind: "COLLISION",
      timestampMs: approachEnd,
      sourceEntityId: ballEntity.id,
      targetEntityId: enemyEntity.id,
      collisionKind: "BALL_ENEMY",
      x: enemyEntity.spawnX,
      y: enemyEntity.spawnY
    };
    const damageEvent: DamageEvent = {
      kind: "DAMAGE",
      timestampMs: approachEnd,
      sourceEntityId: ballEntity.id,
      targetEntityId: enemyEntity.id,
      x: enemyEntity.spawnX,
      y: enemyEntity.spawnY,
      damage: hit.damage.toString(),
      comboAfter: hit.comboAfter,
      isCrit: hit.isCrit
    };

    events.push(approachEvent, collisionEvent, damageEvent);

    if (reboundStart < reboundEnd) {
      events.push({
        kind: "BALL_PATH",
        tStart: reboundStart,
        tEnd: reboundEnd,
        entityId: ballEntity.id,
        fromX: enemyEntity.spawnX,
        fromY: enemyEntity.spawnY,
        toX: reboundX,
        toY: reboundY
      });
    }

    currentX = reboundX;
    currentY = reboundY;
  }

  return events;
}

/** Builds the minimal deterministic playback payload for a simulated run. */
function createPlayback(seed: string, durationMs: number, hits: SimulatedHit[]): RunPlayback {
  const entities = createPlaybackEntities(seed);
  const motionEvents = createMotionTimeline(entities, durationMs, hits);
  const phaseEvents: PhaseEvent[] = [
    {
      kind: "PHASE",
      timestampMs: 0,
      phase: "RUN_START"
    },
    {
      kind: "PHASE",
      timestampMs: durationMs,
      phase: "FINISH"
    }
  ];

  const playback: RunPlayback = {
    durationMs,
    arena: {
      width: 1,
      height: 1,
      zones: []
    },
    entities,
    events: [phaseEvents[0], ...motionEvents, phaseEvents[1]]
  };

  validatePlayback(playback);

  return playback;
}

/** Simulates a deterministic fixed-duration run and returns aggregate combat output only. */
export function simulateRun(input: RunInput): RunResult {
  const durationMs = Math.max(Math.floor(input.runDurationMs), 0) || DEFAULT_RUN_DURATION_MS;
  const power = BigInt(input.combatStats.power);
  const critChance = clampBps(input.combatStats.critChance);
  const hitCount = calculateHitCount(input.combatStats.speed, durationMs);
  const nextRandom = createSeededRng(input.seed);
  const triggers: RunTriggerEvent[] = [];
  const hits: SimulatedHit[] = [];
  let totalDamage = 0n;
  let comboCount = 0;

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    const isCriticalHit = nextRandom() < critChance / BASE_CRIT_CHANCE_SCALE;
    const hitDamage = isCriticalHit ? power * BASE_CRIT_DAMAGE_MULTIPLIER : power;
    const timestampMs = input.nowMs + Math.floor(((hitIndex + 1) * durationMs) / Math.max(hitCount, 1));

    totalDamage += hitDamage;
    comboCount += 1;
    hits.push({
      damage: hitDamage,
      comboAfter: comboCount,
      isCrit: isCriticalHit,
      timestampMs
    });

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
    durationMs,
    playback: createPlayback(input.seed, durationMs, hits)
  };
}
