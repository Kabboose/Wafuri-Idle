import { refreshAccessToken } from "../auth/refreshAccessToken";
import { getAccessToken } from "../auth/tokenStore";

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

type ApiErrorResponse = {
  success: false;
  error: string;
};

/** Error raised when an authenticated API request loses authorization. */
export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

/** Performs an authenticated API request and unwraps the standard success envelope. */
async function apiRequest<T>(path: string, method: "GET" | "POST", body?: unknown, hasRetried = false): Promise<T> {
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
    if (hasRetried) {
      throw new AuthError();
    }

    const refreshedAccessToken = await refreshAccessToken();

    if (!refreshedAccessToken) {
      throw new AuthError("Unauthenticated");
    }

    return apiRequest<T>(path, method, body, true);
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as ApiErrorResponse;

      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Fall back to the generic status-based message when the response body is unavailable.
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as ApiSuccessResponse<T>;

  return payload.data;
}

/** Performs an unauthenticated API request and unwraps the standard success envelope. */
async function publicApiRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as ApiErrorResponse;

      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Fall back to the generic status-based message when the response body is unavailable.
    }

    throw new Error(message);
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

/** Performs an unauthenticated POST request with an optional JSON body. */
export async function publicApiPost<T>(path: string, body?: unknown): Promise<T> {
  return publicApiRequest<T>(path, "POST", body);
}

/** Performs an unauthenticated GET request. */
export async function publicApiGet<T>(path: string): Promise<T> {
  return publicApiRequest<T>(path, "GET");
}
