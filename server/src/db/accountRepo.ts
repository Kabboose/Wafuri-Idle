import { Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import type { AccountRecord, CreateAccountInput, UpdateAccountInput } from "../utils/identityTypes.js";

/** Normalizes a nullable identity field for case-insensitive uniqueness and lookup. */
function normalizeIdentityValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value.trim().toLowerCase();
}

/** Normalizes a required lookup value for case-insensitive repository queries. */
function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

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
 * Normalizes username and email values before persisting them.
 */
export async function createAccount(input: CreateAccountInput): Promise<AccountRecord> {
  const username = input.username ?? null;
  const email = input.email ?? null;

  const account = await prisma.account.create({
    data: {
      type: input.type ?? "GUEST",
      username,
      usernameNormalized: normalizeIdentityValue(username) ?? input.usernameNormalized ?? null,
      email,
      emailNormalized: normalizeIdentityValue(email) ?? input.emailNormalized ?? null,
      passwordHash: input.passwordHash ?? null
    }
  });

  return mapAccountRecord(account);
}

/** Finds an account by its primary key. */
export async function findAccountById(accountId: string): Promise<AccountRecord | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId }
  });

  return account ? mapAccountRecord(account) : null;
}

/**
 * Finds an account by username using repository-level normalization.
 */
export async function findAccountByUsername(username: string): Promise<AccountRecord | null> {
  const usernameNormalized = normalizeLookupValue(username);
  const account = await prisma.account.findUnique({
    where: { usernameNormalized }
  });

  return account ? mapAccountRecord(account) : null;
}

/**
 * Finds an account by email using repository-level normalization.
 */
export async function findAccountByEmail(email: string): Promise<AccountRecord | null> {
  const emailNormalized = normalizeLookupValue(email);
  const account = await prisma.account.findUnique({
    where: { emailNormalized }
  });

  return account ? mapAccountRecord(account) : null;
}

/**
 * Updates an account row.
 * Normalizes username and email values before persisting them.
 */
export async function updateAccount(accountId: string, input: UpdateAccountInput): Promise<AccountRecord> {
  const usernameNormalized =
    input.username !== undefined ? normalizeIdentityValue(input.username) : input.usernameNormalized;
  const emailNormalized = input.email !== undefined ? normalizeIdentityValue(input.email) : input.emailNormalized;

  const account = await prisma.account.update({
    where: { id: accountId },
    data: {
      type: input.type,
      username: input.username,
      usernameNormalized,
      email: input.email,
      emailNormalized,
      passwordHash: input.passwordHash
    }
  });

  return mapAccountRecord(account);
}

export type UpgradeRegisteredAccountInput = {
  username: string;
  email: string;
  passwordHash: string;
};

/**
 * Upgrades an existing account to a registered identity in one atomic write.
 * Relies on normalized unique constraints for username and email safety under concurrency.
 */
export async function upgradeAccountToRegistered(
  accountId: string,
  input: UpgradeRegisteredAccountInput
): Promise<AccountRecord> {
  try {
    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.account.updateMany({
        where: {
          id: accountId,
          type: "GUEST"
        },
        data: {
          type: "REGISTERED",
          username: input.username.trim(),
          usernameNormalized: normalizeLookupValue(input.username),
          email: input.email.trim(),
          emailNormalized: normalizeLookupValue(input.email),
          passwordHash: input.passwordHash
        }
      });

      if (updateResult.count !== 1) {
        const existingAccount = await tx.account.findUnique({
          where: { id: accountId }
        });

        if (!existingAccount) {
          throw new Error("Account not found");
        }

        throw new Error("Account is already registered");
      }

      const account = await tx.account.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error("Account not found");
      }

      return mapAccountRecord(account);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];

        if (targets.includes("usernameNormalized")) {
          throw new Error("Username is already in use");
        }

        if (targets.includes("emailNormalized")) {
          throw new Error("Email is already in use");
        }

        throw new Error("Account identity values must be unique");
      }
    }

    throw error;
  }
}
