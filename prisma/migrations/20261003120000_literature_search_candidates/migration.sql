-- Phase 3A: candidate publications and a reconstructable search log.
-- New literature rows are not findings and do not change assessments.

ALTER TYPE "EvidenceType" ADD VALUE 'UNSPECIFIED';

CREATE TYPE "CompoundCurationStatus" AS ENUM (
    'UNREVIEWED',
    'IDENTITY_VERIFIED',
    'EVIDENCE_GATHERING',
    'EVIDENCE_TRIAGED',
    'EVIDENCE_REVIEWED',
    'SCORES_CURATED',
    'NEEDS_UPDATE'
);

CREATE TYPE "PublicationCurationStatus" AS ENUM (
    'DISCOVERED',
    'SCREENING_PENDING',
    'INCLUDED',
    'EXCLUDED',
    'DUPLICATE',
    'RETRACTED'
);

CREATE TYPE "LiteratureProvider" AS ENUM ('PUBMED', 'EUROPE_PMC');

CREATE TYPE "LiteratureSearchPurpose" AS ENUM (
    'SYSTEMATIC_REVIEWS',
    'HUMAN_REPRODUCTIVE',
    'CONTRADICTORY_OR_NULL'
);

CREATE TYPE "LiteratureSearchStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'PARTIAL', 'FAILED');

CREATE TYPE "LiteratureHitDisposition" AS ENUM ('INSERTED', 'DUPLICATE', 'CONFLICT', 'SKIPPED');

ALTER TABLE "Compound"
    ADD COLUMN "curationStatus" "CompoundCurationStatus" NOT NULL DEFAULT 'UNREVIEWED',
    ADD COLUMN "lastEvidenceSearchAt" TIMESTAMP(3),
    ADD COLUMN "lastManualReviewAt" TIMESTAMP(3),
    ADD COLUMN "evidenceCutoffAt" TIMESTAMP(3),
    ADD COLUMN "curationNotes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "EvidenceSource"
    ADD COLUMN "publicationStatus" "PublicationCurationStatus",
    ADD COLUMN "pmcid" TEXT;

CREATE INDEX "EvidenceSource_publicationStatus_idx" ON "EvidenceSource"("publicationStatus");

CREATE TABLE "LiteratureSearchRun" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "provider" "LiteratureProvider" NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryVersion" TEXT NOT NULL,
    "purpose" "LiteratureSearchPurpose" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "providerReportedCount" INTEGER,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "LiteratureSearchStatus" NOT NULL,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteratureSearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiteratureSearchHit" (
    "id" UUID NOT NULL,
    "searchRunId" UUID NOT NULL,
    "sourceId" UUID,
    "doi" TEXT,
    "pmid" TEXT,
    "pmcid" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "disposition" "LiteratureHitDisposition" NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteratureSearchHit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiteratureSearchRun_compoundId_idx" ON "LiteratureSearchRun"("compoundId");
CREATE INDEX "LiteratureSearchRun_purpose_idx" ON "LiteratureSearchRun"("purpose");
CREATE INDEX "LiteratureSearchRun_status_idx" ON "LiteratureSearchRun"("status");

CREATE INDEX "LiteratureSearchHit_searchRunId_idx" ON "LiteratureSearchHit"("searchRunId");
CREATE INDEX "LiteratureSearchHit_sourceId_idx" ON "LiteratureSearchHit"("sourceId");
CREATE INDEX "LiteratureSearchHit_doi_idx" ON "LiteratureSearchHit"("doi");
CREATE INDEX "LiteratureSearchHit_pmid_idx" ON "LiteratureSearchHit"("pmid");

ALTER TABLE "LiteratureSearchRun"
    ADD CONSTRAINT "LiteratureSearchRun_compoundId_fkey"
    FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiteratureSearchHit"
    ADD CONSTRAINT "LiteratureSearchHit_searchRunId_fkey"
    FOREIGN KEY ("searchRunId") REFERENCES "LiteratureSearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiteratureSearchHit"
    ADD CONSTRAINT "LiteratureSearchHit_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
