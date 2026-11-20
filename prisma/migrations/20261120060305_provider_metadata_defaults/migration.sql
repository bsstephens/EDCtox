-- AlterTable
ALTER TABLE "EvidenceSource" ALTER COLUMN "meshDescriptors" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "meshSubstances" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "publicationTypes" SET DEFAULT ARRAY[]::TEXT[];

-- Rows created before these columns existed hold NULL rather than an empty array, which makes
-- "no provider metadata" indistinguishable from "not yet looked up" in a query. Normalise them.
UPDATE "EvidenceSource" SET "publicationTypes" = '{}' WHERE "publicationTypes" IS NULL;
UPDATE "EvidenceSource" SET "meshDescriptors" = '{}' WHERE "meshDescriptors" IS NULL;
UPDATE "EvidenceSource" SET "meshSubstances" = '{}' WHERE "meshSubstances" IS NULL;
