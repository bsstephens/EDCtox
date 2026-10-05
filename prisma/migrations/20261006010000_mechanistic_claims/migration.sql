-- Abstract-level mechanistic claims. Additive only. Does not write findings or scores.

CREATE TYPE "ClaimNodeType" AS ENUM (
    'CHEMICAL',
    'RECEPTOR',
    'ENZYME',
    'GENE',
    'PROTEIN',
    'BIOMARKER',
    'CELL',
    'TISSUE',
    'ORGAN',
    'PHYSIOLOGICAL_PROCESS',
    'CELLULAR_PROCESS',
    'PHENOTYPE',
    'OUTCOME',
    'OTHER'
);

CREATE TYPE "MechanisticRelation" AS ENUM (
    'BINDS',
    'AGONIZES',
    'ANTAGONIZES',
    'INHIBITS',
    'ACTIVATES',
    'INCREASES_EXPRESSION',
    'DECREASES_EXPRESSION',
    'INCREASES_LEVEL',
    'DECREASES_LEVEL',
    'IMPAIRS_FUNCTION',
    'ENHANCES_FUNCTION',
    'CONTRIBUTES_TO',
    'ASSOCIATED_WITH',
    'NO_EFFECT',
    'OTHER'
);

CREATE TYPE "EvidenceDirectness" AS ENUM (
    'DIRECTLY_DEMONSTRATED',
    'STRONGLY_SUPPORTED',
    'CONSISTENT_WITH',
    'INFERRED',
    'HYPOTHESIZED',
    'UNKNOWN'
);

CREATE TYPE "ExtractionConfidence" AS ENUM ('LOW', 'MODERATE', 'HIGH');

CREATE TYPE "ClaimMappingState" AS ENUM ('UNMAPPED', 'CANDIDATE', 'VERIFIED');

CREATE TYPE "ClaimReviewPriority" AS ENUM ('AUTO_ACCEPT_LOW_RISK', 'REVIEW_RECOMMENDED', 'REVIEW_REQUIRED');

CREATE TYPE "ClaimTextOrigin" AS ENUM ('ABSTRACT', 'FULL_TEXT');

CREATE TABLE "MechanisticClaim" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "evidenceSourceId" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "domainCode" TEXT NOT NULL,
    "subjectType" "ClaimNodeType" NOT NULL,
    "subjectText" TEXT NOT NULL,
    "relation" "MechanisticRelation" NOT NULL,
    "objectType" "ClaimNodeType" NOT NULL,
    "objectText" TEXT NOT NULL,
    "machineDirectness" "EvidenceDirectness" NOT NULL,
    "machineConfidence" "ExtractionConfidence" NOT NULL,
    "machineRationale" TEXT NOT NULL,
    "machineMappingState" "ClaimMappingState" NOT NULL,
    "mechanismId" UUID,
    "curatorDirectness" "EvidenceDirectness",
    "curatorMappingState" "ClaimMappingState",
    "curatorVerified" BOOLEAN NOT NULL DEFAULT false,
    "curatorNote" TEXT,
    "speciesText" TEXT,
    "tissueText" TEXT,
    "cellTypeText" TEXT,
    "doseText" TEXT,
    "measureType" TEXT,
    "measureValue" TEXT,
    "measureUnit" TEXT,
    "textOrigin" "ClaimTextOrigin" NOT NULL,
    "sourceSection" TEXT NOT NULL,
    "quotedSupport" TEXT,
    "reviewPriority" "ClaimReviewPriority" NOT NULL,
    "reviewDerived" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "agentRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MechanisticClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MechanisticClaim_machine_mapping_not_verified" CHECK ("machineMappingState" <> 'VERIFIED')
);

CREATE UNIQUE INDEX "MechanisticClaim_stableKey_key" ON "MechanisticClaim"("stableKey");
CREATE INDEX "MechanisticClaim_evidenceSourceId_idx" ON "MechanisticClaim"("evidenceSourceId");
CREATE INDEX "MechanisticClaim_compoundId_idx" ON "MechanisticClaim"("compoundId");
CREATE INDEX "MechanisticClaim_mechanismId_idx" ON "MechanisticClaim"("mechanismId");
CREATE INDEX "MechanisticClaim_agentRunId_idx" ON "MechanisticClaim"("agentRunId");

ALTER TABLE "MechanisticClaim"
    ADD CONSTRAINT "MechanisticClaim_evidenceSourceId_fkey"
    FOREIGN KEY ("evidenceSourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MechanisticClaim"
    ADD CONSTRAINT "MechanisticClaim_compoundId_fkey"
    FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MechanisticClaim"
    ADD CONSTRAINT "MechanisticClaim_mechanismId_fkey"
    FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MechanisticClaim"
    ADD CONSTRAINT "MechanisticClaim_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "CurationAgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
