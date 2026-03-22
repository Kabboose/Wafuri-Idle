export type SerializedPlayerState = {
  id: string;
  accountType: "GUEST" | "REGISTERED";
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  lastUpdateTimestampMs: number;
  createdAt: string;
  updatedAt: string;
};

export type PlayerState = {
  id: string;
  mana: bigint;
  manaGenerationRate: bigint;
  teamPower: number;
  version: number;
  lastUpdateTimestampMs: number;
  createdAt: number;
  updatedAt: number;
};

export type PlayerMutation = {
  mana: bigint;
  manaGenerationRate: bigint;
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
