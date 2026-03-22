import { upgradeAccountToRegistered } from "../../db/accountRepo.js";
import { hashPassword } from "../../utils/passwordHash.js";

export type UpgradeAccountInput = {
  accountId: string;
  username: string;
  password: string;
  email: string;
};

export type UpgradeAccountResult = {
  accountId: string;
  type: "REGISTERED";
  username: string;
  email: string;
};

/**
 * Upgrades an existing guest account into a registered account.
 * Accepts the target account id plus registration credentials and returns plain account data.
 */
export async function upgradeAccount(input: UpgradeAccountInput): Promise<UpgradeAccountResult> {
  const passwordHash = await hashPassword(input.password);
  const updatedAccount = await upgradeAccountToRegistered(input.accountId, {
    username: input.username,
    email: input.email,
    passwordHash
  });

  return {
    accountId: updatedAccount.id,
    type: "REGISTERED",
    username: updatedAccount.username ?? input.username.trim(),
    email: updatedAccount.email ?? input.email.trim()
  };
}
