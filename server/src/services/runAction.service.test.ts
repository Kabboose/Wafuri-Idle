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
  assert.equal(result.rewardResult.grantedResources.currency, "20000");
  assert.equal(result.rewardResult.grantedResources.progression, "10000000");
  assert.equal(result.player.energy, "22000000");
  assert.equal(result.player.currency, "20000");
  assert.equal(result.player.progression, "10000000");
  assert.equal(playerIdentity?.energy, "22000000");
  assert.equal(playerIdentity?.currency, "20000");
  assert.equal(playerIdentity?.progression, "10000000");
});
