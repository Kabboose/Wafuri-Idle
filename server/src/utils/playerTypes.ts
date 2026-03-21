export type SerializedPlayerState = {
  id: string;
  mana: number;
  manaGenerationRate: number;
  teamPower: number;
  lastUpdateTimestamp: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  playerId: string;
};

