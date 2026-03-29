import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { PlaybackBallPathEvent, RewardResult, RunResult } from "../generated/openapi-types";
import { derivePlaybackFrame } from "../replay/playbackAdapter";

const RESULTS_REVEAL_DELAY_MS = 650;
const PATH_TRAIL_FADE_MS = 180;
const PLAYBACK_SPEED_MULTIPLIER = 1.08;

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

/** Converts a normalized path segment into an absolutely positioned visual trail segment. */
function getPathSegmentStyle(pathEvent: PlaybackBallPathEvent, timelineMs: number): CSSProperties | null {
  if (timelineMs <= pathEvent.timelineStartMs) {
    return null;
  }

  const deltaX = pathEvent.toX - pathEvent.fromX;
  const deltaY = pathEvent.toY - pathEvent.fromY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX);
  const segmentDurationMs = Math.max(pathEvent.timelineEndMs - pathEvent.timelineStartMs, 1);
  const revealedProgress = Math.min((timelineMs - pathEvent.timelineStartMs) / segmentDurationMs, 1);
  const fadeProgress = timelineMs <= pathEvent.timelineEndMs
    ? 1
    : Math.max(1 - (timelineMs - pathEvent.timelineEndMs) / PATH_TRAIL_FADE_MS, 0);

  if (fadeProgress <= 0) {
    return null;
  }

  return {
    left: `${pathEvent.fromX * 100}%`,
    top: `${pathEvent.fromY * 100}%`,
    width: `${distance * revealedProgress * 100}%`,
    transform: `translateY(-50%) rotate(${angle}rad)`,
    opacity: 0.18 + fadeProgress * 0.6
  };
}

/** Renders a deterministic replay view from the server-authored playback timeline. */
export function RunReplay({
  runResult,
  rewardResult
}: {
  runResult: RunResult;
  rewardResult: RewardResult | null;
}) {
  const [timelineMs, setTimelineMs] = useState(0);
  const [resultsVisible, setResultsVisible] = useState(false);

  useEffect(() => {
    let animationFrameId = 0;
    const startTime = performance.now();

    const step = (frameTime: number) => {
      const elapsedMs = (frameTime - startTime) * PLAYBACK_SPEED_MULTIPLIER;
      const nextTimelineMs = Math.min(Math.floor(elapsedMs), runResult.playback.durationMs);
      setTimelineMs(nextTimelineMs);

      if (nextTimelineMs < runResult.playback.durationMs) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [runResult]);

  useEffect(() => {
    if (timelineMs < runResult.playback.durationMs || resultsVisible) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setResultsVisible(true);
    }, RESULTS_REVEAL_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [resultsVisible, runResult.playback.durationMs, timelineMs]);

  const frame = useMemo(
    () => derivePlaybackFrame(runResult.playback, timelineMs),
    [runResult.playback, timelineMs]
  );
  const ballPathEvents = useMemo(
    () => runResult.playback.events.filter(
      (event): event is PlaybackBallPathEvent => event.kind === "BALL_PATH"
    ),
    [runResult.playback.events]
  );

  return (
    <section className="run-replay-card">
      <div className="run-replay-stage">
        <div className="run-replay-live-hud">
          <div className="run-replay-damage-hud">
            <span className="run-replay-hud-label">Total Damage</span>
            <strong
              key={frame.rollingTotalDamage}
              className={`run-replay-damage-value ${frame.activeDamage ? "is-pulsing" : ""}`}
            >
              {frame.rollingTotalDamage}
            </strong>
          </div>
          <div
            className={`run-replay-combo-hud ${frame.activeComboMilestone ? "is-milestone" : ""}`}
            key={frame.comboAfter}
          >
            <span className="run-replay-hud-label">Combo</span>
            <strong className={`run-replay-combo-value ${frame.comboAfter > 0 ? "is-active" : ""}`}>
              {frame.comboAfter > 0 ? `x${frame.comboAfter}` : "Ready"}
            </strong>
          </div>
        </div>

        <div className="run-replay-arena-shell">
          <div className="run-replay-ui-layer">
            {frame.phase === "RUN_START" ? <div className="run-replay-banner">Run Start</div> : null}
            {frame.uiCues.map((cue) => (
              <div
                key={cue.id}
                className={`run-replay-banner ${cue.emphasis === "strong" ? "is-strong" : ""} ${cue.kind === "COMBO_MILESTONE" ? "is-combo" : ""} ${cue.kind === "RUN_FINISHER" ? "is-finisher" : ""}`}
              >
                {cue.label}
              </div>
            ))}
            {frame.phase === "FINISH" && !resultsVisible ? (
              <div className="run-replay-banner is-strong">Finish</div>
            ) : null}
          </div>

          {frame.phase === "FINISH" && !resultsVisible ? (
            <div className={`run-replay-finish-beat ${frame.finishCueActive ? "is-emphasized" : ""}`}>Run Complete</div>
          ) : null}

          <div className="run-replay-path-layer" aria-hidden="true">
            {ballPathEvents.map((pathEvent, index) => {
              const pathStyle = getPathSegmentStyle(pathEvent, frame.timelineMs);

              if (!pathStyle) {
                return null;
              }

              return (
                <div
                  key={`${pathEvent.entityId}:${pathEvent.timelineStartMs}:${index}`}
                  className="run-replay-path-segment"
                  style={pathStyle}
                />
              );
            })}
          </div>

          <div className="run-replay-arena">
            {runResult.playback.entities
              .filter((entity) => entity.kind === "OBSTACLE")
              .map((entity) => (
                <div
                  key={entity.id}
                  className="replay-entity replay-obstacle"
                  style={{
                    left: `${entity.spawnX * 100}%`,
                    top: `${entity.spawnY * 100}%`
                  }}
                />
              ))}

            {runResult.playback.entities
              .filter((entity) => entity.kind === "ENEMY")
              .map((entity) => (
                <div
                  key={entity.id}
                  className="replay-entity replay-enemy"
                  style={{
                    left: `${entity.spawnX * 100}%`,
                    top: `${entity.spawnY * 100}%`
                  }}
                />
              ))}

            {frame.ballPosition ? (
              <div
                className={`replay-entity replay-ball ${frame.activeCollision ? "is-impacting" : ""}`}
                style={{
                  left: `${frame.ballPosition.x * 100}%`,
                  top: `${frame.ballPosition.y * 100}%`
                }}
              />
            ) : null}

            {frame.worldCues.map((cue) => (
              <div
                key={cue.id}
                className={`replay-world-cue replay-world-cue-${cue.kind.toLowerCase()} ${cue.emphasis === "strong" ? "is-strong" : ""} ${cue.isCrit ? "is-crit" : ""}`}
                style={{
                  left: `${cue.x * 100}%`,
                  top: `${cue.y * 100}%`
                }}
              >
                {cue.label ?? ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`run-replay-summary ${resultsVisible ? "is-visible" : ""}`}>
        <div className="run-replay-summary-grid">
          <div>
            <span className="run-replay-summary-label">Total Damage</span>
            <strong>{runResult.totalDamage}</strong>
          </div>
          <div>
            <span className="run-replay-summary-label">Total Combo</span>
            <strong>x{runResult.comboCount}</strong>
          </div>
          <div>
            <span className="run-replay-summary-label">Currency Gained</span>
            <strong>{formatFixed(rewardResult?.grantedResources.currency ?? "0")}</strong>
          </div>
          <div>
            <span className="run-replay-summary-label">Progression Gained</span>
            <strong>{formatFixed(rewardResult?.grantedResources.progression ?? "0")}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
