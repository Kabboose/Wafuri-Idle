import { useEffect, useState } from "react";

import { apiGet, apiPost } from "./api/client";
import { bootstrapAuth, type PlayerState } from "./auth/bootstrapAuth";

/** Formats fixed-point strings from the API into readable decimal values for display. */
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

/** Renders the minimal idle-game client and keeps the local view synced with the server. */
export default function App() {
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const authState = await bootstrapAuth();

        if (!cancelled) {
          setPlayerState(authState.playerState);
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
        const nextState = await apiGet<PlayerState>("/state");

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
      const nextState = await apiPost<PlayerState>("/upgrade");
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
