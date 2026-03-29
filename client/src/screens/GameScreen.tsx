import { useEffect, useState } from "react";

import { AuthError } from "../api/client";
import type { PlayerState } from "../auth/bootstrapAuth";
import { RunReplay } from "../components/RunReplay";
import { UpgradeModal } from "../components/UpgradeModal";
import { GAMEPLAY_CONFIG } from "../config/gameplay";
import { runPlayer, upgradePlayer } from "../generated/openapi-client";
import type { RewardResult, RunRequest, RunResult } from "../generated/openapi-types";
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

/** Formats fixed-point strings into whole-unit strings by dropping any fractional remainder. */
function formatWholeFixed(value: string): string {
  const bigintValue = BigInt(value);
  const negative = bigintValue < 0n;
  const absolute = negative ? -bigintValue : bigintValue;
  const whole = absolute / 1000000n;

  return `${negative ? "-" : ""}${whole.toString()}`;
}

/** Builds the temporary client-side run request payload expected by the current backend API. */
function buildRunRequest(playerState: PlayerState): RunRequest {
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
  const [replayVersion, setReplayVersion] = useState(0);
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
      const nextState = await upgradePlayer();
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
      const runActionResult = await runPlayer(buildRunRequest(playerState));
      setPlayerState(runActionResult.player);
      setLatestRunResult(runActionResult.runResult);
      setLatestRewardResult(runActionResult.rewardResult);
      setReplayVersion((currentVersion) => currentVersion + 1);
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
      <section className="player-hud-grid">
        <div className="player-hud-card">
          <span className="player-hud-label">Energy</span>
          <strong>{formatWholeFixed(playerState.energy)}</strong>
        </div>
        <div className="player-hud-card">
          <span className="player-hud-label">Max Energy</span>
          <strong>{formatWholeFixed(playerState.maxEnergy)}</strong>
        </div>
        <div className="player-hud-card">
          <span className="player-hud-label">Currency</span>
          <strong>{formatFixed(playerState.currency)}</strong>
        </div>
        <div className="player-hud-card">
          <span className="player-hud-label">Progression</span>
          <strong>{formatFixed(playerState.progression)}</strong>
        </div>
        <div className="player-hud-card">
          <span className="player-hud-label">Energy / Sec</span>
          <strong>{formatFixed(playerState.energyPerSecond)}</strong>
        </div>
        <div className="player-hud-card">
          <span className="player-hud-label">Team Power</span>
          <strong>{playerState.teamPower}</strong>
        </div>
      </section>
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
      {latestRunResult ? (
        <RunReplay
          key={replayVersion}
          runResult={latestRunResult}
          rewardResult={latestRewardResult}
        />
      ) : null}
      {isUpgradeOpen ? (
        <UpgradeModal
          upgradeAccount={upgradeAccount}
          onClose={() => setIsUpgradeOpen(false)}
        />
      ) : null}
    </main>
  );
}
