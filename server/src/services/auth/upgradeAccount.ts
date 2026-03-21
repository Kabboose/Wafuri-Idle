import argon2 from "argon2";

import { findAccountById, upgradeAccountToRegistered } from "../../db/accountRepo.js";

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
  const existingAccount = await findAccountById(input.accountId);

  if (!existingAccount) {
    throw new Error("Account not found");
  }

  if (existingAccount.type !== "GUEST") {
    throw new Error("Account is already registered");
  }

  const passwordHash = await argon2.hash(input.password);
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
