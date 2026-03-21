/** Runtime configuration loaded from environment variables. */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d"
};

/** Central game balance values used by services and utilities. */
export const GAME_CONFIG = {
  upgrade: {
    baseCost: 10,
    scaling: 1.15,
    manaGenerationRateIncrement: "500000",
    teamPowerGain: 1
  },
  idle: {
    baseRate: "1000000",
    teamPowerBonusBps: 200,
    fixedScale: "1000000",
    multiplierScale: "10000",
    maxOfflineProgressMs: 1000 * 60 * 60 * 24
  },
  player: {
    startingMana: "0",
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
}
