import type { PrismaClient } from "../../../generated/prisma";

type Db = PrismaClient;

export type MechanismFilters = {
  q: string;
  domain: string;
  family: string;
  policy: string;
  parent: string;
  group: string;
  profile: string;
  assessments: string;
  claims: string;
  verified: string;
  directness: string;
  mapping: string;
};

export type MechanismListRow = {
  code: string;
  name: string;
  description: string;
  aggregationGroup: string;
  scorePolicy: string;
  domainCode: string;
  domainName: string;
  domainShortLabel: string;
  profile: boolean;
  familyCode: string | null;
  familyName: string | null;
  parentCode: string | null;
  parentName: string | null;
  assessmentCompounds: number;
  claimCompounds: number;
  claimCount: number;
  verifiedClaims: number;
  directClaims: number;
  inferredClaims: number;
  candidateClaims: number;
  directness: Readonly<Record<string, number>>;
};

export type MechanismOptions = {
  domains: { value: string; label: string }[];
  families: { value: string; label: string }[];
  parents: { value: string; label: string }[];
  groups: { value: string; label: string }[];
};

export type MechanismClaimView = {
  id: string;
  compoundSlug: string;
  compoundName: string;
  subjectText: string;
  relation: string;
  objectText: string;
  directness: string;
  confidence: string;
  mappingState: string;
  curatorVerified: boolean;
  verifiedSentence: string | null;
  year: number;
  title: string;
  pmid: string | null;
  doi: string | null;
  speciesText: string | null;
  tissueText: string | null;
  cellTypeText: string | null;
  doseText: string | null;
  sourceSection: string;
  reviewDerived: boolean;
};

export type MechanismDetail = {
  code: string;
  name: string;
  description: string;
  scorePolicy: string;
  aggregationGroup: string;
  domainCode: string;
  domainName: string;
  domainShortLabel: string;
  profile: boolean;
  familyCode: string | null;
  familyName: string | null;
  parent: { code: string; name: string } | null;
  children: { code: string; name: string; scorePolicy: string }[];
  siblings: { code: string; name: string }[];
  mappings: { dataset: string; label: string; termId: string; termType: string; mappingType: string; url: string | null }[];
  assessments: {
    id: string;
    compoundSlug: string;
    compoundName: string;
    effectScore: number | null;
    quantitativeScoreSupported: boolean;
    effectDirection: string;
    evidenceConfidence: string;
    curationStatus: string;
    humanRelevance: string;
  }[];
  claims: MechanismClaimView[];
  paperCount: number;
  directness: { label: string; count: number }[];
  species: { label: string; count: number }[];
  tissues: { label: string; count: number }[];
  cells: { label: string; count: number }[];
  verifiedClaims: number;
  candidateClaims: number;
};

const EMPTY_FILTERS: MechanismFilters = {
  q: "",
  domain: "",
  family: "",
  policy: "",
  parent: "",
  group: "",
  profile: "",
  assessments: "",
  claims: "",
  verified: "",
  directness: "",
  mapping: "",
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseMechanismFilters(params: Record<string, string | string[] | undefined>): MechanismFilters {
  return {
    q: one(params.q).trim(),
    domain: one(params.domain),
    family: one(params.family),
    policy: one(params.policy),
    parent: one(params.parent),
    group: one(params.group),
    profile: one(params.profile),
    assessments: one(params.assessments),
    claims: one(params.claims),
    verified: one(params.verified),
    directness: one(params.directness),
    mapping: one(params.mapping),
  };
}

export function mechanismStatus(row: Pick<MechanismListRow, "claimCount" | "verifiedClaims" | "candidateClaims">): string {
  if (row.claimCount === 0) return "No claims yet";
  if (row.verifiedClaims === 0 && row.candidateClaims > 0) return "Candidate mappings only";
  if (row.verifiedClaims === 0) return "Machine-extracted claims only";
  return "Curator-verified mapping";
}

export function filterMechanismRows(rows: readonly MechanismListRow[], filters: MechanismFilters = EMPTY_FILTERS): MechanismListRow[] {
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (query && !`${row.name} ${row.code} ${row.description} ${row.aggregationGroup}`.toLowerCase().includes(query)) return false;
    if (filters.domain && row.domainCode !== filters.domain) return false;
    if (filters.family && row.familyCode !== filters.family) return false;
    if (filters.policy && row.scorePolicy !== filters.policy) return false;
    if (filters.parent === "none" && row.parentCode) return false;
    if (filters.parent && filters.parent !== "none" && row.parentCode !== filters.parent) return false;
    if (filters.group && row.aggregationGroup !== filters.group) return false;
    if (filters.profile === "profile" && !row.profile) return false;
    if (filters.profile === "other" && row.profile) return false;
    if (filters.assessments === "yes" && row.assessmentCompounds === 0) return false;
    if (filters.assessments === "no" && row.assessmentCompounds > 0) return false;
    if (filters.claims === "yes" && row.claimCount === 0) return false;
    if (filters.claims === "no" && row.claimCount > 0) return false;
    if (filters.verified === "yes" && row.verifiedClaims === 0) return false;
    if (filters.verified === "no" && row.verifiedClaims > 0) return false;
    if (filters.directness && (row.directness[filters.directness] ?? 0) === 0) return false;
    if (filters.mapping === "CANDIDATE" && row.candidateClaims === 0) return false;
    if (filters.mapping === "VERIFIED" && row.verifiedClaims === 0) return false;
    return true;
  });
}

