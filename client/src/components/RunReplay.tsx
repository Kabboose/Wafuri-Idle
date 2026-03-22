import { useEffect, useMemo, useState } from "react";

import type { RewardResult, RunResult } from "../generated/openapi-types";
import { derivePlaybackFrame } from "../replay/playbackAdapter";

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

/** Renders a deterministic replay view from the server-authored playback timeline. */
export function RunReplay({
  runResult,
  rewardResult
}: {
  runResult: RunResult;
  rewardResult: RewardResult | null;
}) {
  const [timelineMs, setTimelineMs] = useState(0);

  useEffect(() => {
    let animationFrameId = 0;
    const startTime = performance.now();

    const step = (frameTime: number) => {
      const nextTimelineMs = Math.min(Math.floor(frameTime - startTime), runResult.playback.durationMs);
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

  const frame = useMemo(
    () => derivePlaybackFrame(runResult.playback, timelineMs),
    [runResult.playback, timelineMs]
  );

  return (
    <section className="run-replay-card">
      <div className="run-replay-header">
        <div>
          <h2>Run Replay</h2>
          <p>Timeline: {frame.timelineMs}ms / {runResult.playback.durationMs}ms</p>
        </div>
        <div className="run-replay-stats">
          <span>Total damage: {frame.rollingTotalDamage}</span>
          <span>Combo: {frame.comboAfter}</span>
        </div>
      </div>

      <div className="run-replay-stage">
        <div className="run-replay-ui-layer">
          {frame.phase === "RUN_START" ? <div className="run-replay-banner">Run Start</div> : null}
          {frame.uiCues.map((cue) => (
            <div
              key={cue.id}
              className={`run-replay-banner ${cue.emphasis === "strong" ? "is-strong" : ""}`}
            >
              {cue.label}
            </div>
          ))}
          {frame.phase === "FINISH" ? <div className="run-replay-banner is-strong">Finish</div> : null}
        </div>

        <div className="run-replay-arena">
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
              className="replay-entity replay-ball"
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

      {frame.showSummary ? (
        <div className="run-replay-summary">
          <p>Final damage: {runResult.totalDamage}</p>
          <p>Final combo: {runResult.comboCount}</p>
          <p>Currency gained: {formatFixed(rewardResult?.grantedResources.currency ?? "0")}</p>
          <p>Progression gained: {formatFixed(rewardResult?.grantedResources.progression ?? "0")}</p>
        </div>
      ) : null}
    </section>
  );
}
