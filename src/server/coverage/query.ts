import type { ClaimMappingState, EvidenceDirectness, ExtractionConfidence, MechanisticRelation, Prisma, PrismaClient } from "../../../generated/prisma";

type Store = PrismaClient | Prisma.TransactionClient;

export type CoverageState = "VERIFIED" | "CANDIDATE" | "UNMAPPED";

export type CoverageClaim = {
  id: string;
  state: CoverageState;
  subjectText: string;
  relation: MechanisticRelation;
  objectText: string;
  reviewDerived: boolean;
  directness: EvidenceDirectness;
  confidence: ExtractionConfidence;
  speciesText: string | null;
  tissueText: string | null;
  cellTypeText: string | null;
  doseText: string | null;
  title: string;
  year: number;
  pmid: string | null;
  doi: string | null;
  sourceSection: string;
  curatorVerified: boolean;
  machineMechanismCode: string | null;
  mechanismCode: string | null;
  mechanismName: string | null;
  familyName: string | null;
  parentName: string | null;
  parentCode: string | null;
  domainCode: string | null;
  domainName: string | null;
  domainShortLabel: string | null;
  domainSort: number;
  mechanismSort: number;
};

export type CoverageMetrics = {
  total: number;
  mapped: number;
  candidate: number;
  unmapped: number;
  direct: number;
  verified: number;
};

export type CoverageParentGroup = {
  parentName: string | null;
  parentCode: string | null;
  claims: CoverageClaim[];
};

export type CoverageFamilyGroup = {
  familyName: string | null;
  parents: CoverageParentGroup[];
};

export type CoverageDomainGroup = {
  domainCode: string;
  domainName: string;
  domainShortLabel: string;
  families: CoverageFamilyGroup[];
};

export type CompoundCoverage = {
  claims: CoverageClaim[];
  metrics: CoverageMetrics;
  warnings: string[];
  domains: CoverageDomainGroup[];
  unmapped: CoverageClaim[];
};

export function coverageState(claim: {
  mechanismId: string | null;
  curatorVerified: boolean;
  curatorMappingState: ClaimMappingState | null;
}): CoverageState {
  if (claim.mechanismId && claim.curatorVerified && claim.curatorMappingState === "VERIFIED") return "VERIFIED";
  if (claim.mechanismId) return "CANDIDATE";
  return "UNMAPPED";
}

export function coverageMetrics(claims: readonly CoverageClaim[]): CoverageMetrics {
  return {
    total: claims.length,
    mapped: claims.filter((claim) => claim.state !== "UNMAPPED").length,
    candidate: claims.filter((claim) => claim.state === "CANDIDATE").length,
    unmapped: claims.filter((claim) => claim.state === "UNMAPPED").length,
    direct: claims.filter((claim) => claim.directness === "DIRECTLY_DEMONSTRATED").length,
    verified: claims.filter((claim) => claim.state === "VERIFIED").length,
  };
}

export function coverageWarnings(metrics: CoverageMetrics): string[] {
  if (metrics.total === 0) return ["No mechanistic claims have been extracted for this compound yet."];
  const messages: string[] = [];
  if (metrics.verified === 0) messages.push("Mechanistic claims are machine-extracted; no curator-verified mappings yet.");
  if (metrics.unmapped > 0) messages.push("Some mechanistic claims are not yet mapped to the ontology.");
  return messages;
}

