import { useEffect, useState } from "react";

import type { AuthState } from "./authState";
import { createLoadingAuthState, hasEverAuthenticated, markAuthenticatedOnce } from "./authState";
import { bootstrapAuth } from "./bootstrapAuth";
import { apiPost, publicApiPost } from "../api/client";
import { clearTokens, setTokens } from "./tokenStore";

type AuthResponse = {
  accountId: string;
  playerId: string;
  accessToken: string;
  refreshToken: string;
};

type LoginRequest = {
  username: string;
  password: string;
};

type UpgradeAccountRequest = {
  username: string;
  password: string;
  email: string;
};

export type UseAuthResult = {
  authState: AuthState;
  createGuest: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  upgradeAccount: (username: string, password: string, email: string) => Promise<void>;
  goToLogin: () => void;
  handleAuthFailure: () => void;
};

/** Controls the frontend auth state machine and exposes explicit auth-entry actions. */
export function useAuth(): UseAuthResult {
  const [authState, setAuthState] = useState<AuthState>(createLoadingAuthState());

  /** Applies the shared post-auth success transition after guest, login, or upgrade flows. */
  const applyAuthenticatedState = (authResponse: AuthResponse): void => {
    setTokens(authResponse.accessToken, authResponse.refreshToken);
    markAuthenticatedOnce();
    setAuthState({
      status: "authenticated",
      accessToken: authResponse.accessToken
    });
  };

  useEffect(() => {
    let cancelled = false;

    const resolveAuthState = async () => {
      const nextState = await bootstrapAuth();

      if (!cancelled) {
        setAuthState(nextState);
      }
    };

    void resolveAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Creates an explicit guest session and transitions auth state to authenticated. */
  const createGuest = async (): Promise<void> => {
    const authResponse = await publicApiPost<AuthResponse>("/auth/guest");
    applyAuthenticatedState(authResponse);
  };

  /** Authenticates an existing account and transitions auth state to authenticated. */
  const login = async (username: string, password: string): Promise<void> => {
    const authResponse = await publicApiPost<AuthResponse>("/auth/login", {
      username,
      password
    } satisfies LoginRequest);
    applyAuthenticatedState(authResponse);
  };

  /** Upgrades the current guest account and transitions auth state to authenticated. */
  const upgradeAccount = async (username: string, password: string, email: string): Promise<void> => {
    const authResponse = await apiPost<AuthResponse>("/auth/upgrade", {
      username,
      password,
      email
    } satisfies UpgradeAccountRequest);
    applyAuthenticatedState(authResponse);
  };

  /** Transitions auth state to the explicit login form. */
  const goToLogin = (): void => {
    setAuthState({
      status: "needsLogin"
    });
  };

  /** Clears stale auth state and routes the app back into the auth entry flow. */
  const handleAuthFailure = (): void => {
    clearTokens();
    setAuthState(hasEverAuthenticated() ? { status: "needsLogin" } : { status: "needsSelection" });
  };

  return {
    authState,
    createGuest,
    login,
    upgradeAccount,
    goToLogin,
    handleAuthFailure
  };
}
