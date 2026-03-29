import assert from "node:assert/strict";
import test from "node:test";

import { calculateRewards } from "./reward.service.js";
import type { RunPlayback, RunResult } from "../utils/runTypes.js";

const playbackFixture: RunPlayback = {
  durationMs: 10_000,
  arena: {
    width: 1,
    height: 1,
    zones: [],
    playfieldBoundary: {
      points: [],
      segments: []
    }
  },
  entities: [],
  events: []
};

function createRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    totalDamage: "2500",
    comboCount: 4,
    triggers: [],
    durationMs: 10_000,
    playback: playbackFixture,
    ...overrides
  };
}

test("calculateRewards derives rewards solely from run result", () => {
  const rewards = calculateRewards(createRunResult());

  assert.deepEqual(rewards.grantedResources, {
    currency: "2500",
    progression: "4000000"
  });
  assert.deepEqual(rewards.bonusTriggers, []);
});

test("calculateRewards is deterministic for the same run result", () => {
  const result = createRunResult({
    totalDamage: "123456",
    comboCount: 9
  });

  assert.deepEqual(calculateRewards(result), calculateRewards(result));
});

test("calculateRewards clamps negative combo counts to zero progression", () => {
  const rewards = calculateRewards(
    createRunResult({
      totalDamage: "100",
      comboCount: -3
    })
  );

  assert.equal(rewards.grantedResources.currency, "100");
  assert.equal(rewards.grantedResources.progression, "0");
});
