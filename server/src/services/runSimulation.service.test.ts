import assert from "node:assert/strict";
import test from "node:test";

import { GAME_CONFIG } from "../config/index.js";
import { simulateRun } from "./runSimulation.service.js";
import type { PlaybackEvent, RunInput } from "../utils/runTypes.js";

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

function isWallBoundaryCoordinate(value: number): boolean {
  return (
    Math.abs(value - GAME_CONFIG.run.playbackWallInset) < 0.000001 ||
    Math.abs(value - (1 - GAME_CONFIG.run.playbackWallInset)) < 0.000001
  );
}

test("simulateRun is deterministic for the same input and seed", () => {
  const input = createRunInput();

  assert.deepEqual(simulateRun(input), simulateRun(input));
});

test("simulateRun changes output when the seed changes", () => {
  const baseInput = createRunInput();
  const changedSeedInput = createRunInput({ seed: "seed-456" });

  assert.notDeepEqual(simulateRun(baseInput), simulateRun(changedSeedInput));
});

test("simulateRun increments combo and tracks a trigger for every hit", () => {
  const result = simulateRun(createRunInput());

  assert.equal(result.comboCount, 10);
  assert.equal(result.triggers.length, 10);
  assert.equal(result.durationMs, 10_000);
  assert.equal(result.playback.durationMs, 10_000);
  assert.deepEqual(result.playback.arena, {
    width: 1,
    height: 1,
    zones: []
  });
  assert.equal(result.playback.entities.length, 9);
  assert.deepEqual(result.playback.entities[0], {
    id: "ball-1",
    kind: "BALL",
    spawnX: 0.52,
    spawnY: 0.9
  });
  const enemyEntities = result.playback.entities.filter((entity) => entity.kind === "ENEMY");
  assert.equal(enemyEntities.length, 4);
  assert.ok(enemyEntities.every((entity) => entity.spawnX >= 0 && entity.spawnX <= 1));
  assert.ok(enemyEntities.every((entity) => entity.spawnY >= 0 && entity.spawnY <= 1));
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
    timelineTimestampMs: 10_000,
    phase: "FINISH"
  });

  const ballPathEvents = result.playback.events.filter((event) => event.kind === "BALL_PATH");
  const collisionEvents = result.playback.events.filter((event) => event.kind === "COLLISION");
  const enemyCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_ENEMY");
  const wallCollisionEvents = collisionEvents.filter((event) => event.collisionKind === "BALL_WALL");
  const damageEvents = result.playback.events.filter((event) => event.kind === "DAMAGE");
  const triggerEvents = result.playback.events.filter((event) => event.kind === "TRIGGER");
  assert.equal(ballPathEvents.length, collisionEvents.length);
  assert.equal(enemyCollisionEvents.length, 10);
  assert.ok(wallCollisionEvents.length >= 1);
  assert.equal(damageEvents.length, 10);
  assert.equal(triggerEvents.length, 13);
  assert.ok(
    ballPathEvents.every(
      (event) =>
        event.timelineStartMs >= 0 &&
        event.timelineEndMs <= 10_000 &&
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
  assert.ok(triggerEvents.every((event) => event.timelineTimestampMs >= 0 && event.timelineTimestampMs <= 10_000));
  assert.ok(new Set(enemyCollisionEvents.map((event) => event.targetEntityId)).size > 1);
  assert.ok(new Set(damageEvents.map((event) => event.targetEntityId)).size > 1);
  assert.ok(new Set(wallCollisionEvents.map((event) => event.targetEntityId)).size >= 1);
  assert.ok(
    wallCollisionEvents.every(
      (event) =>
        isWallBoundaryCoordinate(event.x) || isWallBoundaryCoordinate(event.y)
    )
  );

  const impactBurstEvents = triggerEvents.filter((event) => event.triggerKind === "IMPACT_BURST");
  const comboMilestoneEvents = triggerEvents.filter((event) => event.triggerKind === "COMBO_MILESTONE");
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
  assert.equal(runFinisherEvents[0]?.timelineTimestampMs, 9_750);

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
  }

  const entityIds = new Set(result.playback.entities.map((entity) => entity.id));
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
      assert.ok(entityIds.has(event.targetEntityId));
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
    const collisionBetweenPaths = result.playback.events.find((event) => {
      if (event.kind !== "COLLISION") {
        return false;
      }

      return (
        event.timelineTimestampMs === previousPath.timelineEndMs &&
        event.timelineTimestampMs === nextPath.timelineStartMs &&
        Math.abs(event.x - previousPath.toX) < 0.000001 &&
        Math.abs(event.y - previousPath.toY) < 0.000001 &&
        Math.abs(event.x - nextPath.fromX) < 0.000001 &&
        Math.abs(event.y - nextPath.fromY) < 0.000001
      );
    });

    assert.equal(previousPath.toX, nextPath.fromX);
    assert.equal(previousPath.toY, nextPath.fromY);
    assert.ok(collisionBetweenPaths, "path direction changed without an intervening collision");
  }
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
  assert.ok(result.triggers.every((trigger) => trigger.type === "critical-hit"));
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
