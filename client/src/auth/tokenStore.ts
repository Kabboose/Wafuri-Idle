const ACCESS_TOKEN_KEY = "wafuri-idle-access-token";
const REFRESH_TOKEN_KEY = "wafuri-idle-refresh-token";

/** Returns the persisted access token, if one exists. */
export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Returns the persisted refresh token, if one exists. */
export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** Persists only the access token while preserving the existing refresh token state. */
export function setAccessToken(accessToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

/** Persists the current auth token pair for later authenticated requests. */
export function setTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** Clears any persisted auth tokens from local storage. */
export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
