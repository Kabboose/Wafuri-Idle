ALTER TABLE "players"
RENAME COLUMN "mana" TO "energy";

ALTER TABLE "players"
RENAME COLUMN "manaGenerationRate" TO "energyPerSecond";
