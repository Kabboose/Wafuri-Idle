export type SerializedPlayerState = {
  id: string;
  accountType: "GUEST" | "REGISTERED";
  energy: string;
  maxEnergy: string;
  energyPerSecond: string;
  teamPower: number;
  lastUpdateTimestampMs: number;
  createdAt: string;
  updatedAt: string;
};

export type PlayerState = {
  id: string;
  energy: bigint;
  maxEnergy: bigint;
  energyPerSecond: bigint;
  teamPower: number;
  version: number;
  lastUpdateTimestampMs: number;
  createdAt: number;
  updatedAt: number;
};

export type PlayerMutation = {
  energy: bigint;
  maxEnergy: bigint;
  energyPerSecond: bigint;
  teamPower: number;
  lastUpdateTimestampMs: number;
};

export type AuthenticatedUser = {
  accountId: string;
  playerId: string;
};

export type AuthTokenPayload = AuthenticatedUser & {
  sessionVersion: string;
  iat?: number;
  exp?: number;
};
