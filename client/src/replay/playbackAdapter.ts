import type {
  PlaybackBallPathEvent,
  PlaybackCollisionEvent,
  PlaybackDamageEvent,
  PlaybackEvent,
  PlaybackTriggerEvent,
  RunPlayback
} from "../generated/openapi-types";

export type WorldCue = {
  id: string;
  kind: "COLLISION" | "DAMAGE" | "IMPACT_BURST" | "ENEMY_DEFEATED";
  x: number;
  y: number;
  label?: string;
  isCrit?: boolean;
  emphasis?: "normal" | "strong";
};

export type UiCue = {
  id: string;
  kind: "COMBO_MILESTONE" | "RUN_FINISHER" | "SKILL_ACTIVATED" | "CHAIN_STARTED" | "CHAIN_EXTENDED";
  label: string;
  emphasis?: "normal" | "strong";
};

export type PlaybackFrame = {
  phase: "RUN_START" | "RUNNING" | "FINISH";
  timelineMs: number;
  ballPosition: {
    x: number;
    y: number;
  } | null;
  rollingTotalDamage: string;
  comboAfter: number;
  worldCues: WorldCue[];
  uiCues: UiCue[];
  activeCollision: PlaybackCollisionEvent | null;
  activeDamage: PlaybackDamageEvent | null;
  activeComboMilestone: UiCue | null;
  finishCueActive: boolean;
  showSummary: boolean;
};

const COLLISION_CUE_LIFETIME_MS = 180;
const DAMAGE_CUE_LIFETIME_MS = 480;
const WORLD_TRIGGER_CUE_LIFETIME_MS = 320;
const UI_CUE_LIFETIME_MS = 700;

/** Clamps the playback cursor into the run's supported timeline. */
function clampTimelineMs(playback: RunPlayback, timelineMs: number): number {
  return Math.min(Math.max(Math.floor(timelineMs), 0), playback.durationMs);
}

/** Computes the ball position from the server-authored path segments at the current playback time. */
function getBallPosition(events: PlaybackEvent[], timelineMs: number): PlaybackFrame["ballPosition"] {
  const ballPathEvents = events.filter(
    (event): event is PlaybackBallPathEvent => event.kind === "BALL_PATH"
  );

  const activePath = ballPathEvents.find(
    (event) => timelineMs >= event.timelineStartMs && timelineMs <= event.timelineEndMs
  );

  if (activePath) {
    const durationMs = Math.max(activePath.timelineEndMs - activePath.timelineStartMs, 1);
    const progress = (timelineMs - activePath.timelineStartMs) / durationMs;

    return {
      x: activePath.fromX + (activePath.toX - activePath.fromX) * progress,
      y: activePath.fromY + (activePath.toY - activePath.fromY) * progress
    };
  }

  const completedPath = [...ballPathEvents]
    .reverse()
    .find((event) => event.timelineEndMs <= timelineMs);

  if (completedPath) {
    return {
      x: completedPath.toX,
      y: completedPath.toY
    };
  }

  return null;
}

/** Returns true when an event should still be visible in the current playback frame. */
function isCueActive(eventTimestampMs: number, timelineMs: number, lifetimeMs: number): boolean {
  return timelineMs >= eventTimestampMs && timelineMs <= eventTimestampMs + lifetimeMs;
}

/** Maps a collision event into a lightweight world-space impact cue. */
function mapCollisionCue(event: PlaybackCollisionEvent): WorldCue {
  return {
    id: `collision:${event.sourceEntityId}:${event.targetEntityId}:${event.timelineTimestampMs}`,
    kind: "COLLISION",
    x: event.x,
    y: event.y,
    emphasis: "normal"
  };
}

/** Maps a damage event into a world-space popup cue. */
function mapDamageCue(event: PlaybackDamageEvent): WorldCue {
  return {
    id: `damage:${event.sourceEntityId}:${event.targetEntityId}:${event.timelineTimestampMs}`,
    kind: "DAMAGE",
    x: event.x,
    y: event.y,
    label: event.damage,
    isCrit: event.isCrit,
    emphasis: event.isCrit ? "strong" : "normal"
  };
}