export function groupMappedClaims(claims: readonly CoverageClaim[]): CoverageDomainGroup[] {
  const domains = new Map<string, CoverageDomainGroup & { sort: number }>();
  for (const claim of claims) {
    if (claim.state === "UNMAPPED" || !claim.domainCode || !claim.domainName || !claim.domainShortLabel || !claim.mechanismCode) continue;
    const existing = domains.get(claim.domainCode);
    const domain = existing ?? {
      domainCode: claim.domainCode,
      domainName: claim.domainName,
      domainShortLabel: claim.domainShortLabel,
      families: [],
      sort: claim.domainSort,
    };
    if (!existing) domains.set(claim.domainCode, domain);
    const familyName = claim.familyName;
    let family = domain.families.find((item) => item.familyName === familyName);
    if (!family) {
      family = { familyName, parents: [] };
      domain.families.push(family);
    }
    let parent = family.parents.find((item) => item.parentCode === claim.parentCode);
    if (!parent) {
      parent = { parentName: claim.parentName, parentCode: claim.parentCode, claims: [] };
      family.parents.push(parent);
    }
    parent.claims.push(claim);
  }
  return [...domains.values()]
    .sort((a, b) => a.sort - b.sort || a.domainName.localeCompare(b.domainName))
    .map((domain) => ({
      domainCode: domain.domainCode,
      domainName: domain.domainName,
      domainShortLabel: domain.domainShortLabel,
      families: domain.families
        .sort((a, b) => (a.familyName ?? "\uFFFF").localeCompare(b.familyName ?? "\uFFFF"))
        .map((family) => ({
          familyName: family.familyName,
          parents: family.parents
            .sort((a, b) => (a.parentName ?? "\uFFFF").localeCompare(b.parentName ?? "\uFFFF"))
            .map((parent) => ({
              parentName: parent.parentName,
              parentCode: parent.parentCode,
              claims: parent.claims.sort((a, b) => a.mechanismSort - b.mechanismSort || (a.mechanismName ?? "").localeCompare(b.mechanismName ?? "")),
            })),
        })),
    }));
}

export function unmappedClaims(claims: readonly CoverageClaim[]): CoverageClaim[] {
  return claims.filter((claim) => claim.state === "UNMAPPED").sort((a, b) => a.objectText.localeCompare(b.objectText) || a.title.localeCompare(b.title));
}

export async function loadCompoundCoverage(store: Store, slug: string): Promise<CompoundCoverage> {
  const rows = await store.mechanisticClaim.findMany({
    where: { compound: { slug } },
    select: {
      id: true,
      subjectText: true,
      relation: true,
      objectText: true,
      reviewDerived: true,
      machineDirectness: true,
      machineConfidence: true,
      speciesText: true,
      tissueText: true,
      cellTypeText: true,
      doseText: true,
      sourceSection: true,
      curatorVerified: true,
      curatorMappingState: true,
      mechanismId: true,
      machineMechanism: { select: { code: true } },
      mechanism: {
        select: {
          code: true,
          name: true,
          sortOrder: true,
          family: { select: { name: true } },
          parent: { select: { code: true, name: true } },
          domain: { select: { code: true, name: true, shortLabel: true, sortOrder: true } },
        },
      },
      evidenceSource: { select: { title: true, year: true, pmid: true, doi: true } },
    },
    orderBy: [{ objectText: "asc" }, { evidenceSource: { year: "desc" } }],
  });
  const claims: CoverageClaim[] = rows.map((row) => ({
    id: row.id,
    state: coverageState(row),
    subjectText: row.subjectText,
    relation: row.relation,
    objectText: row.objectText,
    reviewDerived: row.reviewDerived,
    directness: row.machineDirectness,
    confidence: row.machineConfidence,
    speciesText: row.speciesText,
    tissueText: row.tissueText,
    cellTypeText: row.cellTypeText,
    doseText: row.doseText,
    title: row.evidenceSource.title,
    year: row.evidenceSource.year,
    pmid: row.evidenceSource.pmid,
    doi: row.evidenceSource.doi,
    sourceSection: row.sourceSection,
    curatorVerified: row.curatorVerified,
    machineMechanismCode: row.machineMechanism?.code ?? null,
    mechanismCode: row.mechanism?.code ?? null,
    mechanismName: row.mechanism?.name ?? null,
    familyName: row.mechanism?.family?.name ?? null,
    parentName: row.mechanism?.parent?.name ?? null,
    parentCode: row.mechanism?.parent?.code ?? null,
    domainCode: row.mechanism?.domain.code ?? null,
    domainName: row.mechanism?.domain.name ?? null,
    domainShortLabel: row.mechanism?.domain.shortLabel ?? null,
    domainSort: row.mechanism?.domain.sortOrder ?? 0,
    mechanismSort: row.mechanism?.sortOrder ?? 0,
  }));
  const metrics = coverageMetrics(claims);
  return {
    claims,
    metrics,
    warnings: coverageWarnings(metrics),
    domains: groupMappedClaims(claims),
    unmapped: unmappedClaims(claims),
  };
}
