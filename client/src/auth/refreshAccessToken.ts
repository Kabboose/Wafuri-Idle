import { clearTokens, getRefreshToken, setTokens } from "./tokenStore";

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

let refreshInFlight: Promise<string | null> | null = null;

/** Refreshes the access token using a single shared in-flight request across the client. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          throw new Error("Missing refresh token");
        }

        const response = await fetch("/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) {
          throw new Error(`Refresh failed: ${response.status}`);
        }

        const payload = (await response.json()) as ApiSuccessResponse<RefreshResponse>;
        setTokens(payload.data.accessToken, payload.data.refreshToken);

        return payload.data.accessToken;
      } catch {
        clearTokens();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}
