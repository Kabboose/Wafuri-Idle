import argon2 from "argon2";

import { findAccountByEmail, findAccountById, findAccountByUsername, updateAccount } from "../../db/accountRepo.js";

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

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Upgrades an existing guest account into a registered account.
 * Accepts the target account id plus registration credentials and returns plain account data.
 */
export async function upgradeAccount(input: UpgradeAccountInput): Promise<UpgradeAccountResult> {
  const account = await findAccountById(input.accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  const username = input.username.trim();
  const email = input.email.trim();
  const usernameNormalized = normalizeUsername(input.username);
  const emailNormalized = normalizeEmail(input.email);

  const existingUsernameAccount = await findAccountByUsername(usernameNormalized);

  if (existingUsernameAccount && existingUsernameAccount.id !== account.id) {
    throw new Error("Username is already in use");
  }

  const existingEmailAccount = await findAccountByEmail(emailNormalized);

  if (existingEmailAccount && existingEmailAccount.id !== account.id) {
    throw new Error("Email is already in use");
  }

  const passwordHash = await argon2.hash(input.password);
  const updatedAccount = await updateAccount(account.id, {
    type: "REGISTERED",
    username,
    usernameNormalized,
    email,
    emailNormalized,
    passwordHash
  });

  return {
    accountId: updatedAccount.id,
    type: "REGISTERED",
    username: updatedAccount.username ?? username,
    email: updatedAccount.email ?? email
  };
}
