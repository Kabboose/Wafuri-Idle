export type SerializedPlayerState = {
  id: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  lastUpdateTimestamp: number;
  createdAt: string;
  updatedAt: string;
};

export type PlayerState = {
  id: string;
  mana: bigint;
  manaGenerationRate: bigint;
  teamPower: number;
  version: number;
  lastUpdateTimestamp: number;
  createdAt: number;
  updatedAt: number;
};

export type PlayerMutation = {
  mana: bigint;
  manaGenerationRate: bigint;
  teamPower: number;
  lastUpdateTimestamp: number;
};

export type AuthenticatedUser = {
  playerId: string;
};

export type AuthTokenPayload = AuthenticatedUser & {
  iat?: number;
  exp?: number;
};
