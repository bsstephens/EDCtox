import type { PrismaClient } from "../../../generated/prisma";
import { CLAIM_DOMAIN, CLAIM_PILOT_PMIDS } from "./constants";
import { orderByCompoundCentrality, selectClaimPilot } from "./select";

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

/**
 * Every BPA reproductive paper the screener included and that has an abstract to read. The
 * compound and the domain are the pilot's, so this is the same scientific scope with more
 * papers in it. Ordered oldest first so a truncated run is a stable prefix rather than a
 * different set of papers each time.
 */
export async function loadIncludedClaimCohort(
  db: Db,
  limit: number,
  pmids: readonly string[] = [],
  target: { compound: string; screeningDomain: string } = { compound: "bpa", screeningDomain: "REP" },
) {
  const compound = await db.compound.findUniqueOrThrow({
    where: { slug: target.compound },
    select: { id: true, canonicalName: true, aliases: { select: { name: true } } },
  });
  const decisions = await db.literatureScreeningDecision.findMany({
    where: { machineDecision: "INCLUDE", compoundId: compound.id, domainCode: target.screeningDomain },
    select: { evidenceSourceId: true },
  });
  const sources = await db.evidenceSource.findMany({
    where: {
      id: { in: decisions.map((row) => row.evidenceSourceId) },
      retracted: false,
      abstractText: { not: null },
      ...(pmids.length > 0 ? { pmid: { in: [...pmids] } } : {}),
    },
    select: {
      id: true,
      pmid: true,
      title: true,
      year: true,
      abstractText: true,
      profiles: { select: { compoundsStudied: true } },
    },
  });

  // How central the compound is, judged against its own names rather than a hardcoded one.
  // The first word of the canonical name carries it: "bisphenol" for bisphenol A, "glyphosate"
  // for glyphosate, which also catches "glyphosate-based herbicide" in a profile's list.
  const stem = compound.canonicalName.toLowerCase().split(" ")[0] ?? compound.canonicalName.toLowerCase();
  const ownNames = [compound.canonicalName, ...compound.aliases.map((alias) => alias.name)].map((value) =>
    value.toLowerCase(),
  );
  const ordered = orderByCompoundCentrality(sources, (name) => {
    const lower = name.toLowerCase();
    return lower.includes(stem) || ownNames.some((own) => lower.includes(own));
  });

  return {
    compoundId: compound.id,
    compoundName: compound.canonicalName,
    papers: ordered.slice(0, limit).map((source) => ({
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
      machinePassesSeen: true,
      machinePassesRun: true,
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
      outcome: { select: { code: true, name: true } },
      evidenceSource: {
        select: { id: true, title: true, year: true, pmid: true, doi: true, publicationStatus: true },
      },
    },
  });
}
