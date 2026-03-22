import { findAccountById } from "../../db/accountRepo.js";
import { createSession } from "../../db/sessionRepo.js";
import { createAuthTokens, type AuthTokens } from "./sessionTokens.js";

export type IssueAuthSessionInput = {
  accountId: string;
  playerId: string;
  now: Date;
};

export type IssueAuthSessionResult = AuthTokens;

/**
 * Issues a fresh access token and persists the matching refresh session.
 * Accepts plain ids plus the request's captured time and returns the token bundle.
 */
export async function issueAuthSession(input: IssueAuthSessionInput): Promise<IssueAuthSessionResult> {
  const account = await findAccountById(input.accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  const tokens = createAuthTokens(input.accountId, input.playerId, account.sessionVersion, input.now);

  await createSession({
    accountId: input.accountId,
    tokenHash: tokens.refreshTokenHash,
    expiresAt: tokens.refreshTokenExpiresAt
  });

  return tokens;
}
