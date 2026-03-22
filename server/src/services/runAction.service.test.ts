import assert from "node:assert/strict";
import { after, test } from "node:test";

import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { findPlayerIdentityByAccountId } from "../db/identityRepo.js";
import { createGuestAccount } from "./auth/createGuestAccount.js";
import { runPlayerAction } from "./runAction.service.js";

const integrationTest = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL ? test : test.skip;

after(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

integrationTest("runPlayerAction executes the full run lifecycle and persists rewards", async () => {
  const guest = await createGuestAccount({
    now: new Date(1_000)
  });

  await prisma.player.update({
    where: { id: guest.playerId },
    data: {
      energy: "20000000"
    }
  });

  const result = await runPlayerAction(
    guest.accountId,
    {
      power: "1000",
      speed: 1,
      critChance: 10_000,
      runDurationMs: 10_000
    },
    11_000
  );

  const playerIdentity = await findPlayerIdentityByAccountId(guest.accountId);

  assert.equal(result.runResult.comboCount, 10);
  assert.equal(result.runResult.totalDamage, "20000");
  assert.equal(result.runResult.playback?.durationMs, 10_000);
  assert.deepEqual(result.runResult.playback?.arena, {
    width: 1,
    height: 1,
    zones: []
  });
  assert.equal(result.runResult.playback?.entities.length, 2);
  assert.deepEqual(result.runResult.playback?.entities[0], {
    id: "ball-1",
    kind: "BALL",
    spawnX: 0.5,
    spawnY: 0.15
  });
  assert.equal(result.runResult.playback?.entities[1]?.kind, "ENEMY");
  assert.deepEqual(result.runResult.playback?.events[0], {
    kind: "PHASE",
    timestampMs: 0,
    phase: "RUN_START"
  });
  assert.deepEqual(result.runResult.playback?.events.at(-1), {
    kind: "PHASE",
    timestampMs: 10_000,
    phase: "FINISH"
  });
  assert.equal(result.runResult.playback?.events.filter((event) => event.kind === "BALL_PATH").length, 10);
  assert.equal(result.rewardResult.grantedResources.currency, "20000");
  assert.equal(result.rewardResult.grantedResources.progression, "10000000");
  assert.equal(result.player.energy, "22000000");
  assert.equal(result.player.currency, "20000");
  assert.equal(result.player.progression, "10000000");
  assert.equal(playerIdentity?.energy, "22000000");
  assert.equal(playerIdentity?.currency, "20000");
  assert.equal(playerIdentity?.progression, "10000000");
});

integrationTest("runPlayerAction allows only one parallel run when energy is sufficient for exactly one cost", async () => {
  const guest = await createGuestAccount({
    now: new Date(2_000)
  });

  await prisma.player.update({
    where: { id: guest.playerId },
    data: {
      energy: "10000000"
    }
  });

  const runInput = {
    power: "1000",
    speed: 1,
    critChance: 10_000,
    runDurationMs: 10_000
  } as const;

  const [firstResult, secondResult] = await Promise.allSettled([
    runPlayerAction(guest.accountId, runInput, 2_000),
    runPlayerAction(guest.accountId, runInput, 2_000)
  ]);

  const fulfilledResults = [firstResult, secondResult].filter((result) => result.status === "fulfilled");
  const rejectedResults = [firstResult, secondResult].filter((result) => result.status === "rejected");
  const playerIdentity = await findPlayerIdentityByAccountId(guest.accountId);

  assert.equal(fulfilledResults.length, 1);
  assert.equal(rejectedResults.length, 1);
  assert.match((rejectedResults[0] as PromiseRejectedResult).reason.message, /Not enough energy to start run/);
  assert.equal(playerIdentity?.energy, "0");
  assert.equal(playerIdentity?.currency, "20000");
  assert.equal(playerIdentity?.progression, "10000000");
});
