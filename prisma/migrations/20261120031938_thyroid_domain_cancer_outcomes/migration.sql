-- CreateEnum
CREATE TYPE "DomainTrack" AS ENUM ('ENDOCRINE_DISRUPTION', 'CELLULAR_BIOENERGETIC', 'CONTEXTUAL');

-- CreateEnum
CREATE TYPE "KeyCharacteristic" AS ENUM ('KC1_RECEPTOR_AGONIST', 'KC2_RECEPTOR_ANTAGONIST', 'KC3_RECEPTOR_EXPRESSION', 'KC4_SIGNAL_TRANSDUCTION', 'KC5_EPIGENETIC', 'KC6_HORMONE_SYNTHESIS', 'KC7_HORMONE_TRANSPORT', 'KC8_HORMONE_DISTRIBUTION', 'KC9_HORMONE_METABOLISM', 'KC10_CELL_FATE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutcomeCategory" ADD VALUE 'THYROID';
ALTER TYPE "OutcomeCategory" ADD VALUE 'NEURODEVELOPMENTAL';
ALTER TYPE "OutcomeCategory" ADD VALUE 'CANCER';

-- AlterTable
ALTER TABLE "BiologicalDomain" ADD COLUMN     "track" "DomainTrack" NOT NULL DEFAULT 'ENDOCRINE_DISRUPTION';

-- AlterTable
ALTER TABLE "CausalPathway" ADD COLUMN     "aopWikiId" TEXT,
ADD COLUMN     "outcomeId" UUID;

-- AlterTable
ALTER TABLE "Mechanism" ADD COLUMN     "keyCharacteristic" "KeyCharacteristic";

-- CreateTable
CREATE TABLE "CausalPathwayStep" (
    "id" UUID NOT NULL,
    "pathwayId" UUID NOT NULL,
    "mechanismId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "CausalPathwayStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CausalPathwayStep_pathwayId_stepOrder_idx" ON "CausalPathwayStep"("pathwayId", "stepOrder");

-- CreateIndex
CREATE INDEX "CausalPathwayStep_mechanismId_idx" ON "CausalPathwayStep"("mechanismId");

-- CreateIndex
CREATE UNIQUE INDEX "CausalPathwayStep_pathwayId_mechanismId_key" ON "CausalPathwayStep"("pathwayId", "mechanismId");

-- CreateIndex
CREATE INDEX "CausalPathway_outcomeId_idx" ON "CausalPathway"("outcomeId");

-- AddForeignKey
ALTER TABLE "CausalPathway" ADD CONSTRAINT "CausalPathway_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalPathwayStep" ADD CONSTRAINT "CausalPathwayStep_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "CausalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalPathwayStep" ADD CONSTRAINT "CausalPathwayStep_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "LiteratureScreeningDecision_evidenceSourceId_compoundId_domainC" RENAME TO "LiteratureScreeningDecision_evidenceSourceId_compoundId_dom_key";
