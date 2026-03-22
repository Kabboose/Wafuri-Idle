export type AccountRecord = {
  id: string;
  type: "GUEST" | "REGISTERED";
  sessionVersion: string;
  username: string | null;
  usernameNormalized: string | null;
  email: string | null;
  emailNormalized: string | null;
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountInput = {
  type?: "GUEST" | "REGISTERED";
  sessionVersion?: string;
  username?: string | null;
  usernameNormalized?: string | null;
  email?: string | null;
  emailNormalized?: string | null;
  passwordHash?: string | null;
};

export type UpdateAccountInput = {
  type?: "GUEST" | "REGISTERED";
  sessionVersion?: string;
  username?: string | null;
  usernameNormalized?: string | null;
  email?: string | null;
  emailNormalized?: string | null;
  passwordHash?: string | null;
};

export type PlayerRecord = {
  id: string;
  accountId: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  version: number;
  lastUpdateTimestampMs: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlayerInput = {
  accountId: string;
  mana: string;
  manaGenerationRate: string;
  teamPower: number;
  version?: number;
  lastUpdateTimestampMs: Date;
};

export type SessionRecord = {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSessionInput = {
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
};

export type PasswordResetTokenRecord = {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type StorePasswordResetTokenInput = {
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
};
