export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d"
};

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
    multiplierScale: "10000"
  },
  player: {
    startingMana: "0",
    startingTeamPower: 10
  }
} as const;

export const FEATURES = {
  gachaEnabled: false,
  multiplayerEnabled: false
} as const;

export function validateConfig(): void {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
}
