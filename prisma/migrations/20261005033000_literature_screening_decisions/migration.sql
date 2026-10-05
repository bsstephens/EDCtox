-- Contextual screening. Additive tables only. Publication status stays bibliographic.

CREATE TYPE "ScreeningDecision" AS ENUM ('INCLUDE', 'EXCLUDE', 'UNCERTAIN');

CREATE TYPE "ScreeningReason" AS ENUM (
    'DIRECT_HUMAN_EVIDENCE',
    'DIRECT_EXPERIMENTAL_EVIDENCE',
    'SYSTEMATIC_REVIEW',
    'META_ANALYSIS',
    'REGULATORY_REVIEW',
    'MECHANISTIC_RELEVANCE',
    'DEVELOPMENTAL_RELEVANCE',
    'REPRODUCTIVE_RELEVANCE',
    'WRONG_COMPOUND',
    'WRONG_BISPHENOL',
    'WRONG_DOMAIN',
    'EXPOSURE_ONLY',
    'ANIMAL_ONLY',
    'IN_VITRO_ONLY',
    'MIXED_OR_UNCLEAR',
    'COMMENTARY_OR_EDITORIAL',
    'NARRATIVE_REVIEW_ONLY',
    'METHOD_ONLY',
    'NON_RELEVANT_OUTCOME',
    'IRRELEVANT_KEYWORD_MATCH',
    'DUPLICATE_PUBLICATION',
    'RETRACTED',
    'FULL_TEXT_NEEDED',
    'OTHER'
);

CREATE TYPE "ScreeningConfidence" AS ENUM ('LOW', 'MODERATE', 'HIGH');

CREATE TABLE "CurationAgentRun" (
    "id" UUID NOT NULL,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputRefs" JSONB NOT NULL,
    "outputRefs" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "CurationAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiteratureScreeningDecision" (
    "id" UUID NOT NULL,
    "evidenceSourceId" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "domainCode" TEXT NOT NULL,
    "searchPurpose" "LiteratureSearchPurpose",
    "machineDecision" "ScreeningDecision",
    "machineReason" "ScreeningReason",
    "machineConfidence" "ScreeningConfidence",
    "machineRationale" TEXT,
    "curatorDecision" "ScreeningDecision",
    "curatorReasonCode" "ScreeningReason",
    "curatorNotes" TEXT,
    "screenedBy" TEXT,
    "screenedAt" TIMESTAMP(3),
    "agentRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiteratureScreeningDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiteratureScreeningDecision_evidenceSourceId_compoundId_domainCode_key"
    ON "LiteratureScreeningDecision"("evidenceSourceId", "compoundId", "domainCode");

CREATE INDEX "LiteratureScreeningDecision_compoundId_domainCode_idx"
    ON "LiteratureScreeningDecision"("compoundId", "domainCode");

CREATE INDEX "LiteratureScreeningDecision_curatorDecision_idx"
    ON "LiteratureScreeningDecision"("curatorDecision");

CREATE INDEX "LiteratureScreeningDecision_machineDecision_idx"
    ON "LiteratureScreeningDecision"("machineDecision");

CREATE INDEX "CurationAgentRun_taskType_idx" ON "CurationAgentRun"("taskType");
CREATE INDEX "CurationAgentRun_createdAt_idx" ON "CurationAgentRun"("createdAt");

ALTER TABLE "LiteratureScreeningDecision"
    ADD CONSTRAINT "LiteratureScreeningDecision_evidenceSourceId_fkey"
    FOREIGN KEY ("evidenceSourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiteratureScreeningDecision"
    ADD CONSTRAINT "LiteratureScreeningDecision_compoundId_fkey"
    FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiteratureScreeningDecision"
    ADD CONSTRAINT "LiteratureScreeningDecision_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "CurationAgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
