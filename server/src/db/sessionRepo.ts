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
