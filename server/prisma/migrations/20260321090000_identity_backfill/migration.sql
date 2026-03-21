-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('GUEST', 'REGISTERED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'GUEST',
    "username" TEXT,
    "usernameNormalized" TEXT,
    "email" TEXT,
    "emailNormalized" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "players"
ADD COLUMN     "accountId" UUID;

-- Convert phase-2.7 decimal text into the new fixed-point bigint-as-text storage format.
UPDATE "players"
SET
    "mana" = (ROUND(("mana")::NUMERIC * 1000000))::BIGINT::TEXT,
    "manaGenerationRate" = (ROUND(("manaGenerationRate")::NUMERIC * 1000000))::BIGINT::TEXT;

INSERT INTO "accounts" ("id", "type", "createdAt", "updatedAt")
SELECT "id", 'GUEST', "createdAt", "updatedAt"
FROM "players";

UPDATE "players"
SET "accountId" = "id"
WHERE "accountId" IS NULL;

ALTER TABLE "players"
ALTER COLUMN "accountId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_usernameNormalized_key" ON "accounts"("usernameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_emailNormalized_key" ON "accounts"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "players_accountId_key" ON "players"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_accountId_idx" ON "sessions"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_accountId_idx" ON "password_reset_tokens"("accountId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
