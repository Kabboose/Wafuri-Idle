import { createHash, randomBytes } from "crypto";

import { findAccountByEmail } from "../../db/accountRepo.js";
import { storeResetToken } from "../../db/passwordResetRepo.js";

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generates and stores a single-use password reset token for the account matching the provided email.
 * Returns the raw token for the email delivery layer to send separately.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const emailNormalized = normalizeEmail(email);
  const account = await findAccountByEmail(emailNormalized);

  if (!account) {
    throw new Error("Account not found");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await storeResetToken({
    accountId: account.id,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

