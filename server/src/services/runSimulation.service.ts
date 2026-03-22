import { GAME_CONFIG } from "../config/index.js";
import type { BallPathEvent, PhaseEvent, PlaybackEntity, RunInput, RunPlayback, RunResult, RunTriggerEvent } from "../utils/runTypes.js";

const DEFAULT_RUN_DURATION_MS = GAME_CONFIG.run.defaultDurationMs;
const BASE_CRIT_DAMAGE_MULTIPLIER = BigInt(GAME_CONFIG.run.baseCritDamageMultiplier);
const BASE_CRIT_CHANCE_SCALE = GAME_CONFIG.run.baseCritChanceScale;
const SPEED_SCALE = GAME_CONFIG.run.speedScale;

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

/** Builds simple deterministic straight-line ball path segments in normalized space. */
function createBallPathEvents(entities: PlaybackEntity[], durationMs: number, hitCount: number): BallPathEvent[] {
  const ballEntity = entities.find((entity) => entity.kind === "BALL");
  const enemyEntity = entities.find((entity) => entity.kind === "ENEMY");

  if (!ballEntity || !enemyEntity || durationMs <= 0) {
    return [];
  }

  const segmentCount = Math.min(Math.max(hitCount, 10), 30);
  const segmentDurationMs = Math.max(Math.floor(durationMs / segmentCount), 1);
  const reboundX = Math.min(Math.max(1 - enemyEntity.spawnX, 0), 1);
  const reboundY = Math.min(enemyEntity.spawnY + 0.05, 0.95);
  const waypoints = [
    { x: ballEntity.spawnX, y: ballEntity.spawnY },
    { x: enemyEntity.spawnX, y: enemyEntity.spawnY },
    { x: reboundX, y: reboundY }
  ];
  const events: BallPathEvent[] = [];

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const fromPoint = waypoints[segmentIndex % waypoints.length];
    const toPoint = waypoints[(segmentIndex + 1) % waypoints.length];
    const tStart = segmentIndex * segmentDurationMs;
    const tEnd = segmentIndex === segmentCount - 1 ? durationMs : Math.min((segmentIndex + 1) * segmentDurationMs, durationMs);

    events.push({
      kind: "BALL_PATH",
      tStart,
      tEnd,
      entityId: ballEntity.id,
      fromX: fromPoint.x,
      fromY: fromPoint.y,
      toX: toPoint.x,
      toY: toPoint.y
    });
  }

  return events;
}

/** Builds the minimal deterministic playback payload for a simulated run. */
function createPlayback(seed: string, durationMs: number, hitCount: number): RunPlayback {
  const entities = createPlaybackEntities(seed);
  const pathEvents = createBallPathEvents(entities, durationMs, hitCount);
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

  return {
    durationMs,
    arena: {
      width: 1,
      height: 1,
      zones: []
    },
    entities,
    events: [phaseEvents[0], ...pathEvents, phaseEvents[1]]
  };
}

/** Simulates a deterministic fixed-duration run and returns aggregate combat output only. */
export function simulateRun(input: RunInput): RunResult {
  const durationMs = Math.max(Math.floor(input.runDurationMs), 0) || DEFAULT_RUN_DURATION_MS;
  const power = BigInt(input.combatStats.power);
  const critChance = clampBps(input.combatStats.critChance);
  const hitCount = calculateHitCount(input.combatStats.speed, durationMs);
  const nextRandom = createSeededRng(input.seed);
  const triggers: RunTriggerEvent[] = [];
  let totalDamage = 0n;
  let comboCount = 0;

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    const isCriticalHit = nextRandom() < critChance / BASE_CRIT_CHANCE_SCALE;
    const hitDamage = isCriticalHit ? power * BASE_CRIT_DAMAGE_MULTIPLIER : power;
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
    durationMs,
    playback: createPlayback(input.seed, durationMs, hitCount)
  };
}
