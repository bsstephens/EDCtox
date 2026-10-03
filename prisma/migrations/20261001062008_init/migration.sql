-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('READER', 'CURATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompoundType" AS ENUM ('PHARMACEUTICAL', 'HORMONE', 'PESTICIDE', 'HERBICIDE', 'FUNGICIDE', 'INSECTICIDE', 'PLASTICISER', 'BISPHENOL', 'PFAS', 'FLAME_RETARDANT', 'INDUSTRIAL_CHEMICAL', 'METABOLITE', 'POLLUTANT', 'COSMETIC_INGREDIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CurrentUseStatus" AS ENUM ('IN_CURRENT_USE', 'RESTRICTED', 'BANNED_OR_WITHDRAWN', 'LEGACY', 'RESEARCH_ONLY', 'ENDOGENOUS', 'CLASS_PLACEHOLDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecordKind" AS ENUM ('SPECIFIC_COMPOUND', 'REPRESENTATIVE_STAND_IN', 'CLASS_PLACEHOLDER');

-- CreateEnum
CREATE TYPE "AliasType" AS ENUM ('COMMON_NAME', 'IUPAC', 'ABBREVIATION', 'TRADE_NAME', 'CAS_NAME', 'SYNONYM', 'FORMER_NAME');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('METABOLITE_OF', 'BREAKDOWN_PRODUCT_OF', 'REPLACEMENT_FOR', 'ANALOG_OF', 'ISOMER_OF', 'CO_FORMULANT_WITH', 'ANTAGONIZES_TOXICITY_OF', 'POTENTIATES_TOXICITY_OF', 'PROTECTS_AGAINST', 'SYNERGIZES_WITH');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('PROTECTS_AGAINST', 'POTENTIATES', 'SYNERGIZES', 'ANTAGONIZES', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExposureRoute" AS ENUM ('ORAL', 'DERMAL', 'INHALATION', 'INJECTION', 'TRANSPLACENTAL', 'LACTATIONAL', 'ENVIRONMENTAL_MEDIA', 'MULTIPLE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "LifeStage" AS ENUM ('PRECONCEPTION', 'GAMETE', 'EMBRYO', 'FETUS', 'NEONATAL', 'INFANT', 'EARLY_CHILDHOOD', 'CHILDHOOD', 'PUBERTY', 'ADOLESCENCE', 'ADULT', 'PREGNANCY', 'OLDER_ADULT');

-- CreateEnum
CREATE TYPE "ExposureType" AS ENUM ('THERAPEUTIC', 'ENVIRONMENTAL', 'DIETARY', 'OCCUPATIONAL', 'ACCIDENTAL', 'RECREATIONAL', 'EXPERIMENTAL');

-- CreateEnum
CREATE TYPE "TherapeuticVsEnvironmental" AS ENUM ('THERAPEUTIC', 'ENVIRONMENTAL', 'BOTH', 'NEITHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RealWorldRelevance" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ScorePolicy" AS ENUM ('SCORABLE', 'RESEARCH_ONLY', 'GROUPING_ONLY');

-- CreateEnum
CREATE TYPE "EffectDirection" AS ENUM ('PROTECTIVE', 'DISRUPTIVE', 'PHYSIOLOGICAL', 'BIPHASIC', 'CONTEXT_DEPENDENT', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActivityMagnitude" AS ENUM ('NONE', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EvidenceConfidence" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "HumanRelevance" AS ENUM ('H0', 'H1', 'H2', 'H3', 'H4');

-- CreateEnum
CREATE TYPE "DevelopmentalSensitivity" AS ENUM ('NONE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DoseResponse" AS ENUM ('MONOTONIC', 'NON_MONOTONIC', 'BIPHASIC', 'THRESHOLD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Reversibility" AS ENUM ('REVERSIBLE', 'PARTIALLY_REVERSIBLE', 'POTENTIALLY_IRREVERSIBLE', 'IRREVERSIBLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CurationStatus" AS ENUM ('SEED_HYPOTHESIS', 'CURATED', 'CONFLICTING', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "OutcomeCategory" AS ENUM ('REPRODUCTIVE', 'DEVELOPMENTAL', 'NEUROENDOCRINE', 'IMMUNE', 'METABOLIC', 'MITOCHONDRIAL', 'REDOX', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IN_VITRO', 'CELLULAR', 'EX_VIVO', 'ANIMAL', 'HUMAN_OBSERVATIONAL', 'HUMAN_PROSPECTIVE', 'RANDOMIZED_TRIAL', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW', 'REGULATORY_ASSESSMENT', 'MECHANISTIC_REVIEW');

-- CreateEnum
CREATE TYPE "StudyDesign" AS ENUM ('IN_VITRO_ASSAY', 'CELL_CULTURE', 'EX_VIVO', 'ACUTE_ANIMAL', 'REPEATED_DOSE_ANIMAL', 'DEVELOPMENTAL_ANIMAL', 'MULTIGENERATIONAL_ANIMAL', 'CROSS_SECTIONAL', 'CASE_CONTROL', 'COHORT', 'RANDOMIZED_TRIAL', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW', 'REGULATORY_REVIEW', 'MECHANISTIC_SUMMARY', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegulatoryAgency" AS ENUM ('EFSA', 'ECHA', 'EPA', 'TGA', 'FDA', 'WHO', 'IARC', 'NASEM', 'OTHER');

-- CreateEnum
CREATE TYPE "DataGapPriority" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DataGapReason" AS ENUM ('UNKNOWN_EFFECT', 'CONFLICTING_EVIDENCE', 'INSUFFICIENT_HUMAN_EVIDENCE', 'DOSE_RELEVANCE_UNCERTAIN', 'DEVELOPMENTAL_RELEVANCE_UNCERTAIN', 'NOT_YET_CURATED', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'READER',
    "externalAuthId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compound" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "compoundType" "CompoundType" NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "currentUseStatus" "CurrentUseStatus" NOT NULL DEFAULT 'UNKNOWN',
    "recordKind" "RecordKind" NOT NULL DEFAULT 'SPECIFIC_COMPOUND',
    "casNumber" TEXT,
    "pubChemCid" INTEGER,
    "molecularFormula" TEXT,
    "molarMass" DECIMAL(12,4),
    "parentCompoundId" UUID,
    "isMetabolite" BOOLEAN NOT NULL DEFAULT false,
    "isMixture" BOOLEAN NOT NULL DEFAULT false,
    "isEndogenous" BOOLEAN NOT NULL DEFAULT false,
    "isPharmaceutical" BOOLEAN NOT NULL DEFAULT false,
    "isEnvironmentalChemical" BOOLEAN NOT NULL DEFAULT false,
    "legacyChemical" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundAlias" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliasType" "AliasType" NOT NULL,

    CONSTRAINT "CompoundAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundRelationship" (
    "id" UUID NOT NULL,
    "sourceCompoundId" UUID NOT NULL,
    "targetCompoundId" UUID NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "CompoundRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundInteraction" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "compoundAId" UUID NOT NULL,
    "compoundBId" UUID NOT NULL,
    "interactionType" "InteractionType" NOT NULL,
    "domainId" UUID,
    "mechanismId" UUID,
    "effectScore" INTEGER,
    "confidence" "EvidenceConfidence" NOT NULL,
    "humanRelevance" "HumanRelevance" NOT NULL,
    "summary" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "curationStatus" "CurationStatus" NOT NULL DEFAULT 'SEED_HYPOTHESIS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompoundInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExposureContext" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "contextKey" TEXT NOT NULL,
    "route" "ExposureRoute" NOT NULL DEFAULT 'UNSPECIFIED',
    "population" TEXT NOT NULL,
    "lifeStage" "LifeStage" NOT NULL,
    "exposureType" "ExposureType" NOT NULL,
    "doseValue" DECIMAL(24,8),
    "doseUnit" TEXT,
    "doseRangeText" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "therapeuticVsEnvironmental" "TherapeuticVsEnvironmental" NOT NULL DEFAULT 'UNKNOWN',
    "occupational" BOOLEAN NOT NULL DEFAULT false,
    "developmentalWindow" TEXT,
    "maternalExposure" BOOLEAN NOT NULL DEFAULT false,
    "realWorldRelevance" "RealWorldRelevance" NOT NULL DEFAULT 'UNCERTAIN',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExposureContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiologicalDomain" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contributesToProfile" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "BiologicalDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mechanism" (
    "id" UUID NOT NULL,
    "domainId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentMechanismId" UUID,
    "aggregationGroup" TEXT NOT NULL,
    "scorePolicy" "ScorePolicy" NOT NULL DEFAULT 'SCORABLE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Mechanism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausalPathway" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "CausalPathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanismAssessment" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "mechanismId" UUID NOT NULL,
    "exposureContextId" UUID,
    "causalPathwayId" UUID,
    "assessmentKey" TEXT NOT NULL DEFAULT 'default',
    "effectScore" INTEGER,
    "effectDirection" "EffectDirection" NOT NULL,
    "activityMagnitude" "ActivityMagnitude" NOT NULL,
    "evidenceConfidence" "EvidenceConfidence" NOT NULL,
    "humanRelevance" "HumanRelevance" NOT NULL,
    "developmentalSensitivity" "DevelopmentalSensitivity" NOT NULL DEFAULT 'UNKNOWN',
    "doseResponse" "DoseResponse" NOT NULL DEFAULT 'UNKNOWN',
    "reversibility" "Reversibility" NOT NULL DEFAULT 'UNKNOWN',
    "conflictingEvidence" BOOLEAN NOT NULL DEFAULT false,
    "insufficientHumanEvidence" BOOLEAN NOT NULL DEFAULT false,
    "doseRelevanceUncertain" BOOLEAN NOT NULL DEFAULT false,
    "developmentalRelevanceUncertain" BOOLEAN NOT NULL DEFAULT false,
    "quantitativeScoreSupported" BOOLEAN NOT NULL DEFAULT false,
    "curationStatus" "CurationStatus" NOT NULL DEFAULT 'SEED_HYPOTHESIS',
    "effectSummary" TEXT NOT NULL,
    "mechanismSummary" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanismAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OutcomeCategory" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundOutcomeAssessment" (
    "id" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "outcomeId" UUID NOT NULL,
    "exposureContextId" UUID,
    "assessmentKey" TEXT NOT NULL DEFAULT 'default',
    "effectScore" INTEGER,
    "effectDirection" "EffectDirection" NOT NULL,
    "activityMagnitude" "ActivityMagnitude" NOT NULL,
    "evidenceConfidence" "EvidenceConfidence" NOT NULL,
    "humanRelevance" "HumanRelevance" NOT NULL,
    "lifeStage" "LifeStage",
    "developmentalSensitivity" "DevelopmentalSensitivity" NOT NULL DEFAULT 'UNKNOWN',
    "conflictingEvidence" BOOLEAN NOT NULL DEFAULT false,
    "insufficientHumanEvidence" BOOLEAN NOT NULL DEFAULT false,
    "doseRelevanceUncertain" BOOLEAN NOT NULL DEFAULT false,
    "developmentalRelevanceUncertain" BOOLEAN NOT NULL DEFAULT false,
    "quantitativeScoreSupported" BOOLEAN NOT NULL DEFAULT false,
    "curationStatus" "CurationStatus" NOT NULL DEFAULT 'SEED_HYPOTHESIS',
    "effectSummary" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompoundOutcomeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "journalOrPublisher" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "doi" TEXT,
    "pmid" TEXT,
    "url" TEXT NOT NULL DEFAULT '',
    "sourceType" "EvidenceType" NOT NULL,
    "peerReviewed" BOOLEAN NOT NULL DEFAULT false,
    "countsAsScientificEvidence" BOOLEAN NOT NULL DEFAULT true,
    "regulatoryBody" TEXT,
    "citationText" TEXT,
    "abstractText" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "supplemental" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFinding" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "compoundId" UUID NOT NULL,
    "mechanismAssessmentId" UUID,
    "outcomeAssessmentId" UUID,
    "exposureContextId" UUID,
    "species" TEXT NOT NULL,
    "sex" TEXT,
    "sampleSize" INTEGER,
    "studyDesign" "StudyDesign" NOT NULL DEFAULT 'UNKNOWN',
    "studyDesignDetail" TEXT,
    "evidenceClass" "EvidenceType" NOT NULL,
    "doseText" TEXT NOT NULL,
    "durationText" TEXT NOT NULL,
    "findingSummary" TEXT NOT NULL,
    "effectDirection" "EffectDirection" NOT NULL,
    "statisticalResult" TEXT,
    "authorsConclusion" TEXT,
    "ourInterpretation" TEXT,
    "limitations" TEXT,
    "relevanceScore" INTEGER NOT NULL,
    "supplemental" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryAssessment" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "compoundId" UUID NOT NULL,
    "agency" "RegulatoryAgency" NOT NULL,
    "agencyOther" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3),
    "classification" TEXT NOT NULL,
    "referenceDose" DECIMAL(24,8),
    "referenceDoseUnit" TEXT,
    "criticalEndpoint" TEXT,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "current" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentRevision" (
    "id" UUID NOT NULL,
    "mechanismAssessmentId" UUID,
    "outcomeAssessmentId" UUID,
    "previousEffectScore" INTEGER,
    "newEffectScore" INTEGER,
    "previousConfidence" "EvidenceConfidence",
    "newConfidence" "EvidenceConfidence",
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" UUID,
    "evidenceSourceId" UUID,

    CONSTRAINT "AssessmentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataGap" (
    "id" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "compoundId" UUID NOT NULL,
    "mechanismId" UUID,
    "domainId" UUID,
    "priority" "DataGapPriority" NOT NULL,
    "reason" "DataGapReason" NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedResearch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalAuthId_key" ON "User"("externalAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "Compound_slug_key" ON "Compound"("slug");

-- CreateIndex
CREATE INDEX "Compound_compoundType_idx" ON "Compound"("compoundType");

-- CreateIndex
CREATE INDEX "Compound_casNumber_idx" ON "Compound"("casNumber");

-- CreateIndex
CREATE INDEX "Compound_recordKind_idx" ON "Compound"("recordKind");

-- CreateIndex
CREATE INDEX "Compound_legacyChemical_idx" ON "Compound"("legacyChemical");

-- CreateIndex
CREATE INDEX "CompoundAlias_name_idx" ON "CompoundAlias"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundAlias_compoundId_name_key" ON "CompoundAlias"("compoundId", "name");

-- CreateIndex
CREATE INDEX "CompoundRelationship_targetCompoundId_idx" ON "CompoundRelationship"("targetCompoundId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundRelationship_sourceCompoundId_targetCompoundId_rela_key" ON "CompoundRelationship"("sourceCompoundId", "targetCompoundId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundInteraction_stableKey_key" ON "CompoundInteraction"("stableKey");

-- CreateIndex
CREATE INDEX "CompoundInteraction_compoundAId_idx" ON "CompoundInteraction"("compoundAId");

-- CreateIndex
CREATE INDEX "CompoundInteraction_compoundBId_idx" ON "CompoundInteraction"("compoundBId");

-- CreateIndex
CREATE INDEX "ExposureContext_lifeStage_idx" ON "ExposureContext"("lifeStage");

-- CreateIndex
CREATE INDEX "ExposureContext_exposureType_idx" ON "ExposureContext"("exposureType");

-- CreateIndex
CREATE UNIQUE INDEX "ExposureContext_compoundId_contextKey_key" ON "ExposureContext"("compoundId", "contextKey");

-- CreateIndex
CREATE UNIQUE INDEX "BiologicalDomain_code_key" ON "BiologicalDomain"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BiologicalDomain_shortLabel_key" ON "BiologicalDomain"("shortLabel");

-- CreateIndex
CREATE INDEX "BiologicalDomain_sortOrder_idx" ON "BiologicalDomain"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Mechanism_code_key" ON "Mechanism"("code");

-- CreateIndex
CREATE INDEX "Mechanism_domainId_sortOrder_idx" ON "Mechanism"("domainId", "sortOrder");

-- CreateIndex
CREATE INDEX "Mechanism_aggregationGroup_idx" ON "Mechanism"("aggregationGroup");

-- CreateIndex
CREATE INDEX "Mechanism_parentMechanismId_idx" ON "Mechanism"("parentMechanismId");

-- CreateIndex
CREATE UNIQUE INDEX "CausalPathway_code_key" ON "CausalPathway"("code");

-- CreateIndex
CREATE INDEX "MechanismAssessment_mechanismId_idx" ON "MechanismAssessment"("mechanismId");

-- CreateIndex
CREATE INDEX "MechanismAssessment_exposureContextId_idx" ON "MechanismAssessment"("exposureContextId");

-- CreateIndex
CREATE INDEX "MechanismAssessment_curationStatus_idx" ON "MechanismAssessment"("curationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MechanismAssessment_compoundId_mechanismId_assessmentKey_key" ON "MechanismAssessment"("compoundId", "mechanismId", "assessmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_code_key" ON "Outcome"("code");

-- CreateIndex
CREATE INDEX "CompoundOutcomeAssessment_outcomeId_idx" ON "CompoundOutcomeAssessment"("outcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundOutcomeAssessment_compoundId_outcomeId_assessmentKe_key" ON "CompoundOutcomeAssessment"("compoundId", "outcomeId", "assessmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSource_stableKey_key" ON "EvidenceSource"("stableKey");

-- CreateIndex
CREATE INDEX "EvidenceSource_year_idx" ON "EvidenceSource"("year");

-- CreateIndex
CREATE INDEX "EvidenceSource_sourceType_idx" ON "EvidenceSource"("sourceType");

-- CreateIndex
CREATE INDEX "EvidenceSource_doi_idx" ON "EvidenceSource"("doi");

-- CreateIndex
CREATE INDEX "EvidenceSource_pmid_idx" ON "EvidenceSource"("pmid");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceFinding_stableKey_key" ON "EvidenceFinding"("stableKey");

-- CreateIndex
CREATE INDEX "EvidenceFinding_compoundId_idx" ON "EvidenceFinding"("compoundId");

-- CreateIndex
CREATE INDEX "EvidenceFinding_sourceId_idx" ON "EvidenceFinding"("sourceId");

-- CreateIndex
CREATE INDEX "EvidenceFinding_evidenceClass_idx" ON "EvidenceFinding"("evidenceClass");

-- CreateIndex
CREATE INDEX "EvidenceFinding_mechanismAssessmentId_idx" ON "EvidenceFinding"("mechanismAssessmentId");

-- CreateIndex
CREATE INDEX "EvidenceFinding_outcomeAssessmentId_idx" ON "EvidenceFinding"("outcomeAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryAssessment_stableKey_key" ON "RegulatoryAssessment"("stableKey");

-- CreateIndex
CREATE INDEX "RegulatoryAssessment_compoundId_current_idx" ON "RegulatoryAssessment"("compoundId", "current");

-- CreateIndex
CREATE INDEX "RegulatoryAssessment_agency_idx" ON "RegulatoryAssessment"("agency");

-- CreateIndex
CREATE INDEX "AssessmentRevision_mechanismAssessmentId_idx" ON "AssessmentRevision"("mechanismAssessmentId");

-- CreateIndex
CREATE INDEX "AssessmentRevision_outcomeAssessmentId_idx" ON "AssessmentRevision"("outcomeAssessmentId");

-- CreateIndex
CREATE INDEX "AssessmentRevision_changedAt_idx" ON "AssessmentRevision"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataGap_stableKey_key" ON "DataGap"("stableKey");

-- CreateIndex
CREATE INDEX "DataGap_compoundId_idx" ON "DataGap"("compoundId");

-- CreateIndex
CREATE INDEX "DataGap_priority_idx" ON "DataGap"("priority");

-- AddForeignKey
ALTER TABLE "Compound" ADD CONSTRAINT "Compound_parentCompoundId_fkey" FOREIGN KEY ("parentCompoundId") REFERENCES "Compound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundAlias" ADD CONSTRAINT "CompoundAlias_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundRelationship" ADD CONSTRAINT "CompoundRelationship_sourceCompoundId_fkey" FOREIGN KEY ("sourceCompoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundRelationship" ADD CONSTRAINT "CompoundRelationship_targetCompoundId_fkey" FOREIGN KEY ("targetCompoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_compoundAId_fkey" FOREIGN KEY ("compoundAId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_compoundBId_fkey" FOREIGN KEY ("compoundBId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BiologicalDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExposureContext" ADD CONSTRAINT "ExposureContext_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mechanism" ADD CONSTRAINT "Mechanism_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BiologicalDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mechanism" ADD CONSTRAINT "Mechanism_parentMechanismId_fkey" FOREIGN KEY ("parentMechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanismAssessment" ADD CONSTRAINT "MechanismAssessment_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanismAssessment" ADD CONSTRAINT "MechanismAssessment_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanismAssessment" ADD CONSTRAINT "MechanismAssessment_exposureContextId_fkey" FOREIGN KEY ("exposureContextId") REFERENCES "ExposureContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanismAssessment" ADD CONSTRAINT "MechanismAssessment_causalPathwayId_fkey" FOREIGN KEY ("causalPathwayId") REFERENCES "CausalPathway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundOutcomeAssessment" ADD CONSTRAINT "CompoundOutcomeAssessment_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundOutcomeAssessment" ADD CONSTRAINT "CompoundOutcomeAssessment_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundOutcomeAssessment" ADD CONSTRAINT "CompoundOutcomeAssessment_exposureContextId_fkey" FOREIGN KEY ("exposureContextId") REFERENCES "ExposureContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_mechanismAssessmentId_fkey" FOREIGN KEY ("mechanismAssessmentId") REFERENCES "MechanismAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_outcomeAssessmentId_fkey" FOREIGN KEY ("outcomeAssessmentId") REFERENCES "CompoundOutcomeAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFinding" ADD CONSTRAINT "EvidenceFinding_exposureContextId_fkey" FOREIGN KEY ("exposureContextId") REFERENCES "ExposureContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryAssessment" ADD CONSTRAINT "RegulatoryAssessment_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_mechanismAssessmentId_fkey" FOREIGN KEY ("mechanismAssessmentId") REFERENCES "MechanismAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_outcomeAssessmentId_fkey" FOREIGN KEY ("outcomeAssessmentId") REFERENCES "CompoundOutcomeAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_evidenceSourceId_fkey" FOREIGN KEY ("evidenceSourceId") REFERENCES "EvidenceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataGap" ADD CONSTRAINT "DataGap_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataGap" ADD CONSTRAINT "DataGap_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataGap" ADD CONSTRAINT "DataGap_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BiologicalDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
