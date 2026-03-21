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

