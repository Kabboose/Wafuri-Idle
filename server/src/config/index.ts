/** Runtime configuration loaded from environment variables. */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET ?? "",
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
  // Default refresh token lifetime: 30 days.
  refreshTokenTtlMs: Number(process.env.REFRESH_TOKEN_TTL_MS ?? 1000 * 60 * 60 * 24 * 30)
};

/** Central game balance values used by services and utilities. */
export const GAME_CONFIG = {
  upgrade: {
    baseCost: 10,
    scaling: 1.15,
    energyPerSecondIncrement: "500000",
    teamPowerGain: 1
  },
  idle: {
    baseRate: "1000000",
    teamPowerBonusBps: 200,
    fixedScale: "1000000",
    multiplierScale: "10000",
    maxOfflineProgressMs: 1000 * 60 * 60 * 24
  },
  run: {
    runEnergyCost: "10000000"
  },
  player: {
    startingEnergy: "0",
    startingMaxEnergy: "100000000",
    startingTeamPower: 10
  }
} as const;

/** Feature switches for incomplete systems that should stay disabled by default. */
export const FEATURES = {
  gachaEnabled: false,
  multiplayerEnabled: false
} as const;

/** Validates required runtime configuration before the server starts. */
export function validateConfig(): void {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  if (!Number.isFinite(config.refreshTokenTtlMs) || config.refreshTokenTtlMs <= 0) {
    throw new Error("REFRESH_TOKEN_TTL_MS must be a positive number");
  }
}
