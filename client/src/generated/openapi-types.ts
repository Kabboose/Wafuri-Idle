/**
 * This file is auto-generated from openapi/openapi.json.
 * Do not edit it manually. Run `npm run openapi:generate`.
 */

export type OpenApiDocument = Record<string, unknown>;

export type ErrorEnvelope = {
  "success": false;
  "error": string;
};

export type EmptySuccessData = Record<string, never>;

export type EmptySuccessResponse = {
  "success": true;
  "data": EmptySuccessData;
};

export type HealthStatus = {
  "status": "ok";
};

export type HealthResponse = {
  "success": true;
  "data": HealthStatus;
};

export type GuestSession = {
  "accountId": string;
  "playerId": string;
  "accessToken": string;
  "refreshToken": string;
};

export type GuestSessionResponse = {
  "success": true;
  "data": GuestSession;
};

export type LoginRequest = {
  "username": string;
  "password": string;
};

export type LoginResult = {
  "accountId": string;
  "playerId": string;
  "accessToken": string;
  "refreshToken": string;
};

export type LoginResponse = {
  "success": true;
  "data": LoginResult;
};

export type RefreshRequest = {
  "refreshToken": string;
};

export type RefreshResult = {
  "accessToken": string;
  "refreshToken": string;
};

export type RefreshResponse = {
  "success": true;
  "data": RefreshResult;
};

export type LogoutAllResult = {
  "revokedCount": number;
};

export type LogoutAllResponse = {
  "success": true;
  "data": LogoutAllResult;
};

export type RequestPasswordResetRequest = {
  "email": string;
};

export type RequestPasswordResetResult = {
  "token": string;
};

export type RequestPasswordResetResponse = {
  "success": true;
  "data": RequestPasswordResetResult;
};

export type ResetPasswordRequest = {
  "token": string;
  "newPassword": string;
};

export type UpgradeAccountRequest = {
  "username": string;
  "password": string;
  "email": string;
};

export type UpgradeAccountResult = {
  "accountId": string;
  "type": "REGISTERED";
  "username": string;
  "email": string;
  "playerId": string;
  "accessToken": string;
  "refreshToken": string;
};

export type UpgradeAccountResponse = {
  "success": true;
  "data": UpgradeAccountResult;
};

export type PlayerState = {
  "id": string;
  "accountType": "GUEST" | "REGISTERED";
  "energy": string;
  "maxEnergy": string;
  "currency": string;
  "progression": string;
  "energyPerSecond": string;
  "teamPower": number;
  "lastUpdateTimestampMs": number;
  "createdAt": string;
  "updatedAt": string;
};

export type PlayerStateResponse = {
  "success": true;
  "data": PlayerState;
};

export type RunRequest = {
  "power": string;
  "speed": number;
  "critChance": number;
  "runDurationMs"?: number;
};

export type RunSummaryTriggerEvent = {
  "type": string;
  "source": string;
  "timestampMs": number;
  "value"?: string;
  "comboDelta"?: number;
};

export type PlaybackArena = {
  "width": number;
  "height": number;
  "zones": Array<Record<string, never>>;
};

export type PlaybackEntity = {
  "id": string;
  "kind": "BALL" | "ENEMY" | "ARENA" | "OBSTACLE";
  "spawnX": number;
  "spawnY": number;
};

export type PlaybackBallPathEvent = {
  "kind": "BALL_PATH";
  "timelineStartMs": number;
  "timelineEndMs": number;
  "entityId": string;
  "fromX": number;
  "fromY": number;
  "toX": number;
  "toY": number;
};

export type PlaybackCollisionEvent = {
  "kind": "COLLISION";
  "timelineTimestampMs": number;
  "sourceEntityId": string;
  "targetEntityId": string;
  "collisionKind": "BALL_ENEMY" | "BALL_WALL" | "BALL_OBSTACLE";
  "x": number;
  "y": number;
};

export type PlaybackDamageEvent = {
  "kind": "DAMAGE";
  "timelineTimestampMs": number;
  "sourceEntityId": string;
  "targetEntityId": string;
  "x": number;
  "y": number;
  "damage": string;
  "comboAfter": number;
  "isCrit": boolean;
};

export type PlaybackTriggerKind = "IMPACT_BURST" | "COMBO_MILESTONE" | "ENEMY_DEFEATED" | "SKILL_ACTIVATED" | "CHAIN_STARTED" | "CHAIN_EXTENDED" | "RUN_FINISHER";

export type PlaybackTriggerPlacement = "WORLD" | "UI";

export type PlaybackTriggerDetail = {
  "damage"?: string;
  "comboAfter"?: number;
  "comboThreshold"?: number;
};

export type PlaybackTriggerEvent = {
  "kind": "TRIGGER";
  "timelineTimestampMs": number;
  "placement": PlaybackTriggerPlacement;
  "triggerKind": PlaybackTriggerKind;
  "entityId"?: string;
  "targetEntityId"?: string;
  "x"?: number;
  "y"?: number;
  "detail"?: PlaybackTriggerDetail;
};

export type PlaybackPhaseEvent = {
  "kind": "PHASE";
  "timelineTimestampMs": number;
  "phase": "RUN_START" | "FINISH";
};

export type PlaybackEvent = PlaybackBallPathEvent | PlaybackCollisionEvent | PlaybackDamageEvent | PlaybackTriggerEvent | PlaybackPhaseEvent;

export type RunPlayback = {
  "durationMs": number;
  "arena": PlaybackArena;
  "entities": Array<PlaybackEntity>;
  "events": Array<PlaybackEvent>;
};

export type RunResult = {
  "totalDamage": string;
  "comboCount": number;
  "triggers": Array<RunSummaryTriggerEvent>;
  "durationMs": number;
  "playback": RunPlayback;
};

export type RewardResult = {
  "grantedResources": Record<string, string>;
  "bonusTriggers": Array<RunSummaryTriggerEvent>;
  "summary": Array<string>;
};

export type RunActionResult = {
  "player": PlayerState;
  "runResult": RunResult;
  "rewardResult": RewardResult;
};

export type RunActionResponse = {
  "success": true;
  "data": RunActionResult;
};

