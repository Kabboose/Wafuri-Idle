const HAS_EVER_AUTHENTICATED_KEY = "wafuri-idle-has-ever-authenticated";

export type LoadingAuthState = {
  status: "loading";
};

export type NeedsSelectionAuthState = {
  status: "needsSelection";
};

export type NeedsLoginAuthState = {
  status: "needsLogin";
};

export type AuthenticatedAuthState = {
  status: "authenticated";
  accessToken: string;
};

export type AuthState =
  | LoadingAuthState
  | NeedsSelectionAuthState
  | NeedsLoginAuthState
  | AuthenticatedAuthState;

/** Returns the initial loading auth state used before bootstrap has completed. */
export function createLoadingAuthState(): LoadingAuthState {
  return {
    status: "loading"
  };
}

/** Returns whether this client has ever successfully held an authenticated session before. */
export function hasEverAuthenticated(): boolean {
  return window.localStorage.getItem(HAS_EVER_AUTHENTICATED_KEY) === "true";
}

/** Marks that this client has successfully authenticated at least once. */
export function markAuthenticatedOnce(): void {
  window.localStorage.setItem(HAS_EVER_AUTHENTICATED_KEY, "true");
}
