import assert from "node:assert/strict";
import test from "node:test";

import { applyIdleEnergy } from "./idle.service.js";
import type { PlayerState } from "../utils/playerTypes.js";

function createPlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "player-1",
    energy: 0n,
    maxEnergy: 10000000n,
    currency: 0n,
    progression: 0n,
    energyPerSecond: 1000000n,
    teamPower: 10,
    version: 0,
    lastUpdateTimestampMs: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

test("applyIdleEnergy caps energy at maxEnergy", () => {
  const player = createPlayerState({
    energy: 9500000n,
    maxEnergy: 10000000n,
    lastUpdateTimestampMs: 0
  });

  const progressed = applyIdleEnergy(player, 1000);

  assert.equal(progressed.energy, 10000000n);
  assert.equal(progressed.maxEnergy, 10000000n);
});

test("applyIdleEnergy accumulates energy deterministically below the cap", () => {
  const player = createPlayerState({
    energy: 1000000n,
    maxEnergy: 10000000n,
    energyPerSecond: 2000000n,
    teamPower: 0,
    lastUpdateTimestampMs: 250
  });

  const progressed = applyIdleEnergy(player, 1750);

  assert.equal(progressed.energy, 4000000n);
  assert.equal(progressed.lastUpdateTimestampMs, 1750);
});

test("applyIdleEnergy stays at maxEnergy on repeated idle application", () => {
  const player = createPlayerState({
    energy: 10000000n,
    maxEnergy: 10000000n,
    lastUpdateTimestampMs: 0
  });

  const firstProgress = applyIdleEnergy(player, 1000);
  const secondProgress = applyIdleEnergy(
    {
      ...player,
      ...firstProgress,
      version: player.version
    },
    2000
  );

  assert.equal(firstProgress.energy, 10000000n);
  assert.equal(secondProgress.energy, 10000000n);
});

test("applyIdleEnergy ignores wall-clock time when the player state and nowMs are identical", () => {
  const player = createPlayerState({
    energy: 3000000n,
    maxEnergy: 12000000n,
    energyPerSecond: 1500000n,
    teamPower: 5,
    lastUpdateTimestampMs: 500
  });

  const originalDateNow = Date.now;

  try {
    Date.now = () => 1_000;
    const firstResult = applyIdleEnergy(player, 2500);

    Date.now = () => 999_999;
    const secondResult = applyIdleEnergy(player, 2500);

    assert.deepEqual(firstResult, secondResult);
  } finally {
    Date.now = originalDateNow;
  }
});
