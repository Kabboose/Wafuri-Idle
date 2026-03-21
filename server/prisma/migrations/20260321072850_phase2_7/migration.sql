/*
  Warnings:

  - You are about to drop the column `lastUpdateTimestamp` on the `players` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "players" DROP COLUMN "lastUpdateTimestamp",
ADD COLUMN     "lastUpdateTimestampMs" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "mana" SET DEFAULT '0',
ALTER COLUMN "mana" SET DATA TYPE TEXT,
ALTER COLUMN "manaGenerationRate" SET DEFAULT '1000000',
ALTER COLUMN "manaGenerationRate" SET DATA TYPE TEXT;
