import { useCallback, useEffect, useState } from "react";

import type { AuthState } from "./authState";
import { createLoadingAuthState, hasEverAuthenticated, markAuthenticatedOnce } from "./authState";
import { bootstrapAuth } from "./bootstrapAuth";
import type {
  GuestSession,
  LoginResult,
  UpgradeAccountResult
} from "../generated/openapi-types";
import { AuthError } from "../api/client";
import {
  createGuestSession as createGuestSessionRequest,
  login as loginRequest,
  logoutSession as logoutSessionRequest,
  logoutAllSessions as logoutAllSessionsRequest,
  upgradeAccount as upgradeAccountRequest
} from "../generated/openapi-client";
import { clearTokens, getRefreshToken, setTokens } from "./tokenStore";

type AuthResponse = GuestSession | LoginResult | UpgradeAccountResult;

export type UseAuthResult = {
  authState: AuthState;
  createGuest: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  upgradeAccount: (username: string, password: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
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

  /** Clears local auth state and routes the app back into the explicit unauthenticated flow. */
  const transitionToSignedOutState = (forceLogin = false): void => {
    clearTokens();
    setAuthState(forceLogin || hasEverAuthenticated() ? { status: "needsLogin" } : { status: "needsSelection" });
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
    const authResponse = await createGuestSessionRequest();
    applyAuthenticatedState(authResponse);
  };

  /** Authenticates an existing account and transitions auth state to authenticated. */
  const login = async (username: string, password: string): Promise<void> => {
    const authResponse = await loginRequest({
      username,
      password
    });
    applyAuthenticatedState(authResponse);
  };

  /** Upgrades the current guest account and transitions auth state to authenticated. */
  const upgradeAccount = async (username: string, password: string, email: string): Promise<void> => {
    const authResponse = await upgradeAccountRequest({
      username,
      password,
      email
    });
    applyAuthenticatedState(authResponse);
  };

  /** Transitions auth state to the explicit login form. */
  const goToLogin = (): void => {
    setAuthState({
      status: "needsLogin"
    });
  };

  /** Clears stale auth state and routes the app back into the auth entry flow. */
  const handleAuthFailure = useCallback((): void => {
    transitionToSignedOutState();
  }, []);

  /** Logs out the current session, then always clears local auth state. */
  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await logoutSessionRequest({
          refreshToken
        });
      }
    } catch {
      // Local sign-out must still succeed even if the logout request cannot reach the server.
    } finally {
      transitionToSignedOutState();
    }
  };

  /** Logs out all sessions for the current account, then clears local auth state. */
  const logoutAll = async (): Promise<void> => {
    try {
      await logoutAllSessionsRequest();
    } catch (error) {
      if (!(error instanceof AuthError)) {
        // Local sign-out still wins when the server-side revoke-all request fails.
      }
    } finally {
      transitionToSignedOutState(true);
    }
  };

  return {
    authState,
    createGuest,
    login,
    upgradeAccount,
    logout,
    logoutAll,
    goToLogin,
    handleAuthFailure
  };
}
