import { refreshSession, type RefreshSessionInput } from "./refreshSession.js";
import { createAccessToken } from "./sessionTokens.js";

export type IssueRefreshedAccessTokenResult = {
  accessToken: string;
};

/** Validates a refresh token and returns a newly signed access token without rotating the refresh session. */
export async function issueRefreshedAccessToken(
  input: RefreshSessionInput
): Promise<IssueRefreshedAccessTokenResult> {
  const session = await refreshSession(input);

  return {
    accessToken: createAccessToken(session.accountId, session.playerId)
  };
}
