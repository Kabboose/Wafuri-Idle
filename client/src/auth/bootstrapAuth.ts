import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStore";

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
  const existingAccessToken = getAccessToken();
  const existingRefreshToken = getRefreshToken();

  if (existingAccessToken) {
    const existingState = await fetchPlayerState(existingAccessToken);

    if (!existingState.unauthorized && existingState.playerState) {
      return {
        accessToken: existingAccessToken,
        refreshToken: existingRefreshToken ?? "",
        playerState: existingState.playerState
      };
    }

    clearTokens();
  }

  const guestSession = await createGuestSession();

  setTokens(guestSession.accessToken, guestSession.refreshToken);

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
    clearTokens();
    throw error;
  }
}
