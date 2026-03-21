import { createGuestAccount } from "./createGuestAccount.js";
import { issueAuthSession } from "./issueAuthSession.js";

export type GuestSessionResult = {
  accountId: string;
  playerId: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * Creates a guest account, then issues and persists the matching auth session.
 * Accepts the request's captured time so the full mutation uses one timestamp.
 */
export async function createGuestSession(now: Date): Promise<GuestSessionResult> {
  const guestAccount = await createGuestAccount({
    now
  });
  const tokens = await issueAuthSession({
    accountId: guestAccount.accountId,
    playerId: guestAccount.playerId,
    now
  });

  return {
    accountId: guestAccount.accountId,
    playerId: guestAccount.playerId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}
