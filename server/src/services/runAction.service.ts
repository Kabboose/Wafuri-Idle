import { findAccountById } from "../db/accountRepo.js";
import { findPlayerIdentityByAccountId } from "../db/identityRepo.js";
import { updatePlayerOptimistically } from "../db/playerRepository.js";
import { getCachedPlayerState, setCachedPlayerState } from "./cacheService.js";
import { applyIdleEnergy } from "./idle.service.js";
import { calculateRewards } from "./reward.service.js";
import { canStartRun, spendRunEnergy } from "./run.service.js";
import { simulateRun } from "./runSimulation.service.js";
import { stringifyFixed } from "../utils/fixedPoint.js";
import type { TeamConfig, RunResult, RewardResult } from "../utils/runTypes.js";
import type { PlayerMutation, PlayerState, SerializedPlayerState } from "../utils/playerTypes.js";

export type RunPlayerActionResult = {
  player: SerializedPlayerState;
  runResult: RunResult;
  rewardResult: RewardResult;
};

/** Builds a deterministic run seed from the orchestration inputs only. */
function buildRunSeed(accountId: string, playerId: string, teamConfig: TeamConfig, nowMs: number): string {
  return JSON.stringify({
    accountId,
    playerId,
    nowMs,
    power: teamConfig.power,
    speed: teamConfig.speed,
    critChance: teamConfig.critChance,
    runDurationMs: teamConfig.runDurationMs ?? null
  });
}

/** Serializes the internal player state into the shared API-safe player shape. */
function serializePlayer(player: PlayerState, accountType: "GUEST" | "REGISTERED"): SerializedPlayerState {
  return {
    id: player.id,
    accountType,
    energy: stringifyFixed(player.energy),
    maxEnergy: stringifyFixed(player.maxEnergy),
    currency: stringifyFixed(player.currency),
    progression: stringifyFixed(player.progression),
    energyPerSecond: stringifyFixed(player.energyPerSecond),
    teamPower: player.teamPower,
    lastUpdateTimestampMs: player.lastUpdateTimestampMs,
    createdAt: new Date(player.createdAt).toISOString(),
    updatedAt: new Date(player.updatedAt).toISOString()
  };
}

/** Applies deterministic granted resources to the mutable player snapshot. */
function applyRunRewards(player: PlayerMutation, rewardResult: RewardResult): PlayerMutation {
  const currencyReward = BigInt(rewardResult.grantedResources.currency ?? "0");
  const progressionReward = BigInt(rewardResult.grantedResources.progression ?? "0");

  return {
    ...player,
    currency: player.currency + currencyReward,
    progression: player.progression + progressionReward
  };
}

/** Runs the full player action lifecycle safely through the existing optimistic-lock persistence flow. */
export async function runPlayerAction(
  accountId: string,
  teamConfig: TeamConfig,
  nowMs: number
): Promise<RunPlayerActionResult> {
  const account = await findAccountById(accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  const playerIdentity = await findPlayerIdentityByAccountId(accountId);

  if (!playerIdentity) {
    throw new Error("Player not found");
  }

  const playerId = playerIdentity.id;
  const cachedPlayer = await getCachedPlayerState(playerId);
  let finalRunResult: RunResult | null = null;
  let finalRewardResult: RewardResult | null = null;

  const player = await updatePlayerOptimistically(playerId, cachedPlayer, (currentPlayer) => {
    const progressedPlayer = applyIdleEnergy(currentPlayer, nowMs);

    if (!canStartRun(progressedPlayer)) {
      throw new Error("Not enough energy to start run");
    }

    const spentPlayer = spendRunEnergy(progressedPlayer);
    const runResult = simulateRun({
      playerId: currentPlayer.id,
      nowMs,
      seed: buildRunSeed(accountId, currentPlayer.id, teamConfig, nowMs),
      runDurationMs: teamConfig.runDurationMs ?? 0,
      combatStats: {
        power: teamConfig.power,
        speed: teamConfig.speed,
        critChance: teamConfig.critChance
      }
    });
    const rewardResult = calculateRewards(runResult);

    finalRunResult = runResult;
    finalRewardResult = rewardResult;

    return applyRunRewards(spentPlayer, rewardResult);
  });

  if (!finalRunResult || !finalRewardResult) {
    throw new Error("Run execution failed");
  }

  await setCachedPlayerState(playerId, player);

  return {
    player: serializePlayer(player, account.type),
    runResult: finalRunResult,
    rewardResult: finalRewardResult
  };
}
