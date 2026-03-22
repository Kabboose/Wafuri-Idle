import assert from "node:assert/strict";
import test from "node:test";

import { progressPlayer } from "./idle.service.js";
import type { PlayerState } from "../utils/playerTypes.js";

function createPlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "player-1",
    energy: 0n,
    maxEnergy: 10000000n,
    energyPerSecond: 1000000n,
    teamPower: 10,
    version: 0,
    lastUpdateTimestampMs: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

test("progressPlayer caps energy at maxEnergy", () => {
  const player = createPlayerState({
    energy: 9500000n,
    maxEnergy: 10000000n,
    lastUpdateTimestampMs: 0
  });

  const progressed = progressPlayer(player, 1000);

  assert.equal(progressed.energy, 10000000n);
  assert.equal(progressed.maxEnergy, 10000000n);
});

test("progressPlayer stays at maxEnergy on repeated idle application", () => {
  const player = createPlayerState({
    energy: 10000000n,
    maxEnergy: 10000000n,
    lastUpdateTimestampMs: 0
  });

  const firstProgress = progressPlayer(player, 1000);
  const secondProgress = progressPlayer(
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
