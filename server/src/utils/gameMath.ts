import type { Player, Prisma } from "@prisma/client";

const TEAM_POWER_BONUS_PER_POINT = 0.02;
const TEAM_POWER_UPGRADE_GAIN = 1;
const MANA_RATE_UPGRADE_GAIN = 0.5;

export function getEffectiveManaRate(player: Pick<Player, "manaGenerationRate" | "teamPower">): number {
  return player.manaGenerationRate * (1 + player.teamPower * TEAM_POWER_BONUS_PER_POINT);
}

export function buildIdleProgressUpdate(player: Player, now: Date): Prisma.PlayerUpdateInput {
  const elapsedMilliseconds = Math.max(now.getTime() - player.lastUpdateTimestamp.getTime(), 0);
  const elapsedSeconds = elapsedMilliseconds / 1000;
  const manaGain = elapsedSeconds * getEffectiveManaRate(player);

  return {
    mana: player.mana + manaGain,
    lastUpdateTimestamp: now
  };
}

export function buildUpgradeUpdate(player: Player, now: Date): Prisma.PlayerUpdateInput {
  return {
    ...buildIdleProgressUpdate(player, now),
    teamPower: player.teamPower + TEAM_POWER_UPGRADE_GAIN,
    manaGenerationRate: player.manaGenerationRate + MANA_RATE_UPGRADE_GAIN
  };
}

export function serializePlayer(player: Player) {
  return {
    id: player.id,
    mana: player.mana,
    manaGenerationRate: player.manaGenerationRate,
    teamPower: player.teamPower,
    lastUpdateTimestamp: player.lastUpdateTimestamp.getTime(),
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString()
  };
}

