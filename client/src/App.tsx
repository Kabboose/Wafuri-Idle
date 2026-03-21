import { useEffect, useState } from "react";

import { apiGet, apiPost, AuthError } from "./api/client";
import { bootstrapAuth } from "./auth/bootstrapAuth";
import type { PlayerState } from "./auth/bootstrapAuth";
import { loadPlayer } from "./game/loadPlayer";

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

/** Re-establishes authentication and reloads the authoritative player state after auth loss. */
async function rebootstrapPlayer(): Promise<PlayerState> {
  await bootstrapAuth();
  return loadPlayer();
}

/** Renders the minimal idle-game client and keeps the local view synced with the server. */
export default function App({ initialPlayerState }: { initialPlayerState: PlayerState }) {
  const [playerState, setPlayerState] = useState<PlayerState>(initialPlayerState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      try {
        const nextState = await apiGet<PlayerState>("/state");

        if (!cancelled) {
          setPlayerState(nextState);
          setError(null);
        }
      } catch (requestError) {
        if (requestError instanceof AuthError) {
          try {
            const recoveredState = await rebootstrapPlayer();

            if (!cancelled) {
              setPlayerState(recoveredState);
              setError(null);
            }
          } catch (recoveryError) {
            if (!cancelled) {
              setError(recoveryError instanceof Error ? recoveryError.message : "Unknown error");
            }
          }

          return;
        }

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
      if (requestError instanceof AuthError) {
        try {
          const recoveredState = await rebootstrapPlayer();
          setPlayerState(recoveredState);
          setError(null);
          return;
        } catch (recoveryError) {
          setError(recoveryError instanceof Error ? recoveryError.message : "Unknown error");
          return;
        }
      }

      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    }
  };

  return (
    <main>
      <h1>World Flipper-Inspired Idle Prototype</h1>
      {error ? <p>{error}</p> : null}
      <p>Player ID: {playerState.id}</p>
      <p>Mana: {formatFixed(playerState.mana)}</p>
      <p>Mana generation rate: {formatFixed(playerState.manaGenerationRate)} / sec</p>
      <p>Team power: {playerState.teamPower}</p>
      <button type="button" onClick={() => void handleUpgrade()}>
        Upgrade Team
      </button>
    </main>
  );
}
