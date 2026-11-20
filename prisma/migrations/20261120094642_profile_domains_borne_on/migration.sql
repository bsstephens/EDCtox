-- AlterTable
ALTER TABLE "PaperProfile" ADD COLUMN     "domainsBorneOn" TEXT[] DEFAULT ARRAY[]::TEXT[];