/** Maps a trigger event into either a world-space cue or a UI-space cue. */
function mapTriggerCue(event: PlaybackTriggerEvent): { worldCue?: WorldCue; uiCue?: UiCue } {
  switch (event.triggerKind) {
    case "IMPACT_BURST":
      if (event.x === undefined || event.y === undefined) {
        return {};
      }

      return {
        worldCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "IMPACT_BURST",
          x: event.x,
          y: event.y,
          emphasis: "strong"
        }
      };
    case "COMBO_MILESTONE":
      return {
        uiCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "COMBO_MILESTONE",
          label: `Combo x${event.detail?.comboThreshold ?? event.detail?.comboAfter ?? ""}`.trim(),
          emphasis: "strong"
        }
      };
    case "ENEMY_DEFEATED":
      if (event.x === undefined || event.y === undefined) {
        return {};
      }

      return {
        worldCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "ENEMY_DEFEATED",
          x: event.x,
          y: event.y,
          label: "Defeated",
          emphasis: "strong"
        }
      };
    case "RUN_FINISHER":
      return {
        uiCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "RUN_FINISHER",
          label: "Run Finisher",
          emphasis: "strong"
        }
      };
    case "SKILL_ACTIVATED":
      return {
        uiCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "SKILL_ACTIVATED",
          label: "Skill Activated",
          emphasis: "normal"
        }
      };
    case "CHAIN_STARTED":
      return {
        uiCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "CHAIN_STARTED",
          label: "Chain Started",
          emphasis: "normal"
        }
      };
    case "CHAIN_EXTENDED":
      return {
        uiCue: {
          id: `trigger:${event.triggerKind}:${event.timelineTimestampMs}`,
          kind: "CHAIN_EXTENDED",
          label: "Chain Extended",
          emphasis: "normal"
        }
      };
    default:
      return {};
  }
}

/** Adapts the server-authored playback timeline into frontend presentation state for one frame. */
export function derivePlaybackFrame(playback: RunPlayback, timelineMs: number): PlaybackFrame {
  const clampedTimelineMs = clampTimelineMs(playback, timelineMs);
  const damageEvents = playback.events.filter(
    (event): event is PlaybackDamageEvent =>
      event.kind === "DAMAGE" && event.timelineTimestampMs <= clampedTimelineMs
  );
  const activeCollisionEvents = playback.events.filter(
    (event): event is PlaybackCollisionEvent =>
      event.kind === "COLLISION" && isCueActive(event.timelineTimestampMs, clampedTimelineMs, COLLISION_CUE_LIFETIME_MS)
  );
  const activeDamageEvents = playback.events.filter(
    (event): event is PlaybackDamageEvent =>
      event.kind === "DAMAGE" && isCueActive(event.timelineTimestampMs, clampedTimelineMs, DAMAGE_CUE_LIFETIME_MS)
  );
  const activeTriggerEvents = playback.events.filter(
    (event): event is PlaybackTriggerEvent =>
      event.kind === "TRIGGER" &&
      isCueActive(
        event.timelineTimestampMs,
        clampedTimelineMs,
        event.placement === "WORLD" ? WORLD_TRIGGER_CUE_LIFETIME_MS : UI_CUE_LIFETIME_MS
      )
  );

  const worldCues = [
    ...activeCollisionEvents.map(mapCollisionCue),
    ...activeDamageEvents.map(mapDamageCue),
    ...activeTriggerEvents.map((event) => mapTriggerCue(event).worldCue).filter((cue): cue is WorldCue => Boolean(cue))
  ];
  const uiCues = activeTriggerEvents
    .map((event) => mapTriggerCue(event).uiCue)
    .filter((cue): cue is UiCue => Boolean(cue));
  const lastDamageEvent = damageEvents.length > 0 ? damageEvents[damageEvents.length - 1] : undefined;
  const activeCollision = activeCollisionEvents.length > 0 ? activeCollisionEvents[activeCollisionEvents.length - 1] : null;
  const activeDamage = activeDamageEvents.length > 0 ? activeDamageEvents[activeDamageEvents.length - 1] : null;
  const activeComboMilestone = uiCues.find((cue) => cue.kind === "COMBO_MILESTONE") ?? null;
  const finishCueActive = uiCues.some((cue) => cue.kind === "RUN_FINISHER");

  return {
    phase: clampedTimelineMs >= playback.durationMs ? "FINISH" : clampedTimelineMs === 0 ? "RUN_START" : "RUNNING",
    timelineMs: clampedTimelineMs,
    ballPosition: getBallPosition(playback.events, clampedTimelineMs),
    rollingTotalDamage: damageEvents.reduce((total, event) => (total + BigInt(event.damage)), 0n).toString(),
    comboAfter: lastDamageEvent?.comboAfter ?? 0,
    worldCues,
    uiCues,
    activeCollision,
    activeDamage,
    activeComboMilestone,
    finishCueActive,
    showSummary: clampedTimelineMs >= playback.durationMs
  };
}
