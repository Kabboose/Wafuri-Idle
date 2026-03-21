export type PlayerState = {
  id: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  lastUpdateTimestampMs: number;
};

export type AuthResponse = {
  accountId: string;
  playerId: string;
  accessToken: string;
  refreshToken: string;
};

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export const ACCESS_TOKEN_KEY = "wafuri-idle-access-token";
export const REFRESH_TOKEN_KEY = "wafuri-idle-refresh-token";

/** Removes any persisted auth tokens so the client can safely recover from auth failure. */
export function clearStoredTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Performs a guest-auth request and unwraps the standard success envelope. */
async function createGuestSession(): Promise<AuthResponse> {
  const response = await fetch("/auth/guest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Guest auth failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<AuthResponse>;

  return payload.data;
}

/** Loads the authenticated player state and reports whether the token is unauthorized. */
async function fetchPlayerState(
  accessToken: string
): Promise<{ playerState: PlayerState | null; unauthorized: boolean }> {
  const response = await fetch("/state", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    return {
      playerState: null,
      unauthorized: true
    };
  }

  if (!response.ok) {
    throw new Error(`State bootstrap failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<PlayerState>;

  return {
    playerState: payload.data,
    unauthorized: false
  };
}

export type BootstrapAuthResult = {
  accessToken: string;
  refreshToken: string;
  playerState: PlayerState;
};

/** Ensures the client has a valid authenticated session and returns the authenticated player state. */
export async function bootstrapAuth(): Promise<BootstrapAuthResult> {
  const existingAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const existingRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

  if (existingAccessToken) {
    const existingState = await fetchPlayerState(existingAccessToken);

    if (!existingState.unauthorized && existingState.playerState) {
      return {
        accessToken: existingAccessToken,
        refreshToken: existingRefreshToken ?? "",
        playerState: existingState.playerState
      };
    }

    clearStoredTokens();
  }

  const guestSession = await createGuestSession();

  window.localStorage.setItem(ACCESS_TOKEN_KEY, guestSession.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, guestSession.refreshToken);

  try {
    const guestState = await fetchPlayerState(guestSession.accessToken);

    if (guestState.unauthorized || !guestState.playerState) {
      throw new Error("Guest auth returned an unusable access token");
    }

    return {
      accessToken: guestSession.accessToken,
      refreshToken: guestSession.refreshToken,
      playerState: guestState.playerState
    };
  } catch (error) {
    clearStoredTokens();
    throw error;
  }
}
