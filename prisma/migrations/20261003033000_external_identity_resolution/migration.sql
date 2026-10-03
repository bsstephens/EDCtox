-- Provider policy and identity-resolution audit.
-- Existing rows default to link-only. The seed sets the real mode afterwards.

CREATE TYPE "ExternalAccessMode" AS ENUM (
    'LINK_ONLY',
    'LIVE_API',
    'SNAPSHOT_CACHE',
    'CURATED_IMPORT',
    'BULK_REFERENCE',
    'MANUAL_REVIEW'
);

CREATE TYPE "IdentityResolutionStatus" AS ENUM (
    'VERIFIED',
    'PROBABLE',
    'AMBIGUOUS',
    'CONFLICT',
    'NOT_FOUND',
    'MANUAL_REVIEW_REQUIRED'
);

ALTER TABLE "ExternalDataset"
    ADD COLUMN "accessMode" "ExternalAccessMode" NOT NULL DEFAULT 'LINK_ONLY',
    ADD COLUMN "requiresApiKey" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ExternalIdentifier"
    ADD COLUMN "resolutionStatus" "IdentityResolutionStatus",
    ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "ExternalRecord"
    ADD COLUMN "sourceModifiedAt" TIMESTAMP(3),
    ADD COLUMN "expiresAt" TIMESTAMP(3),
    ADD COLUMN "etag" TEXT;

CREATE TABLE "IdentityResolutionAttempt" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "importRunId" UUID,
    "queryType" TEXT NOT NULL,
    "queryValue" TEXT NOT NULL,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectedExternalId" TEXT,
    "resolutionStatus" "IdentityResolutionStatus" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityResolutionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityResolutionAttempt_compoundId_createdAt_idx" ON "IdentityResolutionAttempt"("compoundId", "createdAt");
CREATE INDEX "IdentityResolutionAttempt_datasetId_idx" ON "IdentityResolutionAttempt"("datasetId");

ALTER TABLE "IdentityResolutionAttempt" ADD CONSTRAINT "IdentityResolutionAttempt_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityResolutionAttempt" ADD CONSTRAINT "IdentityResolutionAttempt_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ExternalDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityResolutionAttempt" ADD CONSTRAINT "IdentityResolutionAttempt_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ExternalImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
