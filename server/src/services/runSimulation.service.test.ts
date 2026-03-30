import assert from "node:assert/strict";
import test from "node:test";

import { GAME_CONFIG } from "../config/index.js";
import { determineRunEndReason, simulateRun } from "./runSimulation.service.js";
import type { PlaybackEvent, RunInput } from "../utils/runTypes.js";

const CONTAINER_TOP_WALL_ID = "container-wall-top";
const CONTAINER_BOTTOM_WALL_ID = "container-wall-bottom";

function createRunInput(overrides: Partial<RunInput> = {}): RunInput {
  return {
    playerId: "player-1",
    nowMs: 1_000,
    seed: "seed-123",
    runDurationMs: 10_000,
    combatStats: {
      power: "1000",
      speed: 1,
      critChance: 2_500
    },
    ...overrides
  };
}

function getPlaybackEventTime(event: PlaybackEvent): number {
  return event.kind === "BALL_PATH" ? event.timelineStartMs : event.timelineTimestampMs;
}

function getPathDirection(event: Extract<PlaybackEvent, { kind: "BALL_PATH" }>) {
  const deltaX = event.toX - event.fromX;
  const deltaY = event.toY - event.fromY;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  return {
    x: deltaX / length,
    y: deltaY / length
  };
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getActiveFlipperAxis(flipperId: string) {
  const angleRadians = degreesToRadians(GAME_CONFIG.run.playbackFlipperActiveAngleDegrees);
  const horizontalDirection = Math.cos(angleRadians);
  const verticalDirection = Math.sin(angleRadians) * -1;

  return flipperId === "flipper-left"
    ? { x: horizontalDirection, y: verticalDirection }
    : { x: horizontalDirection * -1, y: verticalDirection };
}

function getFlipperBasePoint(flipper: { id: string; spawnX: number; spawnY: number; collision?: { type: string; width?: number } }) {
  const axis = getActiveFlipperAxis(flipper.id);
  const halfWidth = (flipper.collision?.type === "BOX" ? flipper.collision.width ?? 0 : 0) / 2;

  return {
    x: flipper.spawnX - axis.x * halfWidth,
    y: flipper.spawnY - axis.y * halfWidth
  };
}

function getFlipperContactRatio(
  flipper: { id: string; spawnX: number; spawnY: number; collision?: { type: string; width?: number } },
  contactPoint: { x: number; y: number }
): number {
  const axis = getActiveFlipperAxis(flipper.id);
  const basePoint = getFlipperBasePoint(flipper);
  const width = flipper.collision?.type === "BOX" ? flipper.collision.width ?? 0 : 0;
  const projectedDistance = (contactPoint.x - basePoint.x) * axis.x + (contactPoint.y - basePoint.y) * axis.y;

  return Math.min(Math.max(projectedDistance / Math.max(width, Number.EPSILON), 0), 1);
}

function isPointInsidePolygon(point: { x: number; y: number }, polygonPoints: Array<{ x: number; y: number }>): boolean {
  let inside = false;

  for (let index = 0, previousIndex = polygonPoints.length - 1; index < polygonPoints.length; previousIndex = index, index += 1) {
    const currentPoint = polygonPoints[index]!;
    const previousPoint = polygonPoints[previousIndex]!;
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

function getDistanceToSegment(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number }
): number {
  const segmentDeltaX = segmentEnd.x - segmentStart.x;
  const segmentDeltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY;

  if (segmentLengthSquared <= Number.EPSILON) {
    return Math.sqrt((point.x - segmentStart.x) ** 2 + (point.y - segmentStart.y) ** 2);
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

  return Math.sqrt((point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2);
}

test("simulateRun is deterministic for the same input and seed", () => {
  const input = createRunInput();

  assert.deepEqual(simulateRun(input), simulateRun(input));
});

test("determineRunEndReason supports the current and future-safe run completion reasons", () => {
  assert.equal(
    determineRunEndReason({
      targetComboCount: 10,
      comboCount: 10,
      totalEnemyCount: 4,
      defeatedEnemyCount: 0,
      validScoringTargetCount: 4
    }),
    "TARGET_COMBO_REACHED"
  );
  assert.equal(
    determineRunEndReason({
      targetComboCount: 10,
      comboCount: 6,
      totalEnemyCount: 4,
      defeatedEnemyCount: 4,
      validScoringTargetCount: 0
    }),
    "ALL_ENEMIES_DEFEATED"
  );
  assert.equal(
    determineRunEndReason({
      targetComboCount: 10,
      comboCount: 3,
      totalEnemyCount: 4,
      defeatedEnemyCount: 1,
      validScoringTargetCount: 0
    }),
    "NO_VALID_TARGETS"
  );
  assert.equal(
    determineRunEndReason({
      targetComboCount: 10,
      comboCount: 3,
      totalEnemyCount: 4,
      defeatedEnemyCount: 1,
      validScoringTargetCount: 2
    }),
    null
  );
});

test("simulateRun changes output when the seed changes", () => {
  const baseInput = createRunInput();
  const changedSeedInput = createRunInput({ seed: "seed-456" });

  assert.notDeepEqual(simulateRun(baseInput), simulateRun(changedSeedInput));
});

test("simulateRun increments combo and tracks a trigger for every hit", () => {
  const result = simulateRun(createRunInput());

  assert.equal(result.comboCount, 10);
  assert.equal(result.endReason, "TARGET_COMBO_REACHED");
  assert.ok(result.triggers.filter((trigger) => trigger.type === "hit" || trigger.type === "critical-hit").length === 10);
  assert.equal(result.durationMs, result.playback.durationMs);
  assert.ok(result.durationMs >= GAME_CONFIG.run.playbackMinDurationMs);
  assert.ok(result.durationMs <= GAME_CONFIG.run.playbackMaxDurationMs);
  assert.deepEqual(result.playback.arena, {
    width: 1,
    height: 1,
    zones: [],
    playfieldBoundary: result.playback.arena.playfieldBoundary
  });
  assert.equal(result.playback.entities.length, 10);
  assert.deepEqual(result.playback.entities[0], {
    id: "ball-1",
    kind: "BALL",
    spawnX: 0.52,
    spawnY: 0.9,
    presentation: {
      assetId: "ball-default",
      rotationDegrees: 0,
      scale: 1
    },
    collision: {
      type: "CIRCLE",
      offsetX: 0,
      offsetY: 0,
      radius: 0.02
    }
  });
  const enemyEntities = result.playback.entities.filter((entity) => entity.kind === "ENEMY");
  const obstacleEntities = result.playback.entities.filter((entity) => entity.kind === "OBSTACLE");
  const flipperEntities = result.playback.entities.filter((entity) => entity.kind === "ARENA");
  const boundarySegments = result.playback.arena.playfieldBoundary.segments;
  const boundaryPoints = result.playback.arena.playfieldBoundary.points;
  assert.equal(enemyEntities.length, 4);
  assert.equal(obstacleEntities.length, 3);
  assert.equal(flipperEntities.length, 2);
  assert.equal(boundarySegments.length, 4);
  assert.equal(boundaryPoints.length, 6);
  assert.ok(enemyEntities.every((entity) => entity.spawnX >= 0 && entity.spawnX <= 1));
  assert.ok(enemyEntities.every((entity) => entity.spawnY >= 0 && entity.spawnY <= 1));
  assert.ok(obstacleEntities.every((entity) => entity.spawnX >= 0 && entity.spawnX <= 1));
  assert.ok(obstacleEntities.every((entity) => entity.spawnY >= 0 && entity.spawnY <= 1));
  assert.ok(enemyEntities.every((entity) => entity.presentation?.assetId === "enemy-orb-red"));
  assert.ok(enemyEntities.every((entity) => entity.collision?.type === "CIRCLE"));
  assert.ok(enemyEntities.every((entity) => entity.collision?.type !== "CIRCLE" || entity.collision.radius === GAME_CONFIG.run.playbackEnemyCollisionRadius));
  assert.ok(obstacleEntities.every((entity) => entity.presentation?.assetId === "bumper-round-silver"));
  assert.ok(obstacleEntities.every((entity) => entity.collision?.type === "CIRCLE"));
  assert.ok(flipperEntities.every((entity) => entity.presentation?.assetId === "flipper-left" || entity.presentation?.assetId === "flipper-right"));
  assert.ok(flipperEntities.every((entity) => entity.collision?.type === "BOX"));
  assert.ok(
    boundarySegments.every(
      (segment) =>
        segment.id.startsWith("playfield-wall-left-") || segment.id.startsWith("playfield-wall-right-")
    )
  );
  assert.deepEqual(boundaryPoints[0], { x: 0.08, y: 0 });
  assert.deepEqual(boundaryPoints[1], { x: 0.92, y: 0 });
  assert.deepEqual(boundaryPoints[2], { x: 0.88, y: 0.42 });
  assert.deepEqual(boundaryPoints[3], { x: 0.78, y: 1 });
  assert.deepEqual(boundaryPoints[4], { x: 0.22, y: 1 });
  assert.deepEqual(boundaryPoints[5], { x: 0.12, y: 0.42 });
  assert.ok(boundaryPoints[2]!.x < boundaryPoints[1]!.x);
  assert.ok(boundaryPoints[5]!.x > boundaryPoints[0]!.x);
  assert.ok(Math.abs(boundaryPoints[5]!.x - (1 - boundaryPoints[2]!.x)) < 0.000001);
  assert.equal(boundaryPoints[5]!.y, boundaryPoints[2]!.y);
  assert.ok(Math.abs(boundaryPoints[4]!.x - (1 - boundaryPoints[3]!.x)) < 0.000001);
  assert.ok(enemyEntities.some((entity) => entity.spawnX > 0.64 && entity.spawnY < 0.42));
  assert.ok(enemyEntities.some((entity) => entity.spawnX > 0.54 && entity.spawnY > 0.44 && entity.spawnY < 0.64));
  assert.ok(enemyEntities.some((entity) => entity.spawnX > 0.44 && entity.spawnX < 0.62 && entity.spawnY > 0.66 && entity.spawnY < 0.84));
  assert.ok(obstacleEntities.some((entity) => entity.spawnX < 0.3 && entity.spawnY > 0.22 && entity.spawnY < 0.38));
  assert.ok(obstacleEntities.some((entity) => entity.spawnX > 0.68 && entity.spawnY > 0.38 && entity.spawnY < 0.52));
  assert.ok(obstacleEntities.some((entity) => entity.spawnX > 0.58 && entity.spawnY > 0.52 && entity.spawnY < 0.68));
  assert.ok(enemyEntities.filter((entity) => entity.spawnX > 0.5).length >= 2);
  assert.ok(enemyEntities.every((entity) => entity.spawnY < 0.72));
  assert.ok(obstacleEntities.every((entity) => entity.spawnY < 0.68));
  const circularEntities = [...enemyEntities, ...obstacleEntities];
  const boundaryEdges = boundaryPoints.map((point, index) => ({
    from: point,
    to: boundaryPoints[(index + 1) % boundaryPoints.length] ?? boundaryPoints[0]!
  }));
  assert.ok(
    circularEntities.every((entity) => {
      if (entity.collision?.type !== "CIRCLE") {
        return false;
      }

      const point = { x: entity.spawnX, y: entity.spawnY };
      const minimumBoundaryDistance = entity.collision.radius + GAME_CONFIG.run.playfieldPlacementInset;
      const closestBoundaryDistance = boundaryEdges.reduce(
        (closestDistance, edge) => Math.min(closestDistance, getDistanceToSegment(point, edge.from, edge.to)),
        Number.POSITIVE_INFINITY
      );

      return (
        isPointInsidePolygon(point, boundaryPoints) &&
        point.y + entity.collision.radius <= GAME_CONFIG.run.playfieldBottomExclusionStartY + 0.000001 &&
        closestBoundaryDistance >= minimumBoundaryDistance - 0.000001
      );
    })
  );

  for (let index = 0; index < circularEntities.length; index += 1) {
    const currentEntity = circularEntities[index]!;
    const currentRadius = currentEntity.collision?.type === "CIRCLE" ? currentEntity.collision.radius : 0;

    for (let comparisonIndex = index + 1; comparisonIndex < circularEntities.length; comparisonIndex += 1) {
      const comparisonEntity = circularEntities[comparisonIndex]!;
      const comparisonRadius = comparisonEntity.collision?.type === "CIRCLE" ? comparisonEntity.collision.radius : 0;
      const minimumSeparation = currentRadius + comparisonRadius + (
        currentEntity.kind === "ENEMY" && comparisonEntity.kind === "ENEMY"
          ? GAME_CONFIG.run.enemyPlacementPadding
          : currentEntity.kind === "OBSTACLE" && comparisonEntity.kind === "OBSTACLE"
            ? GAME_CONFIG.run.obstaclePlacementPadding
            : GAME_CONFIG.run.mixedPlacementPadding
      );
      const actualSeparation = Math.sqrt(
        (currentEntity.spawnX - comparisonEntity.spawnX) * (currentEntity.spawnX - comparisonEntity.spawnX) +
        (currentEntity.spawnY - comparisonEntity.spawnY) * (currentEntity.spawnY - comparisonEntity.spawnY)
      );

      assert.ok(actualSeparation >= minimumSeparation - 0.000001);
    }
  }
  assert.equal(result.playback.events[0]?.kind, "PHASE");
  assert.deepEqual(result.playback.events[0], {
    kind: "PHASE",
    timelineTimestampMs: 0,
    phase: "RUN_START"
  });
  const finishEventIndex = result.playback.events.findIndex(
    (event) => event.kind === "PHASE" && event.phase === "FINISH"
  );
  assert.notEqual(finishEventIndex, -1);
  assert.deepEqual(result.playback.events[finishEventIndex], {
    kind: "PHASE",
    timelineTimestampMs: result.playback.durationMs,
    phase: "FINISH"
  });

  const ballPathEvents = result.playback.events.filter((event) => event.kind === "BALL_PATH");
  const collisionEvents = result.playback.events.filter((event) => event.kind === "COLLISION");
  const enemyCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_ENEMY");
  const obstacleCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_OBSTACLE");
  const flipperCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_FLIPPER");
  const wallCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_WALL");
  const damageEvents = result.playback.events.filter((event) => event.kind === "DAMAGE");
  const triggerEvents = result.playback.events.filter((event) => event.kind === "TRIGGER");
  assert.ok(ballPathEvents.length > collisionEvents.length);
  assert.equal(enemyCollisionEvents.length, 10);
  assert.ok(obstacleCollisionEvents.length >= 1);
  assert.ok(wallCollisionEvents.length >= 1);
  assert.ok(flipperCollisionEvents.length >= 1);
  assert.equal(damageEvents.length, 10);
  assert.ok(triggerEvents.length >= 13);
  assert.ok(
    ballPathEvents.every(
      (event) =>
        event.timelineStartMs >= 0 &&
        event.timelineEndMs <= result.playback.durationMs &&
        event.timelineStartMs < event.timelineEndMs
    )
  );
  assert.ok(ballPathEvents.every((event) => event.fromX >= 0 && event.fromX <= 1));
  assert.ok(ballPathEvents.every((event) => event.fromY >= 0 && event.fromY <= 1));
  assert.ok(ballPathEvents.every((event) => event.toX >= 0 && event.toX <= 1));
  assert.ok(ballPathEvents.every((event) => event.toY >= 0 && event.toY <= 1));
  assert.ok(collisionEvents.every((event) => event.x >= 0 && event.x <= 1));
  assert.ok(collisionEvents.every((event) => event.y >= 0 && event.y <= 1));
  assert.ok(collisionEvents.some((event) => event.collisionKind === "BALL_WALL"));
  assert.ok(collisionEvents.some((event) => event.collisionKind === "BALL_ENEMY"));
  assert.ok(collisionEvents.some((event) => event.collisionKind === "BALL_OBSTACLE"));
  assert.ok(collisionEvents.some((event) => event.collisionKind === "BALL_FLIPPER"));
  assert.ok(
    triggerEvents.every((event) => event.timelineTimestampMs >= 0 && event.timelineTimestampMs <= result.playback.durationMs)
  );
  assert.ok(new Set(enemyCollisionEvents.map((event) => event.targetEntityId)).size > 1);
  assert.ok(new Set(obstacleCollisionEvents.map((event) => event.targetEntityId)).size >= 1);
  assert.ok(new Set(flipperCollisionEvents.map((event) => event.targetEntityId)).size >= 1);
  assert.ok(new Set(damageEvents.map((event) => event.targetEntityId)).size > 1);
  assert.ok(new Set(wallCollisionEvents.map((event) => event.targetEntityId)).size >= 1);
  assert.ok(
    wallCollisionEvents.every(
      (event) =>
        event.targetEntityId === CONTAINER_TOP_WALL_ID ||
        event.targetEntityId === CONTAINER_BOTTOM_WALL_ID ||
        boundarySegments.some((segment) => segment.id === event.targetEntityId)
    )
  );
  assert.ok(
    wallCollisionEvents.some(
      (event) =>
        event.targetEntityId === CONTAINER_TOP_WALL_ID || event.targetEntityId === CONTAINER_BOTTOM_WALL_ID
    )
  );

  const impactBurstEvents = triggerEvents.filter((event) => event.triggerKind === "IMPACT_BURST");
  const comboMilestoneEvents = triggerEvents.filter((event) => event.triggerKind === "COMBO_MILESTONE");
  const enemyDefeatedEvents = triggerEvents.filter((event) => event.triggerKind === "ENEMY_DEFEATED");
  const runFinisherEvents = triggerEvents.filter((event) => event.triggerKind === "RUN_FINISHER");
  assert.equal(impactBurstEvents.length, 10);
  assert.equal(comboMilestoneEvents.length, 2);
  assert.equal(runFinisherEvents.length, 1);
  assert.ok(impactBurstEvents.every((event) => event.placement === "WORLD"));
  assert.ok(comboMilestoneEvents.every((event) => event.placement === "WORLD"));
  assert.ok(runFinisherEvents.every((event) => event.placement === "UI"));

  assert.deepEqual(
    damageEvents.map((event) => event.timelineTimestampMs),
    enemyCollisionEvents.map((event) => event.timelineTimestampMs)
  );
  assert.deepEqual(
    impactBurstEvents.map((event) => event.timelineTimestampMs),
    enemyCollisionEvents.map((event) => event.timelineTimestampMs)
  );
  assert.deepEqual(
    damageEvents.map((event) => event.comboAfter),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(
    damageEvents.reduce((total, event) => total + BigInt(event.damage), 0n).toString(),
    result.totalDamage
  );
  assert.ok(
    obstacleCollisionEvents.every((event) => obstacleEntities.some((entity) => entity.id === event.targetEntityId))
  );
  assert.ok(
    flipperCollisionEvents.every((event) => flipperEntities.some((entity) => entity.id === event.targetEntityId))
  );
  assert.ok(
    enemyCollisionEvents.every((event) => {
      const enemyEntity = enemyEntities.find((entity) => entity.id === event.targetEntityId);

      if (!enemyEntity) {
        return false;
      }

      const distanceToCenter = Math.sqrt(
        (event.x - enemyEntity.spawnX) * (event.x - enemyEntity.spawnX) +
        (event.y - enemyEntity.spawnY) * (event.y - enemyEntity.spawnY)
      );

      return Math.abs(distanceToCenter - GAME_CONFIG.run.playbackEnemyCollisionRadius) < 0.000001;
    })
  );
  assert.deepEqual(
    comboMilestoneEvents.map((event) => event.detail?.comboThreshold),
    [5, 10]
  );
  assert.equal(
    runFinisherEvents[0]?.timelineTimestampMs,
    result.playback.durationMs - GAME_CONFIG.run.playbackFinishBeatMs
  );
  assert.ok(
    enemyDefeatedEvents.every((event) => {
      if (!event.targetEntityId) {
        return false;
      }

      const defeatEventIndex = result.playback.events.findIndex((candidateEvent) => candidateEvent === event);
      const previousEvent = defeatEventIndex > 0 ? result.playback.events[defeatEventIndex - 1] : undefined;

      return previousEvent?.kind === "DAMAGE" && previousEvent.targetEntityId === event.targetEntityId;
    })
  );

  for (let index = 0; index < enemyCollisionEvents.length; index += 1) {
    const collisionEventIndex: number = result.playback.events.findIndex((event) => event === enemyCollisionEvents[index]);
    assert.notEqual(collisionEventIndex, -1);
    const previousEvent: PlaybackEvent | undefined = [...result.playback.events.slice(0, collisionEventIndex)]
      .reverse()
      .find((event) => event.kind === "BALL_PATH");
    const nextEvent: PlaybackEvent | undefined = result.playback.events
      .slice(collisionEventIndex + 1)
      .find((event) => event.kind === "BALL_PATH");
    assert.equal(previousEvent?.kind, "BALL_PATH");
    assert.equal(
      previousEvent?.kind === "BALL_PATH" ? previousEvent.timelineEndMs : undefined,
      enemyCollisionEvents[index]?.timelineTimestampMs
    );
    assert.equal(result.playback.events[collisionEventIndex + 1]?.kind, "DAMAGE");
    assert.equal(result.playback.events[collisionEventIndex + 2]?.kind, "TRIGGER");

    if (nextEvent?.kind === "BALL_PATH") {
      assert.equal(nextEvent.fromX, enemyCollisionEvents[index]?.x);
      assert.equal(nextEvent.fromY, enemyCollisionEvents[index]?.y);
    }
  }

  for (let index = 0; index < wallCollisionEvents.length; index += 1) {
    const collisionEventIndex = result.playback.events.findIndex((event) => event === wallCollisionEvents[index]);
    assert.notEqual(collisionEventIndex, -1);
    const previousEvent = [...result.playback.events.slice(0, collisionEventIndex)]
      .reverse()
      .find((event) => event.kind === "BALL_PATH");
    const nextEvent = result.playback.events
      .slice(collisionEventIndex + 1)
      .find((event) => event.kind === "BALL_PATH");

    assert.equal(previousEvent?.kind, "BALL_PATH");
    assert.equal(nextEvent?.kind, "BALL_PATH");
    assert.equal(
      previousEvent?.kind === "BALL_PATH" ? previousEvent.toX : undefined,
      wallCollisionEvents[index]?.x
    );
    assert.equal(
      previousEvent?.kind === "BALL_PATH" ? previousEvent.toY : undefined,
      wallCollisionEvents[index]?.y
    );
    assert.equal(
      nextEvent?.kind === "BALL_PATH" ? nextEvent.fromX : undefined,
      wallCollisionEvents[index]?.x
    );
    assert.equal(
      nextEvent?.kind === "BALL_PATH" ? nextEvent.fromY : undefined,
      wallCollisionEvents[index]?.y
    );

    if (nextEvent?.kind === "BALL_PATH") {
      const reboundDirection = getPathDirection(nextEvent);
      const boundarySegment = boundarySegments.find((segment) => segment.id === wallCollisionEvents[index]?.targetEntityId);
      const segmentNormal = boundarySegment
        ? (() => {
            const deltaX = boundarySegment.toX - boundarySegment.fromX;
            const deltaY = boundarySegment.toY - boundarySegment.fromY;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            return {
              x: -deltaY / length,
              y: deltaX / length
            };
          })()
        : wallCollisionEvents[index]?.targetEntityId === CONTAINER_TOP_WALL_ID
          ? { x: 0, y: 1 }
          : wallCollisionEvents[index]?.targetEntityId === CONTAINER_BOTTOM_WALL_ID
            ? { x: 0, y: -1 }
            : null;
      const normalComponent = segmentNormal
        ? Math.abs(reboundDirection.x * segmentNormal.x + reboundDirection.y * segmentNormal.y)
        : 0;

      assert.ok(normalComponent >= 0);
      assert.ok(normalComponent <= 1 + 0.000001);
    }
  }

  for (let index = 0; index < obstacleCollisionEvents.length; index += 1) {
    const collisionEventIndex = result.playback.events.findIndex((event) => event === obstacleCollisionEvents[index]);
    assert.notEqual(collisionEventIndex, -1);
    assert.notEqual(result.playback.events[collisionEventIndex + 1]?.kind, "DAMAGE");
  }

  for (let index = 0; index < flipperCollisionEvents.length; index += 1) {
    const collisionEventIndex = result.playback.events.findIndex((event) => event === flipperCollisionEvents[index]);
    assert.notEqual(collisionEventIndex, -1);
    const nextEvent = result.playback.events
      .slice(collisionEventIndex + 1)
      .find((event) => event.kind === "BALL_PATH");

    assert.equal(nextEvent?.kind, "BALL_PATH");

    if (nextEvent?.kind === "BALL_PATH") {
      const relaunchDirection = getPathDirection(nextEvent);
      const flipperEntity = flipperEntities.find((entity) => entity.id === flipperCollisionEvents[index]?.targetEntityId);
      const contactRatio = flipperEntity
        ? getFlipperContactRatio(flipperEntity, {
            x: flipperCollisionEvents[index]!.x,
            y: flipperCollisionEvents[index]!.y
          })
        : null;

      assert.ok(relaunchDirection.y < 0);
      assert.ok(relaunchDirection.y <= -0.88);
      assert.ok(Math.abs(relaunchDirection.x) <= 0.36);
      assert.ok(
        flipperCollisionEvents[index]?.targetEntityId === "flipper-left"
          ? relaunchDirection.x > 0
          : relaunchDirection.x < 0
      );
      assert.notEqual(contactRatio, null);
      assert.ok((contactRatio ?? -1) >= 0);
      assert.ok((contactRatio ?? 2) <= 1);
    }
  }

  for (const flipperId of ["flipper-left", "flipper-right"] as const) {
    const relaunchSamples = flipperCollisionEvents
      .map((event) => {
        const collisionEventIndex = result.playback.events.findIndex((candidateEvent) => candidateEvent === event);
        const nextPathEvent = result.playback.events
          .slice(collisionEventIndex + 1)
          .find((candidateEvent) => candidateEvent.kind === "BALL_PATH");
        const flipperEntity = flipperEntities.find((entity) => entity.id === event.targetEntityId);

        if (event.targetEntityId !== flipperId || !flipperEntity || nextPathEvent?.kind !== "BALL_PATH") {
          return null;
        }

        return {
          contactRatio: getFlipperContactRatio(flipperEntity, { x: event.x, y: event.y }),
          horizontalMagnitude: Math.abs(getPathDirection(nextPathEvent).x),
          upwardMagnitude: Math.abs(getPathDirection(nextPathEvent).y)
        };
      })
      .filter((sample): sample is { contactRatio: number; horizontalMagnitude: number; upwardMagnitude: number } => sample !== null)
      .sort((left, right) => left.contactRatio - right.contactRatio);

    for (let index = 1; index < relaunchSamples.length; index += 1) {
      if (relaunchSamples[index]!.contactRatio - relaunchSamples[index - 1]!.contactRatio <= 0.02) {
        continue;
      }

      assert.ok(
        relaunchSamples[index]!.horizontalMagnitude >= relaunchSamples[index - 1]!.horizontalMagnitude - 0.000001
      );
      assert.ok(
        relaunchSamples[index]!.upwardMagnitude <= relaunchSamples[index - 1]!.upwardMagnitude + 0.000001
      );
    }
  }

  const entityIds = new Set(result.playback.entities.map((entity) => entity.id));
  const boundarySegmentIds = new Set(result.playback.arena.playfieldBoundary.segments.map((segment) => segment.id));
  const wallIds = new Set([CONTAINER_TOP_WALL_ID, CONTAINER_BOTTOM_WALL_ID, ...boundarySegmentIds]);
  let previousEventTime = -1;

  for (const event of result.playback.events) {
    const eventTime = getPlaybackEventTime(event);
    assert.ok(eventTime >= 0);
    assert.ok(eventTime >= previousEventTime);

    if (event.kind === "BALL_PATH") {
      assert.ok(entityIds.has(event.entityId));
    }

    if (event.kind === "COLLISION" || event.kind === "DAMAGE") {
      assert.ok(entityIds.has(event.sourceEntityId));
      assert.ok(
        event.kind === "COLLISION" && event.collisionKind === "BALL_WALL"
          ? wallIds.has(event.targetEntityId)
          : entityIds.has(event.targetEntityId)
      );
    }

    if (event.kind === "TRIGGER") {
      if (event.entityId) {
        assert.ok(entityIds.has(event.entityId));
      }

      if (event.targetEntityId) {
        assert.ok(entityIds.has(event.targetEntityId));
      }
    }

    previousEventTime = eventTime;
  }

  for (let index = 1; index < ballPathEvents.length; index += 1) {
    const previousPath = ballPathEvents[index - 1];
    const nextPath = ballPathEvents[index];

    assert.equal(previousPath.toX, nextPath.fromX);
    assert.equal(previousPath.toY, nextPath.fromY);
    assert.ok(nextPath.timelineStartMs >= previousPath.timelineEndMs);
  }

  const gravityArcSamples = ballPathEvents.slice(1).flatMap((pathEvent, index) => {
    const previousPathEvent = ballPathEvents[index]!;
    const collisionBetweenSegments = result.playback.events.find((event) => (
      event.kind === "COLLISION" &&
      event.timelineTimestampMs === previousPathEvent.timelineEndMs &&
      event.timelineTimestampMs <= pathEvent.timelineStartMs &&
      Math.abs(event.x - previousPathEvent.toX) < 0.000001 &&
      Math.abs(event.y - previousPathEvent.toY) < 0.000001
    ));

    if (collisionBetweenSegments) {
      return [];
    }

    return [{
      previousDirection: getPathDirection(previousPathEvent),
      nextDirection: getPathDirection(pathEvent)
    }];
  });

  assert.ok(
    gravityArcSamples.some((sample) => sample.nextDirection.y > sample.previousDirection.y + 0.01)
  );
});

test("simulateRun applies crit logic deterministically", () => {
  const result = simulateRun(
    createRunInput({
      seed: "always-crit",
      combatStats: {
        power: "1000",
        speed: 1,
        critChance: 10_000
      }
    })
  );

  assert.equal(result.totalDamage, "20000");
  assert.ok(
    result.triggers
      .filter((trigger) => trigger.comboDelta === 1)
      .every((trigger) => trigger.type === "critical-hit")
  );
  const damageEvents = result.playback.events.filter((event) => event.kind === "DAMAGE");
  const impactBurstEvents = result.playback.events.filter(
    (event): event is Extract<PlaybackEvent, { kind: "TRIGGER" }> =>
      event.kind === "TRIGGER" && event.triggerKind === "IMPACT_BURST"
  );
  assert.ok(damageEvents.every((event) => event.isCrit));
  assert.deepEqual(
    impactBurstEvents.map((event) => event.detail?.damage),
    damageEvents.map((event) => event.damage)
  );
});

test("simulateRun removes defeated enemies from future targeting and can end when all enemies are defeated", () => {
  const result = simulateRun(
    createRunInput({
      seed: "clear-board",
      combatStats: {
        power: "6000",
        speed: 1,
        critChance: 0
      }
    })
  );

  assert.equal(result.endReason, "ALL_ENEMIES_DEFEATED");
  assert.equal(result.comboCount, 4);
  assert.equal(result.totalDamage, "24000");
  assert.ok(result.durationMs >= GAME_CONFIG.run.playbackMinDurationMs);
  assert.ok(result.durationMs <= GAME_CONFIG.run.playbackMaxDurationMs);

  const damageEvents = result.playback.events.filter((event) => event.kind === "DAMAGE");
  const defeatEvents = result.playback.events.filter(
    (event): event is Extract<PlaybackEvent, { kind: "TRIGGER" }> =>
      event.kind === "TRIGGER" && event.triggerKind === "ENEMY_DEFEATED"
  );

  assert.equal(damageEvents.length, 4);
  assert.equal(defeatEvents.length, 4);
  assert.ok(result.triggers.filter((trigger) => trigger.type === "enemy-defeated").length === 4);

  for (const defeatEvent of defeatEvents) {
    const defeatEventIndex = result.playback.events.findIndex((event) => event === defeatEvent);
    const previousEvent = defeatEventIndex > 0 ? result.playback.events[defeatEventIndex - 1] : undefined;
    const futureEnemyEvents = result.playback.events
      .slice(defeatEventIndex + 1)
      .filter(
        (event) =>
          (event.kind === "COLLISION" || event.kind === "DAMAGE") &&
          event.targetEntityId === defeatEvent.targetEntityId
      );

    assert.equal(previousEvent?.kind, "DAMAGE");
    assert.equal(previousEvent?.kind === "DAMAGE" ? previousEvent.targetEntityId : undefined, defeatEvent.targetEntityId);
    assert.equal(futureEnemyEvents.length, 0);
  }
});
