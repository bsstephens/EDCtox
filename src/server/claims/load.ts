import type { PrismaClient } from "../../../generated/prisma";
import { CLAIM_DOMAIN, CLAIM_PILOT_PMIDS } from "./constants";
import { selectClaimPilot } from "./select";

type Db = PrismaClient;

export async function loadClaimPilot(db: Db, limit: number) {
  const compound = await db.compound.findUniqueOrThrow({ where: { slug: "bpa" }, select: { id: true } });
  const sources = await db.evidenceSource.findMany({
    where: { pmid: { in: [...CLAIM_PILOT_PMIDS] } },
    select: {
      id: true,
      pmid: true,
      title: true,
      year: true,
      abstractText: true,
      retracted: true,
      publicationStatus: true,
    },
  });
  const selected = selectClaimPilot(sources, limit);
  return {
    compoundId: compound.id,
    papers: selected.map((source) => ({
      evidenceSourceId: source.id,
      title: source.title,
      year: source.year,
      pmid: source.pmid,
      abstractText: source.abstractText,
    })),
  };
}

export async function loadStoredClaims(db: Db) {
  return db.mechanisticClaim.findMany({
    where: { compound: { slug: "bpa" }, domainCode: CLAIM_DOMAIN },
    orderBy: [{ evidenceSource: { year: "desc" } }, { objectText: "asc" }],
    select: {
      id: true,
      subjectText: true,
      relation: true,
      objectText: true,
      machineDirectness: true,
      machineConfidence: true,
      machineRationale: true,
      machineMappingState: true,
      curatorVerified: true,
      speciesText: true,
      tissueText: true,
      cellTypeText: true,
      doseText: true,
      measureType: true,
      measureValue: true,
      measureUnit: true,
      textOrigin: true,
      sourceSection: true,
      quotedSupport: true,
      reviewPriority: true,
      reviewDerived: true,
      promptVersion: true,
      mechanism: { select: { code: true, name: true } },
      evidenceSource: {
        select: { id: true, title: true, year: true, pmid: true, doi: true, publicationStatus: true },
      },
    },
  });
}
