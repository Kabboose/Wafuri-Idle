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
  return event.kind === "BALL_PATH" ? event.tStart : event.timestampMs;
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
  assert.equal(result.playback?.durationMs, 10_000);
  assert.deepEqual(result.playback?.arena, {
    width: 1,
    height: 1,
    zones: []
  });
  assert.equal(result.playback?.entities.length, 2);
  assert.deepEqual(result.playback?.entities[0], {
    id: "ball-1",
    kind: "BALL",
    spawnX: 0.5,
    spawnY: 0.15
  });
  assert.equal(result.playback?.entities[1]?.kind, "ENEMY");
  assert.ok((result.playback?.entities[1]?.spawnX ?? -1) >= 0);
  assert.ok((result.playback?.entities[1]?.spawnX ?? 2) <= 1);
  assert.ok((result.playback?.entities[1]?.spawnY ?? -1) >= 0);
  assert.ok((result.playback?.entities[1]?.spawnY ?? 2) <= 1);
  assert.equal(result.playback?.events[0]?.kind, "PHASE");
  assert.deepEqual(result.playback?.events[0], {
    kind: "PHASE",
    timestampMs: 0,
    phase: "RUN_START"
  });
  assert.equal(result.playback?.events.at(-1)?.kind, "PHASE");
  assert.deepEqual(result.playback?.events.at(-1), {
    kind: "PHASE",
    timestampMs: 10_000,
    phase: "FINISH"
  });

  const ballPathEvents = result.playback?.events.filter((event) => event.kind === "BALL_PATH") ?? [];
  const collisionEvents = result.playback?.events.filter((event) => event.kind === "COLLISION") ?? [];
  const damageEvents = result.playback?.events.filter((event) => event.kind === "DAMAGE") ?? [];
  assert.equal(ballPathEvents.length, 20);
  assert.equal(collisionEvents.length, 10);
  assert.equal(damageEvents.length, 10);
  assert.ok(ballPathEvents.every((event) => event.tStart >= 0 && event.tEnd <= 10_000 && event.tStart < event.tEnd));
  assert.ok(ballPathEvents.every((event) => event.fromX >= 0 && event.fromX <= 1));
  assert.ok(ballPathEvents.every((event) => event.fromY >= 0 && event.fromY <= 1));
  assert.ok(ballPathEvents.every((event) => event.toX >= 0 && event.toX <= 1));
  assert.ok(ballPathEvents.every((event) => event.toY >= 0 && event.toY <= 1));
  assert.ok(collisionEvents.every((event) => event.x >= 0 && event.x <= 1));
  assert.ok(collisionEvents.every((event) => event.y >= 0 && event.y <= 1));
  assert.ok(collisionEvents.every((event) => event.collisionKind === "BALL_ENEMY"));

  const inboundPathEvents = ballPathEvents.filter((event) => event.toX === result.playback?.entities[1]?.spawnX && event.toY === result.playback?.entities[1]?.spawnY);
  assert.equal(inboundPathEvents.length, 10);
  assert.deepEqual(
    collisionEvents.map((event) => event.timestampMs),
    inboundPathEvents.map((event) => event.tEnd)
  );
  assert.deepEqual(
    damageEvents.map((event) => event.timestampMs),
    collisionEvents.map((event) => event.timestampMs)
  );
  assert.deepEqual(
    damageEvents.map((event) => event.comboAfter),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(
    damageEvents.reduce((total, event) => total + BigInt(event.damage), 0n).toString(),
    result.totalDamage
  );

  for (let index = 0; index < collisionEvents.length; index += 1) {
    const collisionEventIndex: number = result.playback?.events.findIndex((event) => event === collisionEvents[index]) ?? -1;
    assert.notEqual(collisionEventIndex, -1);
    assert.equal(result.playback?.events[collisionEventIndex + 1]?.kind, "DAMAGE");
  }

  const entityIds = new Set(result.playback?.entities.map((entity) => entity.id) ?? []);
  let previousEventTime = -1;

  for (const event of result.playback?.events ?? []) {
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
      assert.ok(entityIds.has(event.sourceEntityId));
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
  const damageEvents = result.playback?.events.filter((event) => event.kind === "DAMAGE") ?? [];
  assert.ok(damageEvents.every((event) => event.isCrit));
});
