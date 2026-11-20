-- CreateTable
CREATE TABLE "PaperProfile" (
    "id" UUID NOT NULL,
    "evidenceSourceId" UUID NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptSha256" TEXT NOT NULL,
    "compoundsStudied" TEXT[],
    "outcomesReported" TEXT[],
    "speciesStudied" TEXT[],
    "exposureNotes" TEXT,
    "studyDesign" TEXT,
    "measuresOutcome" BOOLEAN,
    "notAbout" TEXT,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperProfile_promptVersion_idx" ON "PaperProfile"("promptVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PaperProfile_evidenceSourceId_promptVersion_key" ON "PaperProfile"("evidenceSourceId", "promptVersion");

-- AddForeignKey
ALTER TABLE "PaperProfile" ADD CONSTRAINT "PaperProfile_evidenceSourceId_fkey" FOREIGN KEY ("evidenceSourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
