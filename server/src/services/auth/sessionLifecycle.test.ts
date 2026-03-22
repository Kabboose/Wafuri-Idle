import "dotenv/config";

import { after, test } from "node:test";
import assert from "node:assert/strict";

import { listActiveSessionsForAccount, findAnyByRefreshTokenHash } from "../../db/sessionRepo.js";
import { prisma } from "../../db/prisma.js";
import { createGuestSession } from "./createGuestSession.js";
import { issueAuthSession } from "./issueAuthSession.js";
import { issueRefreshedAccessToken } from "./issueRefreshedAccessToken.js";
import { logoutAllSessions } from "./logoutAllSessions.js";
import { logoutSession } from "./logoutSession.js";
import { hashRefreshToken } from "./sessionTokens.js";

const integrationTest = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL ? test : test.skip;

after(async () => {
  await prisma.$disconnect();
});

integrationTest("guest session can log out current session", async () => {
  const guestSession = await createGuestSession(new Date());
  const tokenHash = hashRefreshToken(guestSession.refreshToken);

  await logoutSession({
    refreshToken: guestSession.refreshToken,
    now: new Date()
  });

  const revokedSession = await findAnyByRefreshTokenHash(tokenHash);

  assert.ok(revokedSession);
  assert.notEqual(revokedSession.revokedAt, null);
});

integrationTest("logout invalidates refresh token", async () => {
  const guestSession = await createGuestSession(new Date());

  await logoutSession({
    refreshToken: guestSession.refreshToken,
    now: new Date()
  });

  await assert.rejects(
    issueRefreshedAccessToken({
      refreshToken: guestSession.refreshToken,
      nowMs: Date.now()
    }),
    /Invalid refresh token/
  );
});

integrationTest("logout-all invalidates all sessions for account", async () => {
  const guestSession = await createGuestSession(new Date());

  await issueAuthSession({
    accountId: guestSession.accountId,
    playerId: guestSession.playerId,
    now: new Date()
  });

  const logoutResult = await logoutAllSessions({
    accountId: guestSession.accountId,
    now: new Date()
  });

  const activeSessions = await listActiveSessionsForAccount(guestSession.accountId, Date.now());

  assert.equal(logoutResult.revokedCount, 2);
  assert.equal(activeSessions.length, 0);
});

integrationTest("refresh-token replay revokes all sessions", async () => {
  const guestSession = await createGuestSession(new Date());

  const secondSession = await issueAuthSession({
    accountId: guestSession.accountId,
    playerId: guestSession.playerId,
    now: new Date()
  });

  const rotatedTokens = await issueRefreshedAccessToken({
    refreshToken: guestSession.refreshToken,
    nowMs: Date.now()
  });

  assert.ok(rotatedTokens.refreshToken);
  assert.notEqual(rotatedTokens.refreshToken, guestSession.refreshToken);

  await assert.rejects(
    issueRefreshedAccessToken({
      refreshToken: guestSession.refreshToken,
      nowMs: Date.now()
    }),
    /Invalid refresh token/
  );

  const activeSessions = await listActiveSessionsForAccount(guestSession.accountId, Date.now());
  const secondSessionRecord = await findAnyByRefreshTokenHash(hashRefreshToken(secondSession.refreshToken));

  assert.equal(activeSessions.length, 0);
  assert.ok(secondSessionRecord);
  assert.notEqual(secondSessionRecord.revokedAt, null);
});

integrationTest("repeated logout is safe", async () => {
  const guestSession = await createGuestSession(new Date());

  await logoutSession({
    refreshToken: guestSession.refreshToken,
    now: new Date()
  });

  const secondLogoutResult = await logoutSession({
    refreshToken: guestSession.refreshToken,
    now: new Date()
  });

  const activeSessions = await listActiveSessionsForAccount(guestSession.accountId, Date.now());

  assert.deepEqual(secondLogoutResult, { success: true });
  assert.equal(activeSessions.length, 0);
});

integrationTest("logout-all on already-revoked sessions is safe", async () => {
  const guestSession = await createGuestSession(new Date());

  await logoutAllSessions({
    accountId: guestSession.accountId,
    now: new Date()
  });

  const secondLogoutAllResult = await logoutAllSessions({
    accountId: guestSession.accountId,
    now: new Date()
  });

  assert.equal(secondLogoutAllResult.revokedCount, 0);
});
