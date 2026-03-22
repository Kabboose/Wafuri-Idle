/**
 * This file is auto-generated from openapi/openapi.json.
 * Do not edit it manually. Run `npm run openapi:generate`.
 */

import { apiGet, apiPost, publicApiGet, publicApiPost } from "../api/client";
import type {
  EmptySuccessData,
  GuestSession,
  HealthStatus,
  LoginRequest,
  LoginResult,
  LogoutAllResult,
  PlayerState,
  RefreshRequest,
  RefreshResult,
  RequestPasswordResetRequest,
  RequestPasswordResetResult,
  ResetPasswordRequest,
  RunActionResult,
  RunRequest,
  UpgradeAccountRequest,
  UpgradeAccountResult
} from "./openapi-types";

export const API_PATHS = {
  GET_OPEN_API_DOCUMENT: "/openapi.json",
  GET_HEALTH: "/health",
  CREATE_GUEST_SESSION: "/auth/guest",
  LOGIN: "/auth/login",
  REFRESH_SESSION: "/auth/refresh",
  LOGOUT_SESSION: "/auth/logout",
  LOGOUT_ALL_SESSIONS: "/auth/logout-all",
  REQUEST_PASSWORD_RESET: "/auth/request-password-reset",
  RESET_PASSWORD: "/auth/reset-password",
  UPGRADE_ACCOUNT: "/auth/upgrade",
  GET_PLAYER_STATE: "/state",
  TICK_PLAYER: "/tick",
  UPGRADE_PLAYER: "/upgrade",
  RUN_PLAYER: "/run"
} as const;

export async function getHealth(): Promise<HealthStatus> {
  return publicApiGet<HealthStatus>(API_PATHS.GET_HEALTH);
}

export async function createGuestSession(): Promise<GuestSession> {
  return publicApiPost<GuestSession>(API_PATHS.CREATE_GUEST_SESSION);
}

export async function login(body: LoginRequest): Promise<LoginResult> {
  return publicApiPost<LoginResult>(API_PATHS.LOGIN, body);
}

export async function refreshSession(body: RefreshRequest): Promise<RefreshResult> {
  return publicApiPost<RefreshResult>(API_PATHS.REFRESH_SESSION, body);
}

export async function logoutSession(body: RefreshRequest): Promise<EmptySuccessData> {
  return publicApiPost<EmptySuccessData>(API_PATHS.LOGOUT_SESSION, body);
}

export async function logoutAllSessions(): Promise<LogoutAllResult> {
  return apiPost<LogoutAllResult>(API_PATHS.LOGOUT_ALL_SESSIONS);
}

export async function requestPasswordReset(body: RequestPasswordResetRequest): Promise<RequestPasswordResetResult> {
  return publicApiPost<RequestPasswordResetResult>(API_PATHS.REQUEST_PASSWORD_RESET, body);
}

export async function resetPassword(body: ResetPasswordRequest): Promise<EmptySuccessData> {
  return publicApiPost<EmptySuccessData>(API_PATHS.RESET_PASSWORD, body);
}

export async function upgradeAccount(body: UpgradeAccountRequest): Promise<UpgradeAccountResult> {
  return apiPost<UpgradeAccountResult>(API_PATHS.UPGRADE_ACCOUNT, body);
}

export async function getPlayerState(): Promise<PlayerState> {
  return apiGet<PlayerState>(API_PATHS.GET_PLAYER_STATE);
}

export async function tickPlayer(): Promise<PlayerState> {
  return apiPost<PlayerState>(API_PATHS.TICK_PLAYER);
}

export async function upgradePlayer(): Promise<PlayerState> {
  return apiPost<PlayerState>(API_PATHS.UPGRADE_PLAYER);
}

export async function runPlayer(body: RunRequest): Promise<RunActionResult> {
  return apiPost<RunActionResult>(API_PATHS.RUN_PLAYER, body);
}
