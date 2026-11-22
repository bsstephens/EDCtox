-- AlterTable
ALTER TABLE "MechanisticClaim" ADD COLUMN     "armCompoundId" UUID,
ADD COLUMN     "machineArmText" TEXT;

-- CreateIndex
CREATE INDEX "MechanisticClaim_armCompoundId_idx" ON "MechanisticClaim"("armCompoundId");

-- AddForeignKey
ALTER TABLE "MechanisticClaim" ADD CONSTRAINT "MechanisticClaim_armCompoundId_fkey" FOREIGN KEY ("armCompoundId") REFERENCES "Compound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
