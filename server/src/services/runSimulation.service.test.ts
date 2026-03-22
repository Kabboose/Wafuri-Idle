import assert from "node:assert/strict";
import test from "node:test";

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
  assert.equal(result.playback.entities.length, 4);
  assert.deepEqual(result.playback.entities[0], {
    id: "ball-1",
    kind: "BALL",
    spawnX: 0.5,
    spawnY: 0.15
  });
  const enemyEntities = result.playback.entities.filter((entity) => entity.kind === "ENEMY");
  assert.equal(enemyEntities.length, 3);
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
  const damageEvents = result.playback.events.filter((event) => event.kind === "DAMAGE");
  const triggerEvents = result.playback.events.filter((event) => event.kind === "TRIGGER");
  assert.equal(ballPathEvents.length, 20);
  assert.equal(collisionEvents.length, 10);
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
  assert.ok(collisionEvents.every((event) => event.collisionKind === "BALL_ENEMY"));
  assert.ok(triggerEvents.every((event) => event.timelineTimestampMs >= 0 && event.timelineTimestampMs <= 10_000));
  assert.ok(new Set(collisionEvents.map((event) => event.targetEntityId)).size > 1);
  assert.ok(new Set(damageEvents.map((event) => event.targetEntityId)).size > 1);

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
    collisionEvents.map((event) => event.timelineTimestampMs)
  );
  assert.deepEqual(
    impactBurstEvents.map((event) => event.timelineTimestampMs),
    collisionEvents.map((event) => event.timelineTimestampMs)
  );
  assert.deepEqual(
    damageEvents.map((event) => event.comboAfter),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(
    damageEvents.reduce((total, event) => total + BigInt(event.damage), 0n).toString(),
    result.totalDamage
  );
  assert.deepEqual(
    comboMilestoneEvents.map((event) => event.detail?.comboThreshold),
    [5, 10]
  );
  assert.equal(runFinisherEvents[0]?.timelineTimestampMs, 9_750);

  for (let index = 0; index < collisionEvents.length; index += 1) {
    const collisionEventIndex: number = result.playback.events.findIndex((event) => event === collisionEvents[index]);
    assert.notEqual(collisionEventIndex, -1);
    const previousEvent: PlaybackEvent | undefined = result.playback.events[collisionEventIndex - 1];
    assert.equal(previousEvent?.kind, "BALL_PATH");
    assert.equal(
      previousEvent?.kind === "BALL_PATH" ? previousEvent.timelineEndMs : undefined,
      collisionEvents[index]?.timelineTimestampMs
    );
    assert.equal(result.playback.events[collisionEventIndex + 1]?.kind, "DAMAGE");
    assert.equal(result.playback.events[collisionEventIndex + 2]?.kind, "TRIGGER");
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
