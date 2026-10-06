-- Curator mapping provenance. Does not change scores, findings, or mechanism rows.

ALTER TABLE "MechanisticClaim" ADD COLUMN "machineMechanismId" UUID;

UPDATE "MechanisticClaim" SET "machineMechanismId" = "mechanismId";

CREATE INDEX "MechanisticClaim_machineMechanismId_idx" ON "MechanisticClaim"("machineMechanismId");

ALTER TABLE "MechanisticClaim"
    ADD CONSTRAINT "MechanisticClaim_machineMechanismId_fkey"
    FOREIGN KEY ("machineMechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "ClaimMappingAction" AS ENUM ('VERIFY', 'REMAP', 'UNMAP');

CREATE TABLE "ClaimMappingEvent" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "action" "ClaimMappingAction" NOT NULL,
    "fromMechanismId" UUID,
    "toMechanismId" UUID,
    "fromState" "ClaimMappingState" NOT NULL,
    "toState" "ClaimMappingState" NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimMappingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClaimMappingEvent_claimId_idx" ON "ClaimMappingEvent"("claimId");
CREATE INDEX "ClaimMappingEvent_fromMechanismId_idx" ON "ClaimMappingEvent"("fromMechanismId");
CREATE INDEX "ClaimMappingEvent_toMechanismId_idx" ON "ClaimMappingEvent"("toMechanismId");

ALTER TABLE "ClaimMappingEvent"
    ADD CONSTRAINT "ClaimMappingEvent_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "MechanisticClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClaimMappingEvent"
    ADD CONSTRAINT "ClaimMappingEvent_fromMechanismId_fkey"
    FOREIGN KEY ("fromMechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClaimMappingEvent"
    ADD CONSTRAINT "ClaimMappingEvent_toMechanismId_fkey"
    FOREIGN KEY ("toMechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;
