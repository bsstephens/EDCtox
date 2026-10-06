import type { EvidenceDirectness, MechanisticRelation, Prisma, PrismaClient, ScorePolicy } from "../../../generated/prisma";

import { coverageState, type CoverageState } from "../coverage/query";

type Store = PrismaClient | Prisma.TransactionClient;

export type MappingEventView = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  note: string | null;
  fromState: string;
  toState: string;
  fromMechanismCode: string | null;
  toMechanismCode: string | null;
};

export type MappingQueueRow = {
  id: string;
  compoundSlug: string;
  compoundName: string;
  subjectText: string;
  relation: MechanisticRelation;
  objectText: string;
  directness: EvidenceDirectness;
  state: CoverageState;
  reviewDerived: boolean;
  title: string;
  year: number;
  pmid: string | null;
  doi: string | null;
  speciesText: string | null;
  tissueText: string | null;
  cellTypeText: string | null;
  doseText: string | null;
  machineMechanismCode: string | null;
  machineMechanismName: string | null;
  mechanismCode: string | null;
  mechanismName: string | null;
  domainShortLabel: string | null;
  curatorVerified: boolean;
  events: MappingEventView[];
};

export type MechanismChoice = {
  code: string;
  name: string;
  domainShortLabel: string;
  familyName: string | null;
  parentName: string | null;
  scorePolicy: ScorePolicy;
};

const STATE_RANK: Record<CoverageState, number> = { UNMAPPED: 0, CANDIDATE: 1, VERIFIED: 2 };

export function filterQueue(rows: readonly MappingQueueRow[], query: string): MappingQueueRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) =>
    [row.compoundName, row.subjectText, row.objectText, row.relation, row.mechanismCode, row.machineMechanismCode, row.pmid, row.title, row.domainShortLabel]
      .some((value) => value?.toLowerCase().includes(needle)),
  );
}

export async function loadMappingQueue(store: Store): Promise<MappingQueueRow[]> {
  const rows = await store.mechanisticClaim.findMany({
    select: {
      id: true,
      subjectText: true,
      relation: true,
      objectText: true,
      reviewDerived: true,
      machineDirectness: true,
      speciesText: true,
      tissueText: true,
      cellTypeText: true,
      doseText: true,
      curatorVerified: true,
      curatorMappingState: true,
      mechanismId: true,
      compound: { select: { slug: true, displayName: true } },
      machineMechanism: { select: { code: true, name: true } },
      mechanism: { select: { code: true, name: true, domain: { select: { shortLabel: true } } } },
      evidenceSource: { select: { title: true, year: true, pmid: true, doi: true } },
      mappingEvents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          action: true,
          actor: true,
          createdAt: true,
          note: true,
          fromState: true,
          toState: true,
          fromMechanism: { select: { code: true } },
          toMechanism: { select: { code: true } },
        },
      },
    },
  });
  return rows
    .map((row) => ({
      id: row.id,
      compoundSlug: row.compound.slug,
      compoundName: row.compound.displayName,
      subjectText: row.subjectText,
      relation: row.relation,
      objectText: row.objectText,
      directness: row.machineDirectness,
      state: coverageState(row),
      reviewDerived: row.reviewDerived,
      title: row.evidenceSource.title,
      year: row.evidenceSource.year,
      pmid: row.evidenceSource.pmid,
      doi: row.evidenceSource.doi,
      speciesText: row.speciesText,
      tissueText: row.tissueText,
      cellTypeText: row.cellTypeText,
      doseText: row.doseText,
      machineMechanismCode: row.machineMechanism?.code ?? null,
      machineMechanismName: row.machineMechanism?.name ?? null,
      mechanismCode: row.mechanism?.code ?? null,
      mechanismName: row.mechanism?.name ?? null,
      domainShortLabel: row.mechanism?.domain.shortLabel ?? null,
      curatorVerified: row.curatorVerified,
      events: row.mappingEvents.map((event) => ({
        id: event.id,
        action: event.action,
        actor: event.actor,
        createdAt: event.createdAt.toISOString(),
        note: event.note,
        fromState: event.fromState,
        toState: event.toState,
        fromMechanismCode: event.fromMechanism?.code ?? null,
        toMechanismCode: event.toMechanism?.code ?? null,
      })),
    }))
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.compoundName.localeCompare(b.compoundName) || a.objectText.localeCompare(b.objectText));
}

export async function loadMechanismChoices(store: Store): Promise<MechanismChoice[]> {
  const rows = await store.mechanism.findMany({
    where: { scorePolicy: { not: "GROUPING_ONLY" } },
    select: {
      code: true,
      name: true,
      scorePolicy: true,
      domain: { select: { shortLabel: true } },
      family: { select: { name: true } },
      parent: { select: { name: true } },
    },
    orderBy: [{ domain: { sortOrder: "asc" } }, { name: "asc" }],
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    domainShortLabel: row.domain.shortLabel,
    familyName: row.family?.name ?? null,
    parentName: row.parent?.name ?? null,
    scorePolicy: row.scorePolicy,
  }));
}
