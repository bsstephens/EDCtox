-- Tissue, sex, dose metric, study quality, measurements, formulations, and metabolism.
-- Existing scores are kept. Physiological rows are not rewritten into toxicity numbers.

-- CreateEnum
CREATE TYPE "DoseMetricType" AS ENUM ('ADMINISTERED_DOSE', 'PRESCRIBED_DOSE', 'INTERNAL_CONCENTRATION', 'SERUM_CONCENTRATION', 'PLASMA_CONCENTRATION', 'URINARY_BIOMARKER', 'TISSUE_CONCENTRATION', 'ENVIRONMENTAL_CONCENTRATION', 'DIETARY_CONCENTRATION', 'AIR_CONCENTRATION', 'WATER_CONCENTRATION', 'BODY_BURDEN', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'NOT_APPLICABLE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "StudyQuality" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "EffectSizeType" AS ENUM ('MEAN_DIFFERENCE', 'STANDARDIZED_MEAN_DIFFERENCE', 'RISK_RATIO', 'ODDS_RATIO', 'HAZARD_RATIO', 'CORRELATION', 'REGRESSION_COEFFICIENT', 'FOLD_CHANGE', 'OTHER');

-- AlterEnum
ALTER TYPE "RecordKind" ADD VALUE 'FORMULATION';

-- AlterEnum
ALTER TYPE "RelationshipType" ADD VALUE 'CONTAINS';
ALTER TYPE "RelationshipType" ADD VALUE 'ACTIVE_INGREDIENT_OF';

-- CreateTable
CREATE TABLE "BiologicalContext" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "organ" TEXT,
    "tissue" TEXT,
    "cellType" TEXT,
    "subcellularCompartment" TEXT,
    "speciesContext" TEXT,
    "developmentalDetail" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiologicalContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetabolicTransformation" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "parentCompoundId" UUID NOT NULL,
    "productCompoundId" UUID NOT NULL,
    "enzyme" TEXT,
    "enzymeFamily" TEXT,
    "biologicalContextId" UUID,
    "transformationType" TEXT NOT NULL,
    "activeMetabolite" BOOLEAN,
    "reactiveMetabolite" BOOLEAN,
    "toxicologicallyRelevant" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetabolicTransformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceMeasurement" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "analyte" TEXT,
    "value" DECIMAL(24,8),
    "unit" TEXT,
    "comparatorValue" DECIMAL(24,8),
    "comparatorUnit" TEXT,
    "effectSize" DECIMAL(24,8),
    "effectSizeType" "EffectSizeType",
    "percentChange" DECIMAL(12,4),
    "pValue" DECIMAL(24,12),
    "confidenceIntervalLow" DECIMAL(24,8),
    "confidenceIntervalHigh" DECIMAL(24,8),
    "sampleTimepoint" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceMeasurement_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CompoundInteraction" ADD COLUMN "exposureContextId" UUID,
ADD COLUMN "biologicalContextId" UUID;

-- AlterTable
ALTER TABLE "ExposureContext" ADD COLUMN "doseMetricType" "DoseMetricType" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "MechanismAssessment" ADD COLUMN "biologicalContextId" UUID;

-- AlterTable
ALTER TABLE "CompoundOutcomeAssessment" ADD COLUMN "biologicalContextId" UUID;

-- AlterTable
ALTER TABLE "EvidenceSource" ADD COLUMN "retrievedAt" TIMESTAMP(3),
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "retracted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "correctionNotice" TEXT,
ADD COLUMN "openAccess" BOOLEAN;

-- AlterTable
ALTER TABLE "EvidenceFinding" ADD COLUMN "biologicalContextId" UUID,
ADD COLUMN "speciesCommonName" TEXT,
ADD COLUMN "speciesNcbiTaxId" INTEGER,
ADD COLUMN "sexDetail" TEXT,
ADD COLUMN "studyQuality" "StudyQuality" NOT NULL DEFAULT 'NOT_ASSESSED',
ADD COLUMN "exposureAssessmentQuality" "StudyQuality" NOT NULL DEFAULT 'NOT_ASSESSED',
ADD COLUMN "confoundingControlQuality" "StudyQuality" NOT NULL DEFAULT 'NOT_ASSESSED',
ADD COLUMN "outcomeMeasurementQuality" "StudyQuality" NOT NULL DEFAULT 'NOT_ASSESSED',
ADD COLUMN "riskOfBiasSummary" TEXT,
ADD COLUMN "doseMetricType" "DoseMetricType" NOT NULL DEFAULT 'UNKNOWN';

-- Preserve free-text sex, then replace the column with the enum.
ALTER TABLE "EvidenceFinding" ADD COLUMN "sexReported" TEXT;
UPDATE "EvidenceFinding" SET "sexReported" = "sex" WHERE "sex" IS NOT NULL AND btrim("sex") <> '';

ALTER TABLE "EvidenceFinding" ADD COLUMN "sexEnum" "BiologicalSex";

UPDATE "EvidenceFinding"
SET "sexEnum" = CASE
  WHEN "sex" IS NULL OR btrim("sex") = '' THEN 'UNSPECIFIED'::"BiologicalSex"
  WHEN lower(btrim("sex")) IN ('mixed', 'both', 'both sexes', 'male and female', 'males and females') THEN 'MIXED'::"BiologicalSex"
  WHEN lower(btrim("sex")) IN ('female', 'females', 'f') THEN 'FEMALE'::"BiologicalSex"
  WHEN lower(btrim("sex")) IN ('male', 'males', 'm') THEN 'MALE'::"BiologicalSex"
  WHEN lower(btrim("sex")) IN ('not applicable', 'n/a', 'na', 'none') THEN 'NOT_APPLICABLE'::"BiologicalSex"
  ELSE 'UNSPECIFIED'::"BiologicalSex"
END;

UPDATE "EvidenceFinding"
SET "sexDetail" = "sexReported"
WHERE "sexReported" IS NOT NULL;

UPDATE "EvidenceFinding"
SET "sexEnum" = 'NOT_APPLICABLE'::"BiologicalSex"
WHERE ("sex" IS NULL OR btrim("sex") = '')
  AND lower(btrim("species")) IN ('not applicable', 'n/a', 'na');

ALTER TABLE "EvidenceFinding" DROP COLUMN "sex";
ALTER TABLE "EvidenceFinding" DROP COLUMN "sexReported";
ALTER TABLE "EvidenceFinding" RENAME COLUMN "sexEnum" TO "sex";
ALTER TABLE "EvidenceFinding" ALTER COLUMN "sex" SET DEFAULT 'UNSPECIFIED';
ALTER TABLE "EvidenceFinding" ALTER COLUMN "sex" SET NOT NULL;

-- AlterTable
ALTER TABLE "AssessmentRevision" ADD COLUMN "previousSnapshot" JSONB,
ADD COLUMN "newSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "BiologicalContext_stableKey_key" ON "BiologicalContext"("stableKey");
CREATE INDEX "BiologicalContext_organ_idx" ON "BiologicalContext"("organ");
CREATE INDEX "BiologicalContext_cellType_idx" ON "BiologicalContext"("cellType");

CREATE UNIQUE INDEX "MetabolicTransformation_stableKey_key" ON "MetabolicTransformation"("stableKey");
CREATE INDEX "MetabolicTransformation_parentCompoundId_idx" ON "MetabolicTransformation"("parentCompoundId");
CREATE INDEX "MetabolicTransformation_productCompoundId_idx" ON "MetabolicTransformation"("productCompoundId");

CREATE INDEX "EvidenceMeasurement_findingId_idx" ON "EvidenceMeasurement"("findingId");
CREATE INDEX "EvidenceMeasurement_endpoint_idx" ON "EvidenceMeasurement"("endpoint");

CREATE INDEX "ExposureContext_doseMetricType_idx" ON "ExposureContext"("doseMetricType");
CREATE INDEX "MechanismAssessment_biologicalContextId_idx" ON "MechanismAssessment"("biologicalContextId");
CREATE INDEX "CompoundOutcomeAssessment_biologicalContextId_idx" ON "CompoundOutcomeAssessment"("biologicalContextId");
CREATE INDEX "EvidenceFinding_biologicalContextId_idx" ON "EvidenceFinding"("biologicalContextId");
CREATE INDEX "EvidenceFinding_sex_idx" ON "EvidenceFinding"("sex");
CREATE INDEX "EvidenceFinding_studyQuality_idx" ON "EvidenceFinding"("studyQuality");
CREATE INDEX "EvidenceFinding_doseMetricType_idx" ON "EvidenceFinding"("doseMetricType");

-- AddForeignKey
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_exposureContextId_fkey" FOREIGN KEY ("exposureContextId") REFERENCES "ExposureContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_biologicalContextId_fkey" FOREIGN KEY ("biologicalContextId") REFERENCES "BiologicalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetabolicTransformation" ADD CONSTRAINT "MetabolicTransformation_parentCompoundId_fkey" FOREIGN KEY ("parentCompoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetabolicTransformation" ADD CONSTRAINT "MetabolicTransformation_productCompoundId_fkey" FOREIGN KEY ("productCompoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetabolicTransformation" ADD CONSTRAINT "MetabolicTransformation_biologicalContextId_fkey" FOREIGN KEY ("biologicalContextId") REFERENCES "BiologicalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MechanismAssessment" ADD CONSTRAINT "MechanismAssessment_biologicalContextId_fkey" FOREIGN KEY ("biologicalContextId") REFERENCES "BiologicalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompoundOutcomeAssessment" ADD CONSTRAINT "CompoundOutcomeAssessment_biologicalContextId_fkey" FOREIGN KEY ("biologicalContextId") REFERENCES "BiologicalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_biologicalContextId_fkey" FOREIGN KEY ("biologicalContextId") REFERENCES "BiologicalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceMeasurement" ADD CONSTRAINT "EvidenceMeasurement_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EvidenceFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Direction and score stay consistent. UNKNOWN may still carry a score.
ALTER TABLE "MechanismAssessment"
  ADD CONSTRAINT "MechanismAssessment_direction_score"
  CHECK (
    ("effectDirection" <> 'PHYSIOLOGICAL' OR ("effectScore" IS NULL AND "quantitativeScoreSupported" = false))
    AND ("effectDirection" <> 'PROTECTIVE' OR "effectScore" IS NULL OR "effectScore" <= 0)
    AND ("effectDirection" <> 'DISRUPTIVE' OR "effectScore" IS NULL OR "effectScore" >= 0)
  );

ALTER TABLE "CompoundOutcomeAssessment"
  ADD CONSTRAINT "CompoundOutcomeAssessment_direction_score"
  CHECK (
    ("effectDirection" <> 'PHYSIOLOGICAL' OR ("effectScore" IS NULL AND "quantitativeScoreSupported" = false))
    AND ("effectDirection" <> 'PROTECTIVE' OR "effectScore" IS NULL OR "effectScore" <= 0)
    AND ("effectDirection" <> 'DISRUPTIVE' OR "effectScore" IS NULL OR "effectScore" >= 0)
  );

ALTER TABLE "CompoundInteraction"
  ADD CONSTRAINT "CompoundInteraction_direction_score"
  CHECK (
    "effectScore" IS NULL
    OR (
      ("interactionType" = 'PROTECTS_AGAINST' AND "effectScore" <= 0)
      OR ("interactionType" = 'POTENTIATES' AND "effectScore" >= 0)
      OR ("interactionType" NOT IN ('PROTECTS_AGAINST', 'POTENTIATES'))
    )
  );
