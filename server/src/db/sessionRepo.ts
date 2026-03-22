import { prisma } from "./prisma.js";
import type { CreateSessionInput, SessionRecord } from "../utils/identityTypes.js";

function mapSessionRecord(session: {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SessionRecord {
  return {
    id: session.id,
    accountId: session.accountId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

/**
 * Creates a persisted session row for an account.
 * Expects token hashing and expiry calculation to already be handled by the caller.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const session = await prisma.session.create({
    data: {
      accountId: input.accountId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: input.revokedAt ?? null
    }
  });

  return mapSessionRecord(session);
}

/** Finds a non-revoked, non-expired persisted session row by its hashed refresh token. */
export async function findByRefreshTokenHash(tokenHash: string, nowMs: number): Promise<SessionRecord | null> {
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(nowMs)
      }
    }
  });

  return session ? mapSessionRecord(session) : null;
}

/** Finds any persisted session row by its hashed refresh token, including revoked rows kept for audit/replay checks. */
export async function findAnyByRefreshTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  const session = await prisma.session.findFirst({
    where: {
      tokenHash
    }
  });

  return session ? mapSessionRecord(session) : null;
}

/** Soft-revokes the active session matching a hashed refresh token and returns the affected count. */
export async function revokeSessionByTokenHash(tokenHash: string, now: Date): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now
      }
    },
    data: {
      revokedAt: now
    }
  });

  return result.count;
}

/**
 * Soft-revokes the current refresh session and creates a replacement session atomically.
 * Expects the caller to provide the next token hash, expiry, and authoritative revocation time.
 */
export async function rotateRefreshSession(
  currentSessionId: string,
  input: CreateSessionInput & { revokedAt: Date }
): Promise<SessionRecord> {
  return prisma.$transaction(async (tx) => {
    const revokeResult = await tx.session.updateMany({
      where: {
        id: currentSessionId,
        revokedAt: null
      },
      data: {
        revokedAt: input.revokedAt
      }
    });

    if (revokeResult.count !== 1) {
      throw new Error("Refresh session is no longer active");
    }

    const session = await tx.session.create({
      data: {
        accountId: input.accountId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null
      }
    });

    return mapSessionRecord(session);
  });
}

/** Soft-revokes every still-active session for an account and returns the number affected. */
export async function revokeAllSessionsForAccount(accountId: string, revokedAt: Date): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      accountId,
      revokedAt: null
    },
    data: {
      revokedAt
    }
  });

  return result.count;
}

/** Lists all active sessions for an account using the current time as the activity boundary. */
export async function listActiveSessionsForAccount(accountId: string, nowMs: number): Promise<SessionRecord[]> {
  const sessions = await prisma.session.findMany({
    where: {
      accountId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(nowMs)
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return sessions.map(mapSessionRecord);
}

/** Deletes sessions whose expiry time has passed and returns the number removed. */
export async function deleteExpiredSessions(nowMs: number): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(nowMs)
      }
    }
  });

  return result.count;
}
