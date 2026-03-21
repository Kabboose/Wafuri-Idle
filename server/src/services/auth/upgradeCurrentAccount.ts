import { upgradeAccount, type UpgradeAccountInput, type UpgradeAccountResult } from "./upgradeAccount.js";

export type UpgradeCurrentAccountInput = UpgradeAccountInput;

/**
 * Upgrades the authenticated account to a registered identity.
 * Accepts the authoritative authenticated account id plus registration credentials.
 */
export async function upgradeCurrentAccount(input: UpgradeCurrentAccountInput): Promise<UpgradeAccountResult> {
  return upgradeAccount(input);
}
