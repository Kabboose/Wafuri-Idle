import { useEffect, useState } from "react";

import { apiPost, AuthError } from "../api/client";
import type { PlayerState } from "../auth/bootstrapAuth";
import { UpgradeModal } from "../components/UpgradeModal";
import { loadPlayer } from "../game/loadPlayer";

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

/** Renders the authenticated game view and keeps the displayed player state synced with the server. */
export function GameScreen({
  onAuthFailure,
  upgradeAccount,
  logout,
  logoutAll
}: {
  onAuthFailure: () => void;
  upgradeAccount: (username: string, password: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}) {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInitialState = async () => {
      try {
        const nextState = await loadPlayer();

        if (!cancelled) {
          setPlayerState(nextState);
          setError(null);
        }
      } catch (requestError) {
        if (requestError instanceof AuthError) {
          if (!cancelled) {
            onAuthFailure();
          }

          return;
        }

        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unknown error");
        }
      }
    };

    void loadInitialState();

    const intervalId = window.setInterval(async () => {
      try {
        const nextState = await loadPlayer();

        if (!cancelled) {
          setPlayerState(nextState);
          setError(null);
        }
      } catch (requestError) {
        if (requestError instanceof AuthError) {
          if (!cancelled) {
            onAuthFailure();
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
  }, [onAuthFailure]);

  const handleUpgrade = async () => {
    try {
      const nextState = await apiPost<PlayerState>("/upgrade");
      setPlayerState(nextState);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof AuthError) {
        onAuthFailure();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    }
  };

  if (!playerState) {
    return <main className="screen-shell">Loading...</main>;
  }

  return (
    <main className="game-screen">
      <h1>World Flipper-Inspired Idle Prototype</h1>
      {error ? <p className="error-text">{error}</p> : null}
      <p>Player ID: {playerState.id}</p>
      <p>Energy: {formatFixed(playerState.energy)}</p>
      <p>Energy per second: {formatFixed(playerState.energyPerSecond)} / sec</p>
      <p>Team power: {playerState.teamPower}</p>
      <div className="button-row">
        {playerState.accountType === "GUEST" ? (
          <button type="button" className="secondary-button" onClick={() => setIsUpgradeOpen(true)}>
            Save Progress
          </button>
        ) : null}
        <button type="button" onClick={() => void handleUpgrade()}>
          Upgrade Team
        </button>
        <button type="button" className="secondary-button" onClick={() => void logout()}>
          Log Out
        </button>
        <button type="button" className="secondary-button" onClick={() => void logoutAll()}>
          Log Out All Devices
        </button>
      </div>
      {isUpgradeOpen ? (
        <UpgradeModal
          upgradeAccount={upgradeAccount}
          onClose={() => setIsUpgradeOpen(false)}
        />
      ) : null}
    </main>
  );
}
