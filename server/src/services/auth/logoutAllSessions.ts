import { revokeSessionsAndRotateSessionVersion } from "../../db/accountRepo.js";

export type LogoutAllSessionsInput = {
  accountId: string;
  now: Date;
};

export type LogoutAllSessionsResult = {
  revokedCount: number;
};

/**
 * Soft-revokes every active session for an account.
 * Returns the number of sessions affected and remains safe to repeat.
 */
export async function logoutAllSessions(input: LogoutAllSessionsInput): Promise<LogoutAllSessionsResult> {
  const result = await revokeSessionsAndRotateSessionVersion(input.accountId, input.now);

  return {
    revokedCount: result.revokedCount
  };
}
