-- AlterTable
ALTER TABLE "EvidenceSource" ADD COLUMN     "meshDescriptors" TEXT[],
ADD COLUMN     "meshSubstances" TEXT[],
ADD COLUMN     "providerIndexedAt" TIMESTAMP(3),
ADD COLUMN     "publicationTypes" TEXT[];
