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
      speed: 1,
      critChance: 10_000,
      runDurationMs: 10_000
    },
    11_000
  );

  const playerIdentity = await findPlayerIdentityByAccountId(guest.accountId);

  assert.equal(result.runResult.comboCount, 4);
  assert.equal(result.runResult.endReason, "ALL_ENEMIES_DEFEATED");
  assert.equal(result.runResult.totalDamage, "40000");
  assert.equal(result.runResult.playback.durationMs, 4_000);
  assert.deepEqual(result.runResult.playback.arena, {
    width: 1,
    height: 1,
    zones: [],
    playfieldBoundary: result.runResult.playback.arena.playfieldBoundary
  });
  assert.equal(result.runResult.playback.entities.length, 10);
  assert.deepEqual(result.runResult.playback.entities[0], {
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
  assert.equal(result.runResult.playback.entities.filter((entity) => entity.kind === "ENEMY").length, 4);
  assert.equal(result.runResult.playback.entities.filter((entity) => entity.kind === "OBSTACLE").length, 3);
  assert.equal(result.runResult.playback.entities.filter((entity) => entity.kind === "ARENA").length, 2);
  assert.deepEqual(result.runResult.playback.events[0], {
    kind: "PHASE",
    timelineTimestampMs: 0,
    phase: "RUN_START"
  });
  const finishEventIndex = result.runResult.playback.events.findIndex(
    (event) => event.kind === "PHASE" && event.phase === "FINISH"
  );
  assert.notEqual(finishEventIndex, -1);
  assert.deepEqual(result.runResult.playback.events[finishEventIndex], {
    kind: "PHASE",
    timelineTimestampMs: 4_000,
    phase: "FINISH"
  });
  const ballPathEvents = result.runResult.playback.events.filter((event) => event.kind === "BALL_PATH");
  const collisionEvents = result.runResult.playback.events.filter((event) => event.kind === "COLLISION");
  assert.equal(ballPathEvents.length, collisionEvents.length);
  assert.equal(collisionEvents.filter((event) => event.collisionKind === "BALL_ENEMY").length, 4);
  assert.ok(collisionEvents.filter((event) => event.collisionKind === "BALL_OBSTACLE").length >= 1);
  assert.ok(collisionEvents.filter((event) => event.collisionKind === "BALL_WALL").length >= 1);
  assert.ok(collisionEvents.filter((event) => event.collisionKind === "BALL_FLIPPER").length >= 1);
  assert.equal(result.runResult.playback.events.filter((event) => event.kind === "DAMAGE").length, 4);
  assert.ok(result.runResult.playback.events.filter((event) => event.kind === "TRIGGER").length >= 9);
  assert.ok(
    new Set(
      result.runResult.playback.events
        .filter((event) => event.kind === "COLLISION")
        .map((event) => event.targetEntityId)
    ).size > 1
  );
  assert.equal(result.rewardResult.grantedResources.currency, "40000");
  assert.equal(result.rewardResult.grantedResources.progression, "4000000");
  assert.equal(result.player.energy, "22000000");
  assert.equal(result.player.currency, "40000");
  assert.equal(result.player.progression, "4000000");
  assert.equal(playerIdentity?.energy, "22000000");
  assert.equal(playerIdentity?.currency, "40000");
  assert.equal(playerIdentity?.progression, "4000000");
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
  assert.equal(playerIdentity?.currency, "40000");
  assert.equal(playerIdentity?.progression, "4000000");
});
