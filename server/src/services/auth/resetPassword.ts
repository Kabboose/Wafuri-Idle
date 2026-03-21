import { createHash } from "crypto";

import argon2 from "argon2";

import { applyPasswordReset } from "../../db/passwordResetRepo.js";

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validates a password reset token, updates the account password, and marks the token as used.
 * Expects a raw reset token plus the new plaintext password.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const passwordHash = await argon2.hash(input.newPassword);
  const resetResult = await applyPasswordReset(tokenHash, passwordHash, new Date());

  if (!resetResult) {
    throw new Error("Invalid or expired password reset token");
  }
}
