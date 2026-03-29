import { GAME_CONFIG } from "../config/index.js";
import type {
  ArenaBoundarySegment,
  ArenaSnapshot,
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
const PLAYFIELD_BOTTOM_EXCLUSION_START_Y = GAME_CONFIG.run.playfieldBottomExclusionStartY;
const ENEMY_PLACEMENT_PADDING = GAME_CONFIG.run.enemyPlacementPadding;
const MAX_PLACEMENT_RETRIES = GAME_CONFIG.run.maxPlacementRetries;
const MIXED_PLACEMENT_PADDING = GAME_CONFIG.run.mixedPlacementPadding;
const OBSTACLE_PLACEMENT_PADDING = GAME_CONFIG.run.obstaclePlacementPadding;
const PLAYFIELD_PLACEMENT_INSET = GAME_CONFIG.run.playfieldPlacementInset;
const PLAYBACK_WALL_REBOUND_MAX_NORMAL_COMPONENT = GAME_CONFIG.run.playbackWallReboundMaxNormalComponent;
const PLAYBACK_WALL_REBOUND_MIN_NORMAL_COMPONENT = GAME_CONFIG.run.playbackWallReboundMinNormalComponent;
const SPEED_SCALE = GAME_CONFIG.run.speedScale;
const CONTAINER_TOP_WALL_ID = "container-wall-top";
const CONTAINER_BOTTOM_WALL_ID = "container-wall-bottom";

type SimulatedHit = {
  damage: bigint;
  comboAfter: number;
  isCrit: boolean;
  timestampMs: number;
};

type EnemyTarget = PlaybackEntity & { kind: "ENEMY" };
type ObstacleTarget = PlaybackEntity & { kind: "OBSTACLE" };
type CircularTarget = EnemyTarget | ObstacleTarget;
type CircularPlacementEntity = PlaybackEntity & { collision: { type: "CIRCLE"; radius: number } };
type PlacementSpec = {
  id: string;
  kind: "ENEMY" | "OBSTACLE";
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  presentation: ReturnType<typeof createPresentation>;
};
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

/** Creates shared presentation metadata for a playback entity. */
function createPresentation(assetId: string, rotationDegrees?: number, scale?: number) {
  return {
    assetId,
    rotationDegrees,
    scale
  };
}

/** Creates a local circle collision shape anchored at the entity origin. */
function createCircleCollision(radius: number) {
  return {
    type: "CIRCLE" as const,
    offsetX: 0,
    offsetY: 0,
    radius
  };
}

/** Builds the closed edge loop for the authored playfield polygon. */
function createBoundaryEdges(points: ArenaSnapshot["playfieldBoundary"]["points"]): Array<{ from: Point; to: Point }> {
  return points.map((point, index) => ({
    from: point,
    to: points[(index + 1) % points.length] ?? points[0]!
  }));
}

/** Returns the shortest distance from a point to a finite line segment. */
function getDistanceToSegment(point: Point, segmentStart: Point, segmentEnd: Point): number {
  const segmentDeltaX = segmentEnd.x - segmentStart.x;
  const segmentDeltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY;

  if (segmentLengthSquared <= Number.EPSILON) {
    return getVectorLength(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const interpolation = Math.min(
    Math.max(
      ((point.x - segmentStart.x) * segmentDeltaX + (point.y - segmentStart.y) * segmentDeltaY) / segmentLengthSquared,
      0
    ),
    1
  );
  const closestPoint = {
    x: segmentStart.x + segmentDeltaX * interpolation,
    y: segmentStart.y + segmentDeltaY * interpolation
  };

  return getVectorLength(point.x - closestPoint.x, point.y - closestPoint.y);
}

/** Returns true when a point lies inside the closed authored playfield polygon. */
function isPointInsidePlayfield(point: Point, boundaryPoints: ArenaSnapshot["playfieldBoundary"]["points"]): boolean {
  let inside = false;

  for (let index = 0, previousIndex = boundaryPoints.length - 1; index < boundaryPoints.length; previousIndex = index, index += 1) {
    const currentPoint = boundaryPoints[index]!;
    const previousPoint = boundaryPoints[previousIndex]!;
    const intersects =
      (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          ((previousPoint.y - currentPoint.y) || Number.EPSILON) +
          currentPoint.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/** Extracts a circle collision radius from a playback entity when present. */
function getCircleCollisionRadius(entity: PlaybackEntity): number | null {
  return entity.collision?.type === "CIRCLE" ? entity.collision.radius : null;
}

/** Returns true when a circular placement candidate is inside the playfield with the configured deadzone. */
function isPlacementInsidePlayfield(
  point: Point,
  radius: number,
  boundary: ArenaSnapshot["playfieldBoundary"]
): boolean {
  if (point.y + radius > PLAYFIELD_BOTTOM_EXCLUSION_START_Y + Number.EPSILON) {
    return false;
  }

  if (!isPointInsidePlayfield(point, boundary.points)) {
    return false;
  }

  const minimumBoundaryDistance = radius + PLAYFIELD_PLACEMENT_INSET;
  const closestBoundaryDistance = createBoundaryEdges(boundary.points).reduce((closestDistance, edge) => (
    Math.min(closestDistance, getDistanceToSegment(point, edge.from, edge.to))
  ), Number.POSITIVE_INFINITY);

  return closestBoundaryDistance >= minimumBoundaryDistance - Number.EPSILON;
}

/** Returns the configured placement padding for a pair of circular entity kinds. */
function getPlacementPadding(
  candidateKind: CircularPlacementEntity["kind"],
  existingKind: CircularPlacementEntity["kind"]
): number {
  if (candidateKind === "ENEMY" && existingKind === "ENEMY") {
    return ENEMY_PLACEMENT_PADDING;
  }

  if (candidateKind === "OBSTACLE" && existingKind === "OBSTACLE") {
    return OBSTACLE_PLACEMENT_PADDING;
  }

  return MIXED_PLACEMENT_PADDING;
}

/** Returns true when a circular placement candidate is sufficiently separated from existing entities. */
function hasValidPlacementSpacing(
  point: Point,
  kind: CircularPlacementEntity["kind"],
  radius: number,
  placedEntities: CircularPlacementEntity[]
): boolean {
  return placedEntities.every((entity) => {
    const existingRadius = getCircleCollisionRadius(entity);

    if (existingRadius === null) {
      return true;
    }

    const minimumDistance = radius + existingRadius + getPlacementPadding(kind, entity.kind);
    const actualDistance = getVectorLength(point.x - entity.spawnX, point.y - entity.spawnY);

    return actualDistance >= minimumDistance - Number.EPSILON;
  });
}

/** Builds a deterministic candidate point inside the authored range for the provided attempt index. */
function createPlacementCandidate(
  spec: PlacementSpec,
  nextRandom: () => number,
  attemptIndex: number
): Point {
  if (attemptIndex < MAX_PLACEMENT_RETRIES) {
    return {
      x: normalizePosition(nextRandom, spec.minX, spec.maxX),
      y: normalizePosition(nextRandom, spec.minY, spec.maxY)
    };
  }

  const fallbackPatterns = [
    { x: 0.5, y: 0.5 },
    { x: 0.35, y: 0.35 },
    { x: 0.65, y: 0.35 },
    { x: 0.35, y: 0.65 },
    { x: 0.65, y: 0.65 },
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.8 },
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 }
  ];
  const fallback = fallbackPatterns[(attemptIndex - MAX_PLACEMENT_RETRIES) % fallbackPatterns.length]!;

  return {
    x: spec.minX + (spec.maxX - spec.minX) * fallback.x,
    y: spec.minY + (spec.maxY - spec.minY) * fallback.y
  };
}

/** Resolves a deterministic, valid circular placement for an enemy or obstacle within the shaped playfield. */
function resolveCircularPlacement(
  spec: PlacementSpec,
  nextRandom: () => number,
  boundary: ArenaSnapshot["playfieldBoundary"],
  placedEntities: CircularPlacementEntity[]
): CircularPlacementEntity {
  const radius = PLAYBACK_ENEMY_COLLISION_RADIUS;
  const maxFallbackAttempts = MAX_PLACEMENT_RETRIES + 9;

  for (let attemptIndex = 0; attemptIndex < maxFallbackAttempts; attemptIndex += 1) {
    const candidate = createPlacementCandidate(spec, nextRandom, attemptIndex);

    if (
      isPlacementInsidePlayfield(candidate, radius, boundary) &&
      hasValidPlacementSpacing(candidate, spec.kind, radius, placedEntities)
    ) {
      return {
        id: spec.id,
        kind: spec.kind,
        spawnX: candidate.x,
        spawnY: candidate.y,
        presentation: spec.presentation,
        collision: createCircleCollision(radius)
      };
    }
  }

  throw new Error(`Unable to resolve deterministic playback placement for ${spec.id}`);
}

/** Builds the deterministic entity layout for the run playback snapshot. */
function createPlaybackEntities(seed: string): PlaybackEntity[] {
  const playfieldBoundary = createPlayfieldBoundary();
  const nextRandom = createSeededRng(`${seed}:playback-layout`);
  const placedCircularEntities: CircularPlacementEntity[] = [];
  const obstacleSpecs: PlacementSpec[] = [
    {
      id: "obstacle-1",
      kind: "OBSTACLE",
      minX: 0.18,
      maxX: 0.26,
      minY: 0.26,
      maxY: 0.34,
      presentation: createPresentation("bumper-round-silver", -18, 1)
    },
    {
      id: "obstacle-2",
      kind: "OBSTACLE",
      minX: 0.68,
      maxX: 0.76,
      minY: 0.4,
      maxY: 0.5,
      presentation: createPresentation("bumper-round-silver", 16, 1.08)
    },
    {
      id: "obstacle-3",
      kind: "OBSTACLE",
      minX: 0.56,
      maxX: 0.68,
      minY: 0.54,
      maxY: 0.64,
      presentation: createPresentation("bumper-round-silver", 28, 1.02)
    }
  ];
  const enemySpecs: PlacementSpec[] = [
    {
      id: "enemy-1",
      kind: "ENEMY",
      minX: 0.24,
      maxX: 0.34,
      minY: 0.14,
      maxY: 0.2,
      presentation: createPresentation("enemy-orb-red", -8, 1)
    },
    {
      id: "enemy-2",
      kind: "ENEMY",
      minX: 0.66,
      maxX: 0.78,
      minY: 0.24,
      maxY: 0.34,
      presentation: createPresentation("enemy-orb-red", 12, 1.02)
    },
    {
      id: "enemy-3",
      kind: "ENEMY",
      minX: 0.52,
      maxX: 0.7,
      minY: 0.42,
      maxY: 0.54,
      presentation: createPresentation("enemy-orb-red", 4, 1.04)
    },
    {
      id: "enemy-4",
      kind: "ENEMY",
      minX: 0.42,
      maxX: 0.58,
      minY: 0.58,
      maxY: 0.7,
      presentation: createPresentation("enemy-orb-red", -14, 0.98)
    }
  ];
  const obstacles = obstacleSpecs.map((spec) => {
    const obstacle = resolveCircularPlacement(spec, nextRandom, playfieldBoundary, placedCircularEntities);

    placedCircularEntities.push(obstacle);
    return obstacle;
  });
  const enemies = enemySpecs.map((spec) => {
    const enemy = resolveCircularPlacement(spec, nextRandom, playfieldBoundary, placedCircularEntities);

    placedCircularEntities.push(enemy);
    return enemy;
  });

  return [
    {
      id: "ball-1",
      kind: "BALL",
      spawnX: 0.52,
      spawnY: 0.9,
      presentation: createPresentation("ball-default", 0, 1),
      collision: createCircleCollision(0.02)
    },
    ...obstacles,
    ...enemies
  ];
}

/** Creates the authored inner playfield boundary used as the true gameplay wall. */
function createPlayfieldBoundary(): ArenaSnapshot["playfieldBoundary"] {
  const points = [
    { x: 0.08, y: 0 },
    { x: 0.92, y: 0 },
    { x: 0.88, y: 0.42 },
    { x: 0.78, y: 1 },
    { x: 0.22, y: 1 },
    { x: 0.12, y: 0.42 }
  ];
  const leftWallPoints = [points[4], points[5], points[0]];
  const rightWallPoints = [points[1], points[2], points[3]];
  const segments: ArenaBoundarySegment[] = [
    ...leftWallPoints.slice(0, -1).map((point, index) => {
      const nextPoint = leftWallPoints[index + 1];

      return {
        id: `playfield-wall-left-${index + 1}`,
        fromX: point.x,
        fromY: point.y,
        toX: nextPoint.x,
        toY: nextPoint.y
      };
    }),
    ...rightWallPoints.slice(0, -1).map((point, index) => {
      const nextPoint = rightWallPoints[index + 1];

      return {
        id: `playfield-wall-right-${index + 1}`,
        fromX: point.x,
        fromY: point.y,
        toX: nextPoint.x,
        toY: nextPoint.y
      };
    })
  ];

  return {
    points,
    segments
  };
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
  const clampedNormalComponent = Math.min(
    Math.max(Math.abs(reflectedDirection.x * wallNormal.x + reflectedDirection.y * wallNormal.y), minNormalComponent),
    maxNormalComponent
  );
  const tangent = normalizeVector(-wallNormal.y, wallNormal.x, { x: 1, y: 0 });
  const tangentDot = reflectedDirection.x * tangent.x + reflectedDirection.y * tangent.y;
  const tangentMagnitude = Math.sqrt(Math.max(1 - clampedNormalComponent * clampedNormalComponent, 0));
  const tangentSign = tangentDot < 0 ? -1 : 1;

  return normalizeVector(
    wallNormal.x * clampedNormalComponent + tangent.x * tangentSign * tangentMagnitude,
    wallNormal.y * clampedNormalComponent + tangent.y * tangentSign * tangentMagnitude,
    reflectedDirection
  );
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

/** Computes the first collision against the authored inner playfield boundary. */
function getPlayfieldBoundaryCollision(
  start: Point,
  direction: Point,
  boundarySegments: ArenaBoundarySegment[]
): WallCollision | null {
  const collisions: WallCollision[] = [];

  for (const segment of boundarySegments) {
    const segmentVector = {
      x: segment.toX - segment.fromX,
      y: segment.toY - segment.fromY
    };
    const cross = direction.x * segmentVector.y - direction.y * segmentVector.x;

    if (Math.abs(cross) <= Number.EPSILON) {
      continue;
    }

    const toSegmentStart = {
      x: segment.fromX - start.x,
      y: segment.fromY - start.y
    };
    const distance = (toSegmentStart.x * segmentVector.y - toSegmentStart.y * segmentVector.x) / cross;
    const segmentInterpolation = (toSegmentStart.x * direction.y - toSegmentStart.y * direction.x) / cross;

    if (distance <= Number.EPSILON || segmentInterpolation < 0 || segmentInterpolation > 1) {
      continue;
    }

    const contactPoint = {
      x: clampNormalized(start.x + direction.x * distance),
      y: clampNormalized(start.y + direction.y * distance)
    };
    const normal = normalizeVector(-segmentVector.y, segmentVector.x, { x: 0, y: -1 });

    collisions.push({
      x: contactPoint.x,
      y: contactPoint.y,
      normal,
      targetEntityId: segment.id,
      distance
    });
  }

  const firstCollision = collisions.reduce<WallCollision | null>((closest, candidate) => {
    if (
      !closest ||
      candidate.distance < closest.distance - Number.EPSILON ||
      (
        Math.abs(candidate.distance - closest.distance) <= Number.EPSILON &&
        candidate.targetEntityId.localeCompare(closest.targetEntityId) < 0
      )
    ) {
      return candidate;
    }

    return closest;
  }, null);

  return firstCollision;
}

/** Computes the first collision against the container top or bottom boundary. */
function getContainerBoundaryCollision(start: Point, direction: Point): WallCollision | null {
  if (Math.abs(direction.y) <= Number.EPSILON) {
    return null;
  }

  const targetY = direction.y < 0 ? 0 : 1;
  const distance = (targetY - start.y) / direction.y;

  if (distance <= Number.EPSILON) {
    return null;
  }

  const contactX = start.x + direction.x * distance;

  if (contactX < -Number.EPSILON || contactX > 1 + Number.EPSILON) {
    return null;
  }

  return {
    x: clampNormalized(contactX),
    y: targetY,
    normal: direction.y < 0 ? { x: 0, y: 1 } : { x: 0, y: -1 },
    targetEntityId: direction.y < 0 ? CONTAINER_TOP_WALL_ID : CONTAINER_BOTTOM_WALL_ID,
    distance
  };
}

/** Chooses the nearest deterministic wall collision from side rails and container top/bottom. */
function getWallCollision(
  start: Point,
  direction: Point,
  boundarySegments: ArenaBoundarySegment[]
): WallCollision {
  const playfieldBoundaryCollision = getPlayfieldBoundaryCollision(start, direction, boundarySegments);
  const containerBoundaryCollision = getContainerBoundaryCollision(start, direction);
  const collisions = [playfieldBoundaryCollision, containerBoundaryCollision]
    .filter((collision): collision is WallCollision => collision !== null);

  const firstCollision = collisions.reduce<WallCollision | null>((closest, candidate) => {
    if (
      !closest ||
      candidate.distance < closest.distance - Number.EPSILON ||
      (
        Math.abs(candidate.distance - closest.distance) <= Number.EPSILON &&
        candidate.targetEntityId.localeCompare(closest.targetEntityId) < 0
      )
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
  const boundarySegmentIds = new Set(playback.arena.playfieldBoundary.segments.map((segment) => segment.id));
  const wallIds = new Set([CONTAINER_TOP_WALL_ID, CONTAINER_BOTTOM_WALL_ID, ...boundarySegmentIds]);
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
      const hasValidTargetEntity = event.kind === "COLLISION" && event.collisionKind === "BALL_WALL"
        ? wallIds.has(event.targetEntityId)
        : entityIds.has(event.targetEntityId);

      if (!entityIds.has(event.sourceEntityId) || !hasValidTargetEntity) {
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
function createMotionTimeline(
  seed: string,
  entities: PlaybackEntity[],
  durationMs: number,
  hits: SimulatedHit[],
  arena: ArenaSnapshot
): PlaybackEvent[] {
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
    const boundaryCollision = getWallCollision(
      currentPoint,
      currentDirection,
      arena.playfieldBoundary.segments
    );
    const circularCollision = getCircularCollision(
      currentPoint,
      currentDirection,
      [...enemyEntities, ...obstacleEntities],
      enemySequenceOrder
    );
    const firstCollision = circularCollision && circularCollision.distance < boundaryCollision.distance
      ? circularCollision
      : boundaryCollision;

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
  const arena: ArenaSnapshot = {
    width: 1,
    height: 1,
    zones: [],
    playfieldBoundary: createPlayfieldBoundary()
  };
  const motionEvents = createMotionTimeline(seed, entities, durationMs, hits, arena);
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
    arena,
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
