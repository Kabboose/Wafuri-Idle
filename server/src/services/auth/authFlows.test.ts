import "dotenv/config";

import assert from "node:assert/strict";
import { createHash } from "crypto";
import { after, test } from "node:test";

import jwt from "jsonwebtoken";

import { config } from "../../config/index.js";
import { findAccountById } from "../../db/accountRepo.js";
import { findPlayerIdentityByAccountId } from "../../db/identityRepo.js";
import { findResetTokenByHash } from "../../db/passwordResetRepo.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../db/prisma.js";
import { createGuestAccount } from "./createGuestAccount.js";
import { issueAuthSession } from "./issueAuthSession.js";
import { login } from "./login.js";
import { logoutAllSessions } from "./logoutAllSessions.js";
import { requestPasswordReset } from "./requestPasswordReset.js";
import { resetPassword } from "./resetPassword.js";
import { upgradeAccount } from "./upgradeAccount.js";

const integrationTest = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL ? test : test.skip;

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function uniqueValue(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

after(async () => {
  await prisma.$disconnect();
});

integrationTest("createGuestAccount creates a guest account with a linked player", async () => {
  const result = await createGuestAccount({
    now: new Date()
  });

  const account = await findAccountById(result.accountId);
  const player = await findPlayerIdentityByAccountId(result.accountId);

  assert.ok(account);
  assert.equal(account.type, "GUEST");
  assert.ok(account.sessionVersion);
  assert.ok(player);
  assert.equal(player.id, result.playerId);
});

integrationTest("upgradeAccount upgrades a guest in place and preserves player linkage", async () => {
  const guest = await createGuestAccount({
    now: new Date()
  });
  const originalPlayer = await findPlayerIdentityByAccountId(guest.accountId);
  const username = uniqueValue("tester");
  const email = `${uniqueValue("tester")}@example.com`;

  const upgraded = await upgradeAccount({
    accountId: guest.accountId,
    username,
    password: "Password123!",
    email
  });

  const account = await findAccountById(guest.accountId);
  const player = await findPlayerIdentityByAccountId(guest.accountId);

  assert.equal(upgraded.accountId, guest.accountId);
  assert.equal(account?.type, "REGISTERED");
  assert.equal(account?.username, username);
  assert.equal(account?.email, email);
  assert.equal(player?.id, originalPlayer?.id);

  await assert.rejects(
    upgradeAccount({
      accountId: guest.accountId,
      username: "TesterTwo",
      password: "Password123!",
      email: "tester2@example.com"
    }),
    /already registered/
  );
});

integrationTest("login authenticates a registered account and resolves the linked player", async () => {
  const guest = await createGuestAccount({
    now: new Date()
  });
  const username = uniqueValue("player");
  const email = `${uniqueValue("player")}@example.com`;

  await upgradeAccount({
    accountId: guest.accountId,
    username,
    password: "Password123!",
    email
  });

  const loginResult = await login({
    username: ` ${username.toUpperCase()} `,
    password: "Password123!"
  });

  assert.equal(loginResult.accountId, guest.accountId);
  assert.equal(loginResult.playerId, guest.playerId);

  await assert.rejects(
    login({
      username,
      password: "wrong-password"
    }),
    /Invalid credentials/
  );
});

integrationTest("password reset stores a hashed token and updates login credentials", async () => {
  const guest = await createGuestAccount({
    now: new Date()
  });
  const username = uniqueValue("reset-user");
  const email = `${uniqueValue("reset-user")}@example.com`;

  await upgradeAccount({
    accountId: guest.accountId,
    username,
    password: "OldPassword123!",
    email
  });

  const now = new Date();
  const rawToken = await requestPasswordReset(email.toUpperCase(), now);
  const storedToken = await findResetTokenByHash(hashResetToken(rawToken));

  assert.ok(storedToken);
  assert.equal(storedToken?.usedAt, null);

  await resetPassword({
    token: rawToken,
    newPassword: "NewPassword123!",
    now: new Date(now.getTime() + 1000)
  });

  await assert.rejects(
    login({
      username,
      password: "OldPassword123!"
    }),
    /Invalid credentials/
  );

  const loginResult = await login({
    username,
    password: "NewPassword123!"
  });

  assert.equal(loginResult.accountId, guest.accountId);

  await assert.rejects(
    resetPassword({
      token: rawToken,
      newPassword: "AnotherPassword123!",
      now: new Date(now.getTime() + 2000)
    }),
    /Invalid or expired password reset token/
  );
});

integrationTest("issued access tokens include the current account sessionVersion", async () => {
  const guest = await createGuestAccount({
    now: new Date()
  });
  const account = await findAccountById(guest.accountId);

  const tokens = await issueAuthSession({
    accountId: guest.accountId,
    playerId: guest.playerId,
    now: new Date()
  });
  const payload = jwt.verify(tokens.accessToken, config.jwtSecret) as {
    accountId: string;
    playerId: string;
    sessionVersion: string;
  };

  assert.equal(payload.accountId, guest.accountId);
  assert.equal(payload.playerId, guest.playerId);
  assert.equal(payload.sessionVersion, account?.sessionVersion);
});

integrationTest("requireAuth rejects access tokens immediately after logout-all rotates sessionVersion", async () => {
  const guest = await createGuestAccount({
    now: new Date()
  });
  const tokens = await issueAuthSession({
    accountId: guest.accountId,
    playerId: guest.playerId,
    now: new Date()
  });

  await logoutAllSessions({
    accountId: guest.accountId,
    now: new Date()
  });

  const request = {
    header(name: string) {
      return name === "Authorization" ? `Bearer ${tokens.accessToken}` : undefined;
    }
  } as Parameters<typeof requireAuth>[0];
  const response = createMockResponse();
  let nextCalled = false;

  await requireAuth(request, response as unknown as Parameters<typeof requireAuth>[1], () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, {
    success: false,
    error: "Invalid bearer token"
  });
});
