import { useEffect, useState } from "react";

import { apiPost, AuthError } from "../api/client";
import type { PlayerState } from "../auth/bootstrapAuth";
import { UpgradeModal } from "../components/UpgradeModal";
import { GAMEPLAY_CONFIG } from "../config/gameplay";
import { loadPlayer } from "../game/loadPlayer";

type RunResult = {
  totalDamage: string;
  comboCount: number;
  triggers: Array<{
    type: string;
    source: string;
    timestampMs: number;
    value?: string;
    comboDelta?: number;
  }>;
  durationMs: number;
};

type RewardResult = {
  grantedResources: Record<string, string>;
  bonusTriggers: Array<{
    type: string;
    source: string;
    timestampMs: number;
    value?: string;
    comboDelta?: number;
  }>;
  summary: string[];
};

type RunActionResponse = {
  player: PlayerState;
  runResult: RunResult;
  rewardResult: RewardResult;
};

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

/** Formats fixed-point strings into whole-unit strings by dropping any fractional remainder. */
function formatWholeFixed(value: string): string {
  const bigintValue = BigInt(value);
  const negative = bigintValue < 0n;
  const absolute = negative ? -bigintValue : bigintValue;
  const whole = absolute / 1000000n;

  return `${negative ? "-" : ""}${whole.toString()}`;
}

/** Builds the temporary client-side run request payload expected by the current backend API. */
function buildRunRequest(playerState: PlayerState): {
  power: string;
  speed: number;
  critChance: number;
  runDurationMs: number;
} {
  return {
    power: (BigInt(playerState.teamPower) * GAMEPLAY_CONFIG.run.powerScalePerTeamPower).toString(),
    speed: GAMEPLAY_CONFIG.run.defaultSpeed,
    critChance: GAMEPLAY_CONFIG.run.defaultCritChance,
    runDurationMs: GAMEPLAY_CONFIG.run.defaultDurationMs
  };
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
  const [latestRunResult, setLatestRunResult] = useState<RunResult | null>(null);
  const [latestRewardResult, setLatestRewardResult] = useState<RewardResult | null>(null);
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

  const handleRun = async () => {
    if (!playerState) {
      return;
    }

    try {
      const runActionResult = await apiPost<RunActionResponse>("/run", buildRunRequest(playerState));
      setPlayerState(runActionResult.player);
      setLatestRunResult(runActionResult.runResult);
      setLatestRewardResult(runActionResult.rewardResult);
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
      <div className="game-screen-header">
        <h1>World Flipper-Inspired Idle Prototype</h1>
        <details className="settings-menu">
          <summary aria-label="Open settings menu">
            <span />
            <span />
            <span />
          </summary>
          <div className="settings-menu-panel">
            <button type="button" className="secondary-button" onClick={() => void logout()}>
              Log Out
            </button>
            <button type="button" className="secondary-button" onClick={() => void logoutAll()}>
              Log Out All Devices
            </button>
          </div>
        </details>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <p>Player ID: {playerState.id}</p>
      <p>Energy: {formatWholeFixed(playerState.energy)}</p>
      <p>Max energy: {formatWholeFixed(playerState.maxEnergy)}</p>
      <p>Currency: {formatFixed(playerState.currency)}</p>
      <p>Progression: {formatFixed(playerState.progression)}</p>
      <p>Energy per second: {formatFixed(playerState.energyPerSecond)} / sec</p>
      <p>Team power: {playerState.teamPower}</p>
      {latestRunResult ? (
        <>
          <p>Last run damage: {latestRunResult.totalDamage}</p>
          <p>Last run combo: {latestRunResult.comboCount}</p>
          <p>Last run currency: {formatFixed(latestRewardResult?.grantedResources.currency ?? "0")}</p>
          <p>Last run progression: {formatFixed(latestRewardResult?.grantedResources.progression ?? "0")}</p>
        </>
      ) : null}
      <div className="button-row">
        {playerState.accountType === "GUEST" ? (
          <button type="button" className="secondary-button" onClick={() => setIsUpgradeOpen(true)}>
            Save Progress
          </button>
        ) : null}
        <button type="button" onClick={() => void handleRun()}>
          Start Run
        </button>
        <button type="button" onClick={() => void handleUpgrade()}>
          Upgrade Team
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
