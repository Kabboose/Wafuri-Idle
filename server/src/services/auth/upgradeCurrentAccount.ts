import { findPlayerById } from "../../db/playerRepo.js";
import { upgradeAccount, type UpgradeAccountInput, type UpgradeAccountResult } from "./upgradeAccount.js";

export type UpgradeCurrentAccountInput = Omit<UpgradeAccountInput, "accountId"> & {
  playerId: string;
};

/**
 * Resolves the authenticated player's account and upgrades that account to a registered identity.
 * Accepts the authenticated player id plus registration credentials.
 */
export async function upgradeCurrentAccount(input: UpgradeCurrentAccountInput): Promise<UpgradeAccountResult> {
  const player = await findPlayerById(input.playerId);

  if (!player) {
    throw new Error("Player not found");
  }

  return upgradeAccount({
    accountId: player.accountId,
    username: input.username,
    password: input.password,
    email: input.email
  });
}
