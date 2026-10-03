-- Score bounds and revision target. Applied after the initial schema so
-- scientific integers cannot silently leave the −4..+4 scale.

ALTER TABLE "MechanismAssessment"
  ADD CONSTRAINT "MechanismAssessment_effectScore_range"
  CHECK ("effectScore" IS NULL OR ("effectScore" >= -4 AND "effectScore" <= 4));

ALTER TABLE "CompoundOutcomeAssessment"
  ADD CONSTRAINT "CompoundOutcomeAssessment_effectScore_range"
  CHECK ("effectScore" IS NULL OR ("effectScore" >= -4 AND "effectScore" <= 4));

ALTER TABLE "CompoundInteraction"
  ADD CONSTRAINT "CompoundInteraction_effectScore_range"
  CHECK ("effectScore" IS NULL OR ("effectScore" >= -4 AND "effectScore" <= 4));

ALTER TABLE "EvidenceFinding"
  ADD CONSTRAINT "EvidenceFinding_relevanceScore_range"
  CHECK ("relevanceScore" >= 0 AND "relevanceScore" <= 4);

ALTER TABLE "AssessmentRevision"
  ADD CONSTRAINT "AssessmentRevision_one_target"
  CHECK (
    (
      "mechanismAssessmentId" IS NOT NULL
      AND "outcomeAssessmentId" IS NULL
    )
    OR (
      "mechanismAssessmentId" IS NULL
      AND "outcomeAssessmentId" IS NOT NULL
    )
  );
