-- AlterTable
ALTER TABLE "MechanisticClaim" ADD COLUMN     "machineOutcomeId" UUID,
ADD COLUMN     "outcomeId" UUID;

-- CreateIndex
CREATE INDEX "MechanisticClaim_outcomeId_idx" ON "MechanisticClaim"("outcomeId");

-- CreateIndex
CREATE INDEX "MechanisticClaim_machineOutcomeId_idx" ON "MechanisticClaim"("machineOutcomeId");

-- AddForeignKey
ALTER TABLE "MechanisticClaim" ADD CONSTRAINT "MechanisticClaim_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanisticClaim" ADD CONSTRAINT "MechanisticClaim_machineOutcomeId_fkey" FOREIGN KEY ("machineOutcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
