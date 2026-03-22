import { findAccountByUsername } from "../../db/accountRepo.js";
import { findPlayerIdentityByAccountId } from "../../db/identityRepo.js";
import { verifyPassword } from "../../utils/passwordHash.js";

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResult = {
  accountId: string;
  playerId: string;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Authenticates an account by username and password and returns the linked account/player ids.
 * Expects raw credentials and performs normalization plus password-hash verification internally.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const usernameNormalized = normalizeUsername(input.username);
  const account = await findAccountByUsername(usernameNormalized);

  if (!account?.passwordHash) {
    throw new Error("Invalid credentials");
  }

  const passwordMatches = await verifyPassword(input.password, account.passwordHash);

  if (!passwordMatches) {
    throw new Error("Invalid credentials");
  }

  const player = await findPlayerIdentityByAccountId(account.id);

  if (!player) {
    throw new Error("Player not found");
  }

  return {
    accountId: account.id,
    playerId: player.id
  };
}
