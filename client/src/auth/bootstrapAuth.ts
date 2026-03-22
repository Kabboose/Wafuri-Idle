import { clearTokens, getAccessToken, getRefreshToken } from "./tokenStore";
import { hasEverAuthenticated, markAuthenticatedOnce, type AuthState } from "./authState";
import { refreshAccessToken } from "./refreshAccessToken";

export type PlayerState = {
  id: string;
  accountType: "GUEST" | "REGISTERED";
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  lastUpdateTimestampMs: number;
};

/** Validates an access token by probing the authenticated state endpoint. */
async function validateAccessToken(accessToken: string): Promise<boolean> {
  const response = await fetch("/state", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`State bootstrap failed: ${response.status}`);
  }

  return true;
}

/** Resolves the current auth entry state without triggering automatic guest-account creation. */
export async function bootstrapAuth(): Promise<AuthState> {
  const existingAccessToken = getAccessToken();
  const existingRefreshToken = getRefreshToken();

  if (existingAccessToken) {
    const accessTokenIsValid = await validateAccessToken(existingAccessToken);

    if (accessTokenIsValid) {
      markAuthenticatedOnce();

      return {
        status: "authenticated",
        accessToken: existingAccessToken
      };
    }

    if (existingRefreshToken) {
      try {
        const refreshedAccessToken = await refreshAccessToken();

        if (!refreshedAccessToken) {
          throw new Error("Refresh failed");
        }

        const refreshedTokenIsValid = await validateAccessToken(refreshedAccessToken);

        if (refreshedTokenIsValid) {
          markAuthenticatedOnce();

          return {
            status: "authenticated",
            accessToken: refreshedAccessToken
          };
        }
      } catch {
        // Fall through to explicit auth-entry state selection when refresh recovery is unavailable.
      }
    }

    clearTokens();
  }

  return hasEverAuthenticated()
    ? { status: "needsLogin" }
    : { status: "needsSelection" };
}
