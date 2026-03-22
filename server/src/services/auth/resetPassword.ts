import { createHash } from "crypto";

import { applyPasswordReset } from "../../db/passwordResetRepo.js";
import { hashPassword } from "../../utils/passwordHash.js";

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
  now: Date;
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
  const passwordHash = await hashPassword(input.newPassword);
  const resetResult = await applyPasswordReset(tokenHash, passwordHash, input.now);

  if (!resetResult) {
    throw new Error("Invalid or expired password reset token");
  }
}
