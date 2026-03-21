import { prisma } from "./prisma.js";
import type { PasswordResetTokenRecord, StorePasswordResetTokenInput } from "../utils/identityTypes.js";

function mapPasswordResetTokenRecord(token: {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}): PasswordResetTokenRecord {
  return {
    id: token.id,
    accountId: token.accountId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt.toISOString(),
    usedAt: token.usedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString()
  };
}

/**
 * Stores a password reset token row for an account.
 * Expects token hashing and expiry calculation to already be handled by the caller.
 */
export async function storeResetToken(input: StorePasswordResetTokenInput): Promise<PasswordResetTokenRecord> {
  const token = await prisma.passwordResetToken.create({
    data: {
      accountId: input.accountId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt
    }
  });

  return mapPasswordResetTokenRecord(token);
}

/** Finds a password reset token by its stored token hash. */
export async function findResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash }
  });

  return token ? mapPasswordResetTokenRecord(token) : null;
}

/**
 * Marks an unused password reset token as consumed and returns the updated row.
 * Returns null when the token does not exist or was already consumed.
 */
export async function consumeResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  return prisma.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null
      }
    });

    if (!token) {
      return null;
    }

    const updatedToken = await tx.passwordResetToken.update({
      where: { id: token.id },
      data: {
        usedAt: new Date()
      }
    });

    return mapPasswordResetTokenRecord(updatedToken);
  });
}

/**
 * Updates the linked account password and consumes the reset token atomically.
 * Returns null when the token does not exist, was already used, or has expired.
 */
export async function applyPasswordReset(
  tokenHash: string,
  passwordHash: string,
  now: Date
): Promise<PasswordResetTokenRecord | null> {
  return prisma.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      }
    });

    if (!token) {
      return null;
    }

    await tx.account.update({
      where: { id: token.accountId },
      data: {
        passwordHash
      }
    });

    const updatedToken = await tx.passwordResetToken.update({
      where: { id: token.id },
      data: {
        usedAt: now
      }
    });

    return mapPasswordResetTokenRecord(updatedToken);
  });
}
