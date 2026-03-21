import { useEffect, useState } from "react";

type PlayerState = {
  id: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  lastUpdateTimestamp: number;
};

type AuthResponse = {
  token: string;
  playerId: string;
};

const AUTH_TOKEN_KEY = "wafuri-idle-token";

function formatFixed(value: string): string {
  const bigintValue = BigInt(value);
  const negative = bigintValue < 0n;
  const absolute = negative ? -bigintValue : bigintValue;
  const whole = absolute / 1000000n;
  const fraction = absolute % 1000000n;

  if (fraction === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const trimmedFraction = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${trimmedFraction}`;
}

async function requestJson<T>(path: "/auth/guest" | "/state" | "/upgrade", method: "GET" | "POST", token?: string): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function ensureGuestToken(): Promise<string> {
  const existingToken = window.localStorage.getItem(AUTH_TOKEN_KEY);

  if (existingToken) {
    return existingToken;
  }

  const authResponse = await requestJson<AuthResponse>("/auth/guest", "POST");
  window.localStorage.setItem(AUTH_TOKEN_KEY, authResponse.token);

  return authResponse.token;
}

export default function App() {
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const token = await ensureGuestToken();
        const nextState = await requestJson<PlayerState>("/state", "GET", token);

        if (!cancelled) {
          setAuthToken(token);
          setPlayerState(nextState);
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unknown error");
          setLoading(false);
        }
      }
    };

    void loadState();

    const intervalId = window.setInterval(async () => {
      try {
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY);

        if (!token) {
          return;
        }

        const nextState = await requestJson<PlayerState>("/state", "GET", token);

        if (!cancelled) {
          setPlayerState(nextState);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unknown error");
        }
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleUpgrade = async () => {
    try {
      if (!authToken) {
        throw new Error("Missing auth token");
      }

      const nextState = await requestJson<PlayerState>("/upgrade", "POST", authToken);
      setPlayerState(nextState);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    }
  };

  if (loading) {
    return <main>Loading...</main>;
  }

  return (
    <main>
      <h1>World Flipper-Inspired Idle Prototype</h1>
      {error ? <p>{error}</p> : null}
      <p>Player ID: {playerState?.id ?? "Unknown"}</p>
      <p>Mana: {playerState ? formatFixed(playerState.mana) : "0"}</p>
      <p>Mana generation rate: {playerState ? formatFixed(playerState.manaGenerationRate) : "0"} / sec</p>
      <p>Team power: {playerState ? playerState.teamPower : 0}</p>
      <button type="button" onClick={() => void handleUpgrade()}>
        Upgrade Team
      </button>
    </main>
  );
}
