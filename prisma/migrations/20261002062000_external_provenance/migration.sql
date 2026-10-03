-- Provenance layer. Existing scores, findings, and compounds are left in place.
-- New enum values are not used in this migration.

ALTER TYPE "BiologicalSex" ADD VALUE 'INTERSEX_OR_VARIANT';
ALTER TYPE "DoseMetricType" ADD VALUE 'EXTERNAL_CONCENTRATION';
ALTER TYPE "DoseMetricType" ADD VALUE 'IN_VITRO_CONCENTRATION';
ALTER TYPE "RegulatoryAgency" ADD VALUE 'AICIS';
ALTER TYPE "RegulatoryAgency" ADD VALUE 'APVMA';

CREATE TYPE "ExternalAccessType" AS ENUM ('API', 'BULK_DOWNLOAD', 'WEB_ONLY', 'FEDERATED_PORTAL', 'MANUAL_CURATED', 'UNKNOWN');
CREATE TYPE "ExternalDatasetRole" AS ENUM ('IDENTITY', 'STRUCTURE', 'ASSAY', 'IN_VIVO', 'REGULATORY', 'EXPOSURE', 'ENDOCRINE', 'FEDERATED', 'STUDY_FORMAT', 'ONTOLOGY');
CREATE TYPE "ExternalIdentifierNamespace" AS ENUM ('DTXSID', 'CAS_RN', 'PUBCHEM_CID', 'INCHI', 'INCHIKEY', 'CANONICAL_SMILES', 'EC_NUMBER', 'ECHA_SUBSTANCE_ID', 'IUCLID_UUID', 'AICIS_ID', 'APVMA_ACTIVE_ID', 'EFSA_ID', 'OTHER');
CREATE TYPE "ExternalImportStatus" AS ENUM ('NOT_IMPORTED', 'METADATA_ONLY', 'IMPORTED', 'PARTIAL', 'NEEDS_REVIEW', 'REJECTED');
CREATE TYPE "ImportRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "ExternalTermType" AS ENUM ('AOP', 'MOLECULAR_INITIATING_EVENT', 'KEY_EVENT', 'ADVERSE_OUTCOME', 'ASSAY', 'ENDPOINT', 'ONTOLOGY_TERM', 'OTHER');
CREATE TYPE "OntologyMappingType" AS ENUM ('EXACT', 'CLOSE', 'BROADER', 'NARROWER', 'RELATED', 'MANUAL_REVIEW_REQUIRED');
CREATE TYPE "GlpStatus" AS ENUM ('GLP', 'NON_GLP', 'NOT_REPORTED', 'UNKNOWN');
CREATE TYPE "KlimischReliability" AS ENUM ('K1', 'K2', 'K3', 'K4', 'NOT_ASSESSED');
CREATE TYPE "StudyPurpose" AS ENUM ('KEY_STUDY', 'SUPPORTING', 'WEIGHT_OF_EVIDENCE', 'SCREENING', 'UNSPECIFIED');
CREATE TYPE "RegulatoryConclusionKind" AS ENUM ('HAZARD_VALUE', 'ED_CONCLUSION', 'ED_ACTIVITY_ONLY', 'INVENTORY_LISTING', 'REGISTRATION_STATUS', 'OTHER');
CREATE TYPE "ReferenceDoseKind" AS ENUM ('ADI', 'TDI', 'ARFD', 'RFD', 'OTHER', 'UNSPECIFIED');

