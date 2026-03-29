import { GAME_CONFIG } from "../config/index.js";
import type {
  PhaseEvent,
  PlaybackEntity,
  PlaybackEvent,
  RunInput,
  RunPlayback,
  RunResult,
  RunTriggerEvent,
  TriggerEvent
} from "../utils/runTypes.js";

const DEFAULT_RUN_DURATION_MS = GAME_CONFIG.run.defaultDurationMs;
const BASE_CRIT_DAMAGE_MULTIPLIER = BigInt(GAME_CONFIG.run.baseCritDamageMultiplier);
const BASE_CRIT_CHANCE_SCALE = GAME_CONFIG.run.baseCritChanceScale;
const PLAYBACK_COMBO_MILESTONE_THRESHOLDS = new Set<number>(GAME_CONFIG.run.playbackComboMilestoneThresholds);
const PLAYBACK_ENEMY_COLLISION_RADIUS = GAME_CONFIG.run.playbackEnemyCollisionRadius;
const PLAYBACK_FINISHER_LEAD_MS = GAME_CONFIG.run.playbackFinisherLeadMs;
const PLAYBACK_WALL_REBOUND_MAX_NORMAL_COMPONENT = GAME_CONFIG.run.playbackWallReboundMaxNormalComponent;
const PLAYBACK_WALL_REBOUND_MIN_NORMAL_COMPONENT = GAME_CONFIG.run.playbackWallReboundMinNormalComponent;
const PLAYBACK_WALL_INSET = GAME_CONFIG.run.playbackWallInset;
const SPEED_SCALE = GAME_CONFIG.run.speedScale;

type SimulatedHit = {
  damage: bigint;
  comboAfter: number;
  isCrit: boolean;
  timestampMs: number;
};

type EnemyTarget = PlaybackEntity & { kind: "ENEMY" };
type ObstacleTarget = PlaybackEntity & { kind: "OBSTACLE" };
type CircularTarget = EnemyTarget | ObstacleTarget;
type Point = { x: number; y: number };
type WallCollision = Point & {
  normal: Point;
  targetEntityId: string;
  distance: number;
};
type EnemyCollision = Point & {
  enemy: EnemyTarget;
  normal: Point;
  distance: number;
};
type ObstacleCollision = Point & {
  obstacle: ObstacleTarget;
  normal: Point;
  distance: number;
};
type MotionStep = {
  from: Point;
  to: Point;
  collision: WallCollision | EnemyCollision | ObstacleCollision;
  hit?: SimulatedHit;
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
  const enemies: PlaybackEntity[] = [
    {
      id: "enemy-1",
      kind: "ENEMY",
      spawnX: normalizePosition(nextRandom, 0.12, 0.24),
      spawnY: normalizePosition(nextRandom, 0.14, 0.22)
    },
    {
      id: "enemy-2",
      kind: "ENEMY",
      spawnX: normalizePosition(nextRandom, 0.7, 0.86),
      spawnY: normalizePosition(nextRandom, 0.24, 0.36)
    },
    {
      id: "enemy-3",
      kind: "ENEMY",
      spawnX: normalizePosition(nextRandom, 0.46, 0.62),
      spawnY: normalizePosition(nextRandom, 0.46, 0.58)
    },
    {
      id: "enemy-4",
      kind: "ENEMY",
      spawnX: normalizePosition(nextRandom, 0.26, 0.4),
      spawnY: normalizePosition(nextRandom, 0.68, 0.78)
    }
  ];
  const obstacles: PlaybackEntity[] = [
    {
      id: "obstacle-1",
      kind: "OBSTACLE",
      spawnX: normalizePosition(nextRandom, 0.24, 0.34),
      spawnY: normalizePosition(nextRandom, 0.34, 0.46)
    },
    {
      id: "obstacle-2",
      kind: "OBSTACLE",
      spawnX: normalizePosition(nextRandom, 0.64, 0.76),
      spawnY: normalizePosition(nextRandom, 0.52, 0.64)
    }
  ];

  return [
    {
      id: "ball-1",
      kind: "BALL",
      spawnX: 0.52,
      spawnY: 0.9
    },
    {
      id: "wall-left",
      kind: "ARENA",
      spawnX: 0.04,
      spawnY: 0.5
    },
    {
      id: "wall-right",
      kind: "ARENA",
      spawnX: 0.96,
      spawnY: 0.5
    },
    {
      id: "wall-top",
      kind: "ARENA",
      spawnX: 0.5,
      spawnY: 0.04
    },
    {
      id: "wall-bottom",
      kind: "ARENA",
      spawnX: 0.5,
      spawnY: 0.96
    },
    ...obstacles,
    ...enemies
  ];
}

