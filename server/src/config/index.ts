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
    runEnergyCost: "10000000",
    defaultDurationMs: 10_000,
    baseCritDamageMultiplier: "2",
    baseCritChanceScale: 10_000,
    powerScalePerTeamPower: "500",
    speedScale: 1_000,
    playbackComboMilestoneThresholds: [5, 10],
    playbackPathUnitsPerSecond: 1.5,
    playbackCollisionBeatMs: 45,
    playbackEnemyCollisionBeatMs: 55,
    playbackFlipperCollisionBeatMs: 60,
    playbackDefeatBeatMs: 120,
    playbackFinishBeatMs: 250,
    playbackMinDurationMs: 1_000,
    playbackMaxDurationMs: 30_000,
    playbackBaseVelocityUnitsPerSecond: 1.15,
    playbackGravityUnitsPerSecondSquared: 4.2,
    playbackSimulationStepMs: 32,
    playbackMaxVelocityUnitsPerSecond: 3.5,
    playbackMaxDownwardVelocityUnitsPerSecond: 2.1,
    playbackHorizontalVelocityDampingPerSecond: 0.9,
    playbackObstacleDampingActivationSpeedMultiplier: 1.2,
    playbackInitialObstacleVelocityRetention: 0.90,
    playbackObstacleVelocityRetention: 0.52,
    playbackEnemyVelocityRetention: 0.50,
    playbackEnemyCollisionRadius: 0.045,
    playbackEnemyInitialHealth: "6000",
    playfieldPlacementInset: 0.025,
    playfieldBottomExclusionStartY: 0.78,
    enemyPlacementPadding: 0.015,
    obstaclePlacementPadding: 0.015,
    mixedPlacementPadding: 0.015,
    maxPlacementRetries: 24,
    playbackFlipperWidth: 0.34,
    playbackFlipperHeight: 0.042,
    playbackFlipperTopY: 0.89,
    playbackFlipperInsetX: 0.15,
    playbackFlipperRestingAngleDegrees: 11,
    playbackFlipperActiveAngleDegrees: 27,
    playbackFlipperRelaunchSpeedMultiplier: 1.5,
    playbackFlipperImpactBoostMultiplier: 1.25,
    playbackFlipperInnerHorizontalDirection: -2,
    playbackFlipperOuterHorizontalDirection: 1,
    playbackFlipperInnerUpwardDirection: 3,
    playbackFlipperOuterUpwardDirection: 1.10,
    playbackWallInset: 0.04,
    playbackWallReboundMinNormalComponent: 0.35,
    playbackWallReboundMaxNormalComponent: 0.9
  },
  rewards: {
    currencyPerDamage: "1",
    progressionPerCombo: "1000000"
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
