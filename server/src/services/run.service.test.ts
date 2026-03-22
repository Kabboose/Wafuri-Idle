import assert from "node:assert/strict";
import test from "node:test";

import { canStartRun, spendRunEnergy } from "./run.service.js";
import type { PlayerMutation } from "../utils/playerTypes.js";

function createPlayerState(overrides: Partial<PlayerMutation> = {}): PlayerMutation {
  return {
    energy: 10000000n,
    maxEnergy: 100000000n,
    energyPerSecond: 1000000n,
    teamPower: 10,
    lastUpdateTimestampMs: 0,
    ...overrides
  };
}

test("canStartRun returns false when energy is below the configured run cost", () => {
  assert.equal(canStartRun(createPlayerState({ energy: 9999999n })), false);
});

test("canStartRun returns true when energy matches the configured run cost exactly", () => {
  assert.equal(canStartRun(createPlayerState({ energy: 10000000n })), true);
});

test("spendRunEnergy deducts the configured cost exactly once", () => {
  const playerState = createPlayerState({ energy: 25000000n });

  const updatedPlayerState = spendRunEnergy(playerState);

  assert.equal(updatedPlayerState.energy, 15000000n);
  assert.equal(updatedPlayerState.maxEnergy, playerState.maxEnergy);
  assert.equal(updatedPlayerState.energyPerSecond, playerState.energyPerSecond);
  assert.equal(updatedPlayerState.teamPower, playerState.teamPower);
  assert.equal(updatedPlayerState.lastUpdateTimestampMs, playerState.lastUpdateTimestampMs);
});

test("spendRunEnergy throws when energy is insufficient", () => {
  assert.throws(() => spendRunEnergy(createPlayerState({ energy: 9999999n })), /Not enough energy to start run/);
});