/** Clamps normalized coordinates into the supported playback space. */
function clampNormalized(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Returns the length of a simple 2D vector. */
function getVectorLength(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Normalizes a simple 2D vector, falling back to the provided default when degenerate. */
function normalizeVector(x: number, y: number, fallback: Point): Point {
  const length = getVectorLength(x, y);

  if (length <= Number.EPSILON) {
    return fallback;
  }

  return {
    x: x / length,
    y: y / length
  };
}

/** Reflects an incoming unit direction around the provided surface normal. */
function reflectDirection(direction: Point, normal: Point): Point {
  const dot = direction.x * normal.x + direction.y * normal.y;

  return normalizeVector(
    direction.x - 2 * dot * normal.x,
    direction.y - 2 * dot * normal.y,
    { x: direction.x * -1, y: direction.y * -1 }
  );
}

/** Clamps a wall rebound so the exit angle stays readable and pinball-like. */
function tuneWallReboundDirection(reflectedDirection: Point, wallNormal: Point): Point {
  const minNormalComponent = Math.min(
    Math.max(PLAYBACK_WALL_REBOUND_MIN_NORMAL_COMPONENT, Number.EPSILON),
    1
  );
  const maxNormalComponent = Math.min(
    Math.max(PLAYBACK_WALL_REBOUND_MAX_NORMAL_COMPONENT, minNormalComponent),
    1
  );

  if (Math.abs(wallNormal.x) > Number.EPSILON) {
    const clampedNormalComponent = Math.min(
      Math.max(Math.abs(reflectedDirection.x), minNormalComponent),
      maxNormalComponent
    );
    const tangentMagnitude = Math.sqrt(Math.max(1 - clampedNormalComponent * clampedNormalComponent, 0));
    const tangentSign = reflectedDirection.y < 0 ? -1 : 1;

    return {
      x: wallNormal.x * clampedNormalComponent,
      y: tangentSign * tangentMagnitude
    };
  }

  const clampedNormalComponent = Math.min(
    Math.max(Math.abs(reflectedDirection.y), minNormalComponent),
    maxNormalComponent
  );
  const tangentMagnitude = Math.sqrt(Math.max(1 - clampedNormalComponent * clampedNormalComponent, 0));
  const tangentSign = reflectedDirection.x < 0 ? -1 : 1;

  return {
    x: tangentSign * tangentMagnitude,
    y: wallNormal.y * clampedNormalComponent
  };
}

/** Produces a deterministic enemy order so hits cycle through the board in a replay-friendly way. */
function createEnemySequence(seed: string, enemyEntities: EnemyTarget[]): EnemyTarget[] {
  const nextRandom = createSeededRng(`${seed}:enemy-order`);
  const weightedEnemies = enemyEntities.map((entity) => ({
    entity,
    weight: nextRandom()
  }));

  return weightedEnemies
    .sort((left, right) => left.weight - right.weight || left.entity.id.localeCompare(right.entity.id))
    .map(({ entity }) => entity);
}

/** Computes the first valid wall contact for the current heading. */
function getWallCollision(start: Point, direction: Point): WallCollision {
  const candidates: WallCollision[] = [];

  if (direction.x < -Number.EPSILON) {
    const distance = (PLAYBACK_WALL_INSET - start.x) / direction.x;

    if (distance > Number.EPSILON) {
      candidates.push({
        x: PLAYBACK_WALL_INSET,
        y: clampNormalized(start.y + direction.y * distance),
        normal: { x: 1, y: 0 },
        targetEntityId: "wall-left",
        distance
      });
    }
  }

  if (direction.x > Number.EPSILON) {
    const distance = ((1 - PLAYBACK_WALL_INSET) - start.x) / direction.x;

    if (distance > Number.EPSILON) {
      candidates.push({
        x: 1 - PLAYBACK_WALL_INSET,
        y: clampNormalized(start.y + direction.y * distance),
        normal: { x: -1, y: 0 },
        targetEntityId: "wall-right",
        distance
      });
    }
  }

  if (direction.y < -Number.EPSILON) {
    const distance = (PLAYBACK_WALL_INSET - start.y) / direction.y;

    if (distance > Number.EPSILON) {
      candidates.push({
        x: clampNormalized(start.x + direction.x * distance),
        y: PLAYBACK_WALL_INSET,
        normal: { x: 0, y: 1 },
        targetEntityId: "wall-top",
        distance
      });
    }
  }

  if (direction.y > Number.EPSILON) {
    const distance = ((1 - PLAYBACK_WALL_INSET) - start.y) / direction.y;

    if (distance > Number.EPSILON) {
      candidates.push({
        x: clampNormalized(start.x + direction.x * distance),
        y: 1 - PLAYBACK_WALL_INSET,
        normal: { x: 0, y: -1 },
        targetEntityId: "wall-bottom",
        distance
      });
    }
  }

  const firstCollision = candidates.reduce<WallCollision | null>((closest, candidate) => {
    if (
      !closest ||
      candidate.distance < closest.distance - Number.EPSILON ||
      (Math.abs(candidate.distance - closest.distance) <= Number.EPSILON &&
        candidate.targetEntityId.localeCompare(closest.targetEntityId) < 0)
    ) {
      return candidate;
    }

    return closest;
  }, null);

  if (!firstCollision) {
    throw new Error("Unable to compute playback wall collision");
  }

  return firstCollision;
}

/** Computes the first enemy collision intersected by the current heading, if any. */
function getCircularCollision(
  start: Point,
  direction: Point,
  targets: CircularTarget[],
  enemySequenceOrder: Map<string, number>
): EnemyCollision | ObstacleCollision | null {
  const collisions: Array<EnemyCollision | ObstacleCollision> = [];

  for (const target of targets) {
    const offsetX = start.x - target.spawnX;
    const offsetY = start.y - target.spawnY;
    const projection = direction.x * offsetX + direction.y * offsetY;
    const centerDistanceSquared = offsetX * offsetX + offsetY * offsetY;
    const radiusSquared = PLAYBACK_ENEMY_COLLISION_RADIUS * PLAYBACK_ENEMY_COLLISION_RADIUS;
    const discriminant = projection * projection - (centerDistanceSquared - radiusSquared);

    if (discriminant < 0) {
      continue;
    }

    const root = Math.sqrt(discriminant);
    const distance = -projection - root;

    if (distance <= Number.EPSILON) {
      continue;
    }

    const contactPoint = {
      x: start.x + direction.x * distance,
      y: start.y + direction.y * distance
    };
    const normal = normalizeVector(
      contactPoint.x - target.spawnX,
      contactPoint.y - target.spawnY,
      { x: 0, y: -1 }
    );

    if (target.kind === "ENEMY") {
      collisions.push({
        enemy: target,
        x: clampNormalized(contactPoint.x),
        y: clampNormalized(contactPoint.y),
        normal,
        distance
      });
      continue;
    }

    collisions.push({
      obstacle: target,
      x: clampNormalized(contactPoint.x),
      y: clampNormalized(contactPoint.y),
      normal,
      distance
    });
  }

  const getCollisionPriority = (collision: EnemyCollision | ObstacleCollision): number => {
    if ("enemy" in collision) {
      return enemySequenceOrder.get(collision.enemy.id) ?? Number.MAX_SAFE_INTEGER;
    }

    return Number.MAX_SAFE_INTEGER;
  };

  return collisions.reduce<EnemyCollision | ObstacleCollision | null>((closest, candidate) => {
    if (
      !closest ||
      candidate.distance < closest.distance - Number.EPSILON ||
      (
        Math.abs(candidate.distance - closest.distance) <= Number.EPSILON &&
        getCollisionPriority(candidate) < getCollisionPriority(closest)
      )
    ) {
      return candidate;
    }

    return closest;
  }, null);
}

/** Returns the primary timeline timestamp used to order mixed playback event types. */
function getPlaybackEventTime(event: PlaybackEvent): number {
  if (event.kind === "BALL_PATH") {
    return event.timelineStartMs;
  }

  return event.timelineTimestampMs;
}

/** Validates that a playback timeline is replay-safe and internally consistent. */
function validatePlayback(playback: RunPlayback): void {
  const entityIds = new Set(playback.entities.map((entity) => entity.id));
  let previousEventTime = -1;

  for (const event of playback.events) {
    const eventTime = getPlaybackEventTime(event);

    if (event.kind === "BALL_PATH") {
      if (event.timelineStartMs < 0 || event.timelineEndMs < 0) {
        throw new Error("Playback contains negative path timestamps");
      }

      if (event.timelineEndMs < event.timelineStartMs) {
        throw new Error("Playback contains inverted path timing");
      }

      if (!entityIds.has(event.entityId)) {
        throw new Error("Playback references unknown path entity");
      }
    } else {
      if (event.timelineTimestampMs < 0) {
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

    if (
      event.kind === "TRIGGER" &&
      ((event.entityId && !entityIds.has(event.entityId)) || (event.targetEntityId && !entityIds.has(event.targetEntityId)))
    ) {
      throw new Error("Playback references unknown trigger entity");
    }

    previousEventTime = eventTime;
  }
}

/** Builds a deterministic playback trigger for a world-space impact burst. */
function createImpactBurstTrigger(
  timelineTimestampMs: number,
  ballEntityId: string,
  enemyEntityId: string,
  x: number,
  y: number,
  damage: bigint
): TriggerEvent {
  return {
    kind: "TRIGGER",
    timelineTimestampMs,
    placement: "WORLD",
    triggerKind: "IMPACT_BURST",
    entityId: ballEntityId,
    targetEntityId: enemyEntityId,
    x,
    y,
    detail: {
      damage: damage.toString()
    }
  };
}

/** Builds a deterministic playback trigger for a combo milestone. */
function createComboMilestoneTrigger(
  timelineTimestampMs: number,
  ballEntityId: string,
  enemyEntityId: string,
  x: number,
  y: number,
  comboAfter: number
): TriggerEvent {
  return {
    kind: "TRIGGER",
    timelineTimestampMs,
    placement: "WORLD",
    triggerKind: "COMBO_MILESTONE",
    entityId: ballEntityId,
    targetEntityId: enemyEntityId,
    x,
    y,
    detail: {
      comboAfter,
      comboThreshold: comboAfter
    }
  };
}

/** Builds a deterministic playback trigger for the run finisher beat. */
function createRunFinisherTrigger(durationMs: number, ballEntityId: string): TriggerEvent {
  return {
    kind: "TRIGGER",
    timelineTimestampMs: Math.max(durationMs - PLAYBACK_FINISHER_LEAD_MS, 0),
    placement: "UI",
    triggerKind: "RUN_FINISHER",
    entityId: ballEntityId
  };
}

/** Builds heading-driven deterministic ball path, collision, damage, and sparse trigger events in normalized space. */
function createMotionTimeline(seed: string, entities: PlaybackEntity[], durationMs: number, hits: SimulatedHit[]): PlaybackEvent[] {
  const ballEntity = entities.find((entity) => entity.kind === "BALL");
  const enemyEntities = entities.filter((entity): entity is EnemyTarget => entity.kind === "ENEMY");
  const obstacleEntities = entities.filter((entity): entity is ObstacleTarget => entity.kind === "OBSTACLE");

  if (!ballEntity || enemyEntities.length === 0 || durationMs <= 0 || hits.length === 0) {
    return [];
  }

  const enemySequence = createEnemySequence(seed, enemyEntities);
  const enemySequenceOrder = new Map(enemySequence.map((enemy, index) => [enemy.id, index]));
  const steps: MotionStep[] = [];
  let currentPoint = {
    x: ballEntity.spawnX,
    y: ballEntity.spawnY
  };
  const firstEnemy = enemySequence[0];
  let currentDirection = normalizeVector(
    (firstEnemy?.spawnX ?? 0.5) >= ballEntity.spawnX ? 0.42 : -0.42,
    -1,
    { x: 0.42, y: -1 }
  );
  const maxSteps = hits.length * 16;

  for (let hitIndex = 0; hitIndex < hits.length && steps.length < maxSteps; ) {
    const wallCollision = getWallCollision(currentPoint, currentDirection);
    const circularCollision = getCircularCollision(
      currentPoint,
      currentDirection,
      [...enemyEntities, ...obstacleEntities],
      enemySequenceOrder
    );
    const firstCollision = circularCollision && circularCollision.distance < wallCollision.distance
      ? circularCollision
      : wallCollision;

    steps.push({
      from: currentPoint,
      to: {
        x: firstCollision.x,
        y: firstCollision.y
      },
      collision: firstCollision,
      hit: "enemy" in firstCollision ? hits[hitIndex] : undefined
    });

    currentPoint = {
      x: firstCollision.x,
      y: firstCollision.y
    };
    const reflectedDirection = reflectDirection(currentDirection, firstCollision.normal);
    currentDirection = "targetEntityId" in firstCollision
      ? tuneWallReboundDirection(reflectedDirection, firstCollision.normal)
      : reflectedDirection;

    if ("enemy" in firstCollision) {
      hitIndex += 1;
    }
  }

  if (steps.length >= maxSteps && steps.filter((step) => "enemy" in step.collision).length < hits.length) {
    throw new Error("Playback motion exceeded deterministic step budget before resolving enemy hits");
  }

  if (steps.length === 0) {
    return [];
  }

  const segmentDurationMs = Math.max(Math.floor(durationMs / steps.length), 1);
  const events: PlaybackEvent[] = [];

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    const segmentStart = stepIndex * segmentDurationMs;
    const segmentEnd = stepIndex === steps.length - 1 ? durationMs : Math.min(segmentStart + segmentDurationMs, durationMs);

    events.push({
      kind: "BALL_PATH",
      timelineStartMs: segmentStart,
      timelineEndMs: segmentEnd,
      entityId: ballEntity.id,
      fromX: step.from.x,
      fromY: step.from.y,
      toX: step.to.x,
      toY: step.to.y
    });

    if ("enemy" in step.collision) {
      events.push(
        {
          kind: "COLLISION",
          timelineTimestampMs: segmentEnd,
          sourceEntityId: ballEntity.id,
          targetEntityId: step.collision.enemy.id,
          collisionKind: "BALL_ENEMY",
          x: step.to.x,
          y: step.to.y
        },
        {
          kind: "DAMAGE",
          timelineTimestampMs: segmentEnd,
          sourceEntityId: ballEntity.id,
          targetEntityId: step.collision.enemy.id,
          x: step.to.x,
          y: step.to.y,
          damage: step.hit?.damage.toString() ?? "0",
          comboAfter: step.hit?.comboAfter ?? 0,
          isCrit: step.hit?.isCrit ?? false
        },
        createImpactBurstTrigger(
          segmentEnd,
          ballEntity.id,
          step.collision.enemy.id,
          step.to.x,
          step.to.y,
          step.hit?.damage ?? 0n
        )
      );

      if (step.hit && PLAYBACK_COMBO_MILESTONE_THRESHOLDS.has(step.hit.comboAfter)) {
        events.push(
          createComboMilestoneTrigger(
            segmentEnd,
            ballEntity.id,
            step.collision.enemy.id,
            step.to.x,
            step.to.y,
            step.hit.comboAfter
          )
        );
      }
    } else {
      events.push({
        kind: "COLLISION",
        timelineTimestampMs: segmentEnd,
        sourceEntityId: ballEntity.id,
        targetEntityId: "obstacle" in step.collision ? step.collision.obstacle.id : step.collision.targetEntityId,
        collisionKind: "obstacle" in step.collision ? "BALL_OBSTACLE" : "BALL_WALL",
        x: step.to.x,
        y: step.to.y
      });
    }
  }

  return events;
}

/** Builds the minimal deterministic playback payload for a simulated run. */
function createPlayback(seed: string, durationMs: number, hits: SimulatedHit[]): RunPlayback {
  const entities = createPlaybackEntities(seed);
  const motionEvents = createMotionTimeline(seed, entities, durationMs, hits);
  const phaseEvents: PhaseEvent[] = [
    {
      kind: "PHASE",
      timelineTimestampMs: 0,
      phase: "RUN_START"
    },
    {
      kind: "PHASE",
      timelineTimestampMs: durationMs,
      phase: "FINISH"
    }
  ];
  const runFinisherEvent = createRunFinisherTrigger(durationMs, "ball-1");
  const events = [phaseEvents[0], ...motionEvents, phaseEvents[1]];
  const finisherInsertIndex = events.findIndex((event) => getPlaybackEventTime(event) > runFinisherEvent.timelineTimestampMs);

  if (finisherInsertIndex === -1) {
    events.splice(events.length - 1, 0, runFinisherEvent);
  } else {
    events.splice(finisherInsertIndex, 0, runFinisherEvent);
  }

  const playback: RunPlayback = {
    durationMs,
    arena: {
      width: 1,
      height: 1,
      zones: []
    },
    entities,
    events
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
