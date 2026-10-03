-- Gut, microbiome, and endothelial mechanisms.
-- New values are added here and used later by the seed, not in this file.

ALTER TYPE "OutcomeCategory" ADD VALUE 'GASTROINTESTINAL';
ALTER TYPE "OutcomeCategory" ADD VALUE 'VASCULAR';

CREATE TYPE "MicrobiomeSequencingMethod" AS ENUM (
    'CULTURE',
    'QPCR',
    'SIXTEEN_S_RRNA',
    'SHOTGUN_METAGENOMICS',
    'METATRANSCRIPTOMICS',
    'METAPROTEOMICS',
    'METABOLOMICS',
    'MULTI_OMICS',
    'OTHER',
    'UNKNOWN'
);

CREATE TABLE "MechanismFamily" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanismFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MechanismFamily_code_key" ON "MechanismFamily"("code");

ALTER TABLE "Mechanism" ADD COLUMN "familyId" UUID,
ADD COLUMN "quantitativeScoreByDefault" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Mechanism_familyId_idx" ON "Mechanism"("familyId");

ALTER TABLE "Mechanism" ADD CONSTRAINT "Mechanism_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "MechanismFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MicrobiomeStudyMetadata" (
    "id" UUID NOT NULL,
    "evidenceFindingId" UUID NOT NULL,
    "sampleSite" TEXT,
    "sampleType" TEXT,
    "sequencingMethod" "MicrobiomeSequencingMethod",
    "taxonomicResolution" TEXT,
    "functionalProfiling" BOOLEAN,
    "metabolomicsAvailable" BOOLEAN,
    "dietControlled" BOOLEAN,
    "antibioticControlled" BOOLEAN,
    "probioticControlled" BOOLEAN,
    "batchEffectsAddressed" BOOLEAN,
    "longitudinal" BOOLEAN,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrobiomeStudyMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MicrobiomeStudyMetadata_evidenceFindingId_key" ON "MicrobiomeStudyMetadata"("evidenceFindingId");

ALTER TABLE "MicrobiomeStudyMetadata" ADD CONSTRAINT "MicrobiomeStudyMetadata_evidenceFindingId_fkey" FOREIGN KEY ("evidenceFindingId") REFERENCES "EvidenceFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
