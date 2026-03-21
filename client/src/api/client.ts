import { clearTokens, getAccessToken } from "../auth/tokenStore";

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

/** Error raised when an authenticated API request loses authorization. */
export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

/** Performs an authenticated API request and unwraps the standard success envelope. */
async function apiRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new AuthError("Missing access token");
  }

  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (response.status === 401) {
    clearTokens();
    throw new AuthError();
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<T>;

  return payload.data;
}

/** Performs an authenticated GET request. */
export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "GET");
}

/** Performs an authenticated POST request with an optional JSON body. */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, "POST", body);
}
