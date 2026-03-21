import { prisma } from "./prisma.js";
import type { AccountRecord, CreateAccountInput } from "../utils/identityTypes.js";

function mapAccountRecord(account: {
  id: string;
  type: "GUEST" | "REGISTERED";
  username: string | null;
  usernameNormalized: string | null;
  email: string | null;
  emailNormalized: string | null;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AccountRecord {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    usernameNormalized: account.usernameNormalized,
    email: account.email,
    emailNormalized: account.emailNormalized,
    passwordHash: account.passwordHash,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

/**
 * Creates an account row.
 * Expects username/email normalization to already be applied by the caller.
 */
export async function createAccount(input: CreateAccountInput): Promise<AccountRecord> {
  const account = await prisma.account.create({
    data: {
      type: input.type ?? "GUEST",
      username: input.username ?? null,
      usernameNormalized: input.usernameNormalized ?? null,
      email: input.email ?? null,
      emailNormalized: input.emailNormalized ?? null,
      passwordHash: input.passwordHash ?? null
    }
  });

  return mapAccountRecord(account);
}

/**
 * Finds an account by normalized username.
 * Expects a pre-normalized username string.
 */
export async function findAccountByUsername(usernameNormalized: string): Promise<AccountRecord | null> {
  const account = await prisma.account.findUnique({
    where: { usernameNormalized }
  });

  return account ? mapAccountRecord(account) : null;
}

/**
 * Finds an account by normalized email.
 * Expects a pre-normalized email string.
 */
export async function findAccountByEmail(emailNormalized: string): Promise<AccountRecord | null> {
  const account = await prisma.account.findUnique({
    where: { emailNormalized }
  });

  return account ? mapAccountRecord(account) : null;
}