CREATE TABLE "ExternalDataset" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT,
    "apiUrl" TEXT,
    "documentationUrl" TEXT,
    "version" TEXT,
    "licence" TEXT,
    "accessType" "ExternalAccessType" NOT NULL,
    "roles" "ExternalDatasetRole"[] NOT NULL DEFAULT ARRAY[]::"ExternalDatasetRole"[],
    "lastCheckedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalImportRun" (
    "id" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sourceVersion" TEXT,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'STARTED',
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ExternalImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalRecord" (
    "id" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "compoundId" UUID,
    "importRunId" UUID,
    "externalId" TEXT NOT NULL,
    "recordType" TEXT,
    "externalUrl" TEXT,
    "sourceVersion" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "checksum" TEXT,
    "rawData" JSONB,
    "importStatus" "ExternalImportStatus" NOT NULL DEFAULT 'NOT_IMPORTED',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIdentifier" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "compoundId" UUID NOT NULL,
    "datasetId" UUID,
    "namespace" "ExternalIdentifierNamespace" NOT NULL,
    "value" TEXT NOT NULL,
    "canonical" BOOLEAN NOT NULL DEFAULT false,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalOntologyMapping" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "datasetId" UUID NOT NULL,
    "mechanismId" UUID,
    "outcomeId" UUID,
    "causalPathwayId" UUID,
    "externalTermId" TEXT NOT NULL,
    "externalTermType" "ExternalTermType" NOT NULL,
    "externalLabel" TEXT,
    "externalUrl" TEXT,
    "mappingType" "OntologyMappingType" NOT NULL,
    "confidence" "EvidenceConfidence" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalOntologyMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssayObservation" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "compoundId" UUID NOT NULL,
    "externalRecordId" UUID,
    "evidenceFindingId" UUID,
    "assaySource" TEXT NOT NULL,
    "assayId" TEXT,
    "assayName" TEXT NOT NULL,
    "targetGene" TEXT,
    "targetFamily" TEXT,
    "modeOfAction" TEXT,
    "hitCall" BOOLEAN,
    "ac50" DECIMAL(24,8),
    "ac50Unit" TEXT,
    "activityDirection" TEXT,
    "qcFlag" TEXT,
    "modelDerived" BOOLEAN NOT NULL DEFAULT false,
    "modelName" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssayObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudyMetadata" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "testGuideline" TEXT,
    "oecdGuidelineNumber" TEXT,
    "glpStatus" "GlpStatus" NOT NULL DEFAULT 'NOT_REPORTED',
    "klimischReliability" "KlimischReliability" NOT NULL DEFAULT 'NOT_ASSESSED',
    "studyPurpose" "StudyPurpose" NOT NULL DEFAULT 'UNSPECIFIED',
    "strain" TEXT,
    "assaySystem" TEXT,
    "comparator" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudyMetadata_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Compound" ADD COLUMN "inchi" TEXT,
ADD COLUMN "inchiKey" TEXT,
ADD COLUMN "canonicalSmiles" TEXT;

ALTER TABLE "EvidenceFinding" ADD COLUMN "externalRecordId" UUID;

ALTER TABLE "RegulatoryAssessment" ADD COLUMN "conclusionKind" "RegulatoryConclusionKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "referenceDoseKind" "ReferenceDoseKind" NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN "uncertaintyFactor" TEXT,
ADD COLUMN "populationBasis" TEXT,
ADD COLUMN "externalRecordId" UUID;

CREATE UNIQUE INDEX "ExternalDataset_code_key" ON "ExternalDataset"("code");
CREATE INDEX "ExternalImportRun_datasetId_startedAt_idx" ON "ExternalImportRun"("datasetId", "startedAt");
CREATE UNIQUE INDEX "ExternalRecord_datasetId_externalId_key" ON "ExternalRecord"("datasetId", "externalId");
CREATE INDEX "ExternalRecord_compoundId_idx" ON "ExternalRecord"("compoundId");
CREATE INDEX "ExternalRecord_importStatus_idx" ON "ExternalRecord"("importStatus");
CREATE UNIQUE INDEX "ExternalIdentifier_stableKey_key" ON "ExternalIdentifier"("stableKey");
CREATE INDEX "ExternalIdentifier_namespace_value_idx" ON "ExternalIdentifier"("namespace", "value");
CREATE INDEX "ExternalIdentifier_compoundId_idx" ON "ExternalIdentifier"("compoundId");
CREATE UNIQUE INDEX "ExternalIdentifier_namespace_value_compoundId_key" ON "ExternalIdentifier"("namespace", "value", "compoundId");
CREATE UNIQUE INDEX "ExternalOntologyMapping_stableKey_key" ON "ExternalOntologyMapping"("stableKey");
CREATE INDEX "ExternalOntologyMapping_datasetId_externalTermId_idx" ON "ExternalOntologyMapping"("datasetId", "externalTermId");
CREATE INDEX "ExternalOntologyMapping_mechanismId_idx" ON "ExternalOntologyMapping"("mechanismId");
CREATE INDEX "ExternalOntologyMapping_outcomeId_idx" ON "ExternalOntologyMapping"("outcomeId");
CREATE INDEX "ExternalOntologyMapping_causalPathwayId_idx" ON "ExternalOntologyMapping"("causalPathwayId");
CREATE UNIQUE INDEX "AssayObservation_stableKey_key" ON "AssayObservation"("stableKey");
CREATE INDEX "AssayObservation_compoundId_idx" ON "AssayObservation"("compoundId");
CREATE INDEX "AssayObservation_evidenceFindingId_idx" ON "AssayObservation"("evidenceFindingId");
CREATE INDEX "AssayObservation_modelName_idx" ON "AssayObservation"("modelName");
CREATE UNIQUE INDEX "StudyMetadata_findingId_key" ON "StudyMetadata"("findingId");
CREATE INDEX "Compound_inchiKey_idx" ON "Compound"("inchiKey");
CREATE INDEX "EvidenceFinding_externalRecordId_idx" ON "EvidenceFinding"("externalRecordId");
CREATE INDEX "RegulatoryAssessment_conclusionKind_idx" ON "RegulatoryAssessment"("conclusionKind");
CREATE INDEX "RegulatoryAssessment_externalRecordId_idx" ON "RegulatoryAssessment"("externalRecordId");

ALTER TABLE "ExternalImportRun" ADD CONSTRAINT "ExternalImportRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ExternalDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ExternalDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ExternalImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ExternalDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalOntologyMapping" ADD CONSTRAINT "ExternalOntologyMapping_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ExternalDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalOntologyMapping" ADD CONSTRAINT "ExternalOntologyMapping_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalOntologyMapping" ADD CONSTRAINT "ExternalOntologyMapping_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalOntologyMapping" ADD CONSTRAINT "ExternalOntologyMapping_causalPathwayId_fkey" FOREIGN KEY ("causalPathwayId") REFERENCES "CausalPathway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssayObservation" ADD CONSTRAINT "AssayObservation_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssayObservation" ADD CONSTRAINT "AssayObservation_externalRecordId_fkey" FOREIGN KEY ("externalRecordId") REFERENCES "ExternalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssayObservation" ADD CONSTRAINT "AssayObservation_evidenceFindingId_fkey" FOREIGN KEY ("evidenceFindingId") REFERENCES "EvidenceFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyMetadata" ADD CONSTRAINT "StudyMetadata_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EvidenceFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_externalRecordId_fkey" FOREIGN KEY ("externalRecordId") REFERENCES "ExternalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegulatoryAssessment" ADD CONSTRAINT "RegulatoryAssessment_externalRecordId_fkey" FOREIGN KEY ("externalRecordId") REFERENCES "ExternalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalOntologyMapping"
  ADD CONSTRAINT "ExternalOntologyMapping_one_target"
  CHECK (
    "mechanismId" IS NOT NULL
    OR "outcomeId" IS NOT NULL
    OR "causalPathwayId" IS NOT NULL
  );
