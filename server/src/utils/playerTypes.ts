export type SerializedPlayerState = {
  id: string;
  mana: number;
  manaGenerationRate: number;
  teamPower: number;
  lastUpdateTimestamp: number;
  createdAt: string;
  updatedAt: string;
};

export type PlayerState = {
  id: string;
  mana: number;
  manaGenerationRate: number;
  teamPower: number;
  lastUpdateTimestamp: number;
  createdAt: number;
  updatedAt: number;
};

export type PlayerMutation = {
  mana: number;
  manaGenerationRate: number;
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
