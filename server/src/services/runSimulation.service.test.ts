import assert from "node:assert/strict";
import test from "node:test";

import { simulateRun } from "./runSimulation.service.js";
import type { RunInput } from "../utils/runTypes.js";

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
  assert.equal(ballPathEvents.length, 10);
  assert.ok(ballPathEvents.every((event) => event.tStart >= 0 && event.tEnd <= 10_000 && event.tStart < event.tEnd));
  assert.ok(ballPathEvents.every((event) => event.fromX >= 0 && event.fromX <= 1));
  assert.ok(ballPathEvents.every((event) => event.fromY >= 0 && event.fromY <= 1));
  assert.ok(ballPathEvents.every((event) => event.toX >= 0 && event.toX <= 1));
  assert.ok(ballPathEvents.every((event) => event.toY >= 0 && event.toY <= 1));
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
});