function optionList(pairs: readonly (readonly [string, string])[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const [value, label] of pairs) seen.set(value, label);
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function tally(values: readonly (string | null)[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(";")) {
      const label = part.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function loadMechanismRows(db: Db): Promise<MechanismListRow[]> {
  const [mechanisms, claims, assessments] = await Promise.all([
    db.mechanism.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        aggregationGroup: true,
        scorePolicy: true,
        domain: { select: { code: true, name: true, shortLabel: true, contributesToProfile: true } },
        family: { select: { code: true, name: true } },
        parent: { select: { code: true, name: true } },
      },
      orderBy: [{ domain: { sortOrder: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
    }),
    db.mechanisticClaim.findMany({
      where: { mechanismId: { not: null } },
      select: {
        mechanismId: true,
        compoundId: true,
        curatorVerified: true,
        machineDirectness: true,
        machineMappingState: true,
      },
    }),
    db.mechanismAssessment.findMany({ select: { mechanismId: true, compoundId: true } }),
  ]);

  const claimStats = new Map<string, { compounds: Set<string>; directness: Record<string, number>; verified: number; candidate: number; direct: number; inferred: number }>();
  for (const claim of claims) {
    if (!claim.mechanismId) continue;
    const stats = claimStats.get(claim.mechanismId) ?? {
      compounds: new Set<string>(),
      directness: {},
      verified: 0,
      candidate: 0,
      direct: 0,
      inferred: 0,
    };
    stats.compounds.add(claim.compoundId);
    stats.directness[claim.machineDirectness] = (stats.directness[claim.machineDirectness] ?? 0) + 1;
    if (claim.curatorVerified) stats.verified += 1;
    else if (claim.machineMappingState === "CANDIDATE") stats.candidate += 1;
    if (claim.machineDirectness === "DIRECTLY_DEMONSTRATED") stats.direct += 1;
    if (claim.machineDirectness === "INFERRED" || claim.machineDirectness === "HYPOTHESIZED") stats.inferred += 1;
    claimStats.set(claim.mechanismId, stats);
  }

  const assessmentCompounds = new Map<string, Set<string>>();
  for (const assessment of assessments) {
    const compounds = assessmentCompounds.get(assessment.mechanismId) ?? new Set<string>();
    compounds.add(assessment.compoundId);
    assessmentCompounds.set(assessment.mechanismId, compounds);
  }

  return mechanisms.map((mechanism) => {
    const stats = claimStats.get(mechanism.id);
    return {
      code: mechanism.code,
      name: mechanism.name,
      description: mechanism.description,
      aggregationGroup: mechanism.aggregationGroup,
      scorePolicy: mechanism.scorePolicy,
      domainCode: mechanism.domain.code,
      domainName: mechanism.domain.name,
      domainShortLabel: mechanism.domain.shortLabel,
      profile: mechanism.domain.contributesToProfile,
      familyCode: mechanism.family?.code ?? null,
      familyName: mechanism.family?.name ?? null,
      parentCode: mechanism.parent?.code ?? null,
      parentName: mechanism.parent?.name ?? null,
      assessmentCompounds: assessmentCompounds.get(mechanism.id)?.size ?? 0,
      claimCompounds: stats?.compounds.size ?? 0,
      claimCount: stats ? Object.values(stats.directness).reduce((sum, count) => sum + count, 0) : 0,
      verifiedClaims: stats?.verified ?? 0,
      directClaims: stats?.direct ?? 0,
      inferredClaims: stats?.inferred ?? 0,
      candidateClaims: stats?.candidate ?? 0,
      directness: stats?.directness ?? {},
    };
  });
}

export function mechanismOptions(rows: readonly MechanismListRow[]): MechanismOptions {
  return {
    domains: optionList(rows.map((row) => [row.domainCode, `${row.domainShortLabel} · ${row.domainName}`] as const)),
    families: optionList(rows.filter((row) => row.familyCode && row.familyName).map((row) => [row.familyCode ?? "", row.familyName ?? ""] as const)),
    parents: optionList(rows.filter((row) => row.parentCode && row.parentName).map((row) => [row.parentCode ?? "", row.parentName ?? ""] as const)),
    groups: optionList(rows.map((row) => [row.aggregationGroup, row.aggregationGroup] as const)),
  };
}

export async function loadMechanismDetail(db: Db, code: string): Promise<MechanismDetail | null> {
  const mechanism = await db.mechanism.findUnique({
    where: { code },
    select: {
      code: true,
      name: true,
      description: true,
      scorePolicy: true,
      aggregationGroup: true,
      domain: { select: { code: true, name: true, shortLabel: true, contributesToProfile: true } },
      family: { select: { code: true, name: true } },
      parent: {
        select: {
          code: true,
          name: true,
          children: { select: { code: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      },
      children: { select: { code: true, name: true, scorePolicy: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      ontologyMappings: {
        select: {
          externalTermId: true,
          externalTermType: true,
          externalLabel: true,
          externalUrl: true,
          mappingType: true,
          dataset: { select: { name: true } },
        },
        orderBy: { externalLabel: "asc" },
      },
      assessments: {
        select: {
          id: true,
          effectScore: true,
          quantitativeScoreSupported: true,
          effectDirection: true,
          evidenceConfidence: true,
          curationStatus: true,
          humanRelevance: true,
          compound: { select: { slug: true, displayName: true } },
        },
        orderBy: { compound: { displayName: "asc" } },
      },
      mechanisticClaims: {
        select: {
          id: true,
          subjectText: true,
          relation: true,
          objectText: true,
          machineDirectness: true,
          machineConfidence: true,
          machineMappingState: true,
          curatorVerified: true,
          curatorMappingState: true,
          quotedSupport: true,
          speciesText: true,
          tissueText: true,
          cellTypeText: true,
          doseText: true,
          sourceSection: true,
          reviewDerived: true,
          compound: { select: { slug: true, displayName: true } },
          evidenceSource: { select: { id: true, title: true, year: true, pmid: true, doi: true } },
        },
        orderBy: [{ evidenceSource: { year: "desc" } }, { objectText: "asc" }],
      },
    },
  });
  if (!mechanism) return null;

  const claims: MechanismClaimView[] = mechanism.mechanisticClaims.map((claim) => ({
    id: claim.id,
    compoundSlug: claim.compound.slug,
    compoundName: claim.compound.displayName,
    subjectText: claim.subjectText,
    relation: claim.relation,
    objectText: claim.objectText,
    directness: claim.machineDirectness,
    confidence: claim.machineConfidence,
    mappingState: claim.curatorVerified && claim.curatorMappingState ? claim.curatorMappingState : claim.machineMappingState,
    curatorVerified: claim.curatorVerified,
    verifiedSentence: claim.curatorVerified ? claim.quotedSupport : null,
    year: claim.evidenceSource.year,
    title: claim.evidenceSource.title,
    pmid: claim.evidenceSource.pmid,
    doi: claim.evidenceSource.doi,
    speciesText: claim.speciesText,
    tissueText: claim.tissueText,
    cellTypeText: claim.cellTypeText,
    doseText: claim.doseText,
    sourceSection: claim.sourceSection,
    reviewDerived: claim.reviewDerived,
  }));
  const directnessCounts = new Map<string, number>();
  for (const claim of claims) directnessCounts.set(claim.directness, (directnessCounts.get(claim.directness) ?? 0) + 1);

  return {
    code: mechanism.code,
    name: mechanism.name,
    description: mechanism.description,
    scorePolicy: mechanism.scorePolicy,
    aggregationGroup: mechanism.aggregationGroup,
    domainCode: mechanism.domain.code,
    domainName: mechanism.domain.name,
    domainShortLabel: mechanism.domain.shortLabel,
    profile: mechanism.domain.contributesToProfile,
    familyCode: mechanism.family?.code ?? null,
    familyName: mechanism.family?.name ?? null,
    parent: mechanism.parent ? { code: mechanism.parent.code, name: mechanism.parent.name } : null,
    children: mechanism.children,
    siblings: (mechanism.parent?.children ?? []).filter((child) => child.code !== mechanism.code),
    mappings: mechanism.ontologyMappings.map((mapping) => ({
      dataset: mapping.dataset.name,
      label: mapping.externalLabel ?? mapping.externalTermId,
      termId: mapping.externalTermId,
      termType: mapping.externalTermType,
      mappingType: mapping.mappingType,
      url: mapping.externalUrl,
    })),
    assessments: mechanism.assessments.map((assessment) => ({
      id: assessment.id,
      compoundSlug: assessment.compound.slug,
      compoundName: assessment.compound.displayName,
      effectScore: assessment.effectScore,
      quantitativeScoreSupported: assessment.quantitativeScoreSupported,
      effectDirection: assessment.effectDirection,
      evidenceConfidence: assessment.evidenceConfidence,
      curationStatus: assessment.curationStatus,
      humanRelevance: assessment.humanRelevance,
    })),
    claims,
    paperCount: new Set(mechanism.mechanisticClaims.map((claim) => claim.evidenceSource.id)).size,
    directness: [...directnessCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    species: tally(claims.map((claim) => claim.speciesText)),
    tissues: tally(claims.map((claim) => claim.tissueText)),
    cells: tally(claims.map((claim) => claim.cellTypeText)),
    verifiedClaims: claims.filter((claim) => claim.curatorVerified).length,
    candidateClaims: claims.filter((claim) => !claim.curatorVerified && claim.mappingState === "CANDIDATE").length,
  };
}
