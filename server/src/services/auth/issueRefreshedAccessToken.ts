import { refreshSession, type RefreshSessionInput } from "./refreshSession.js";

export type IssueRefreshedAccessTokenResult = {
  accessToken: string;
  refreshToken: string;
};

/** Validates a refresh token and returns the rotated auth token pair. */
export async function issueRefreshedAccessToken(
  input: RefreshSessionInput
): Promise<IssueRefreshedAccessTokenResult> {
  const session = await refreshSession(input);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}
