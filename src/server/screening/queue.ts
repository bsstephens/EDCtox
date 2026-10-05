import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { governingPurpose } from "./deterministic";
import { SCREENING_DOMAIN, SCREENING_PURPOSES, SCREENING_QUERY_VERSION, type ScreeningPurposeName } from "./reasons";
import { sortScreeningQueue, type QueueCandidate } from "./sample";

type Store = PrismaClient | Prisma.TransactionClient;

export type ScreeningFilters = {
  curator: "any" | "pending" | "INCLUDE" | "EXCLUDE" | "UNCERTAIN";
  machine: "any" | "none" | "INCLUDE" | "EXCLUDE" | "UNCERTAIN";
  purpose: "any" | ScreeningPurposeName;
  provider: "any" | "PUBMED" | "EUROPE_PMC";
  year: string;
  signal: string;
  abstract: "any" | "yes" | "no";
  openAccess: "any" | "yes" | "no";
  retracted: "any" | "hide" | "only";
};

export type ScreeningCard = QueueCandidate & {
  journal: string;
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  openAccess: boolean | null;
  abstractText: string | null;
  abstractLabel: string | null;
  studySignal: string | null;
  providers: Array<"PUBMED" | "EUROPE_PMC">;
  provenance: string[];
  machineReason: string | null;
  machineConfidence: string | null;
  machineRationale: string | null;
  curatorDecision: string | null;
  curatorReasonCode: string | null;
  curatorNotes: string | null;
  governingPurpose: ScreeningPurposeName | null;
};

const PURPOSE_LABEL: Record<ScreeningPurposeName, string> = {
  SYSTEMATIC_REVIEWS: "systematic reviews",
  HUMAN_REPRODUCTIVE: "human reproductive",
  CONTRADICTORY_OR_NULL: "contradictory or null",
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseScreeningFilters(params: Record<string, string | string[] | undefined>): ScreeningFilters {
  const curator = one(params.curator);
  const machine = one(params.machine);
  const purpose = one(params.purpose);
  const provider = one(params.provider);
  const abstract = one(params.abstract);
  const openAccess = one(params.oa);
  const retracted = one(params.retracted);
  return {
    curator: curator === "pending" || curator === "INCLUDE" || curator === "EXCLUDE" || curator === "UNCERTAIN" ? curator : "any",
    machine: machine === "none" || machine === "INCLUDE" || machine === "EXCLUDE" || machine === "UNCERTAIN" ? machine : "any",
    purpose: (SCREENING_PURPOSES as readonly string[]).includes(purpose) ? (purpose as ScreeningPurposeName) : "any",
    provider: provider === "PUBMED" || provider === "EUROPE_PMC" ? provider : "any",
    year: one(params.year),
    signal: one(params.signal),
    abstract: abstract === "yes" || abstract === "no" ? abstract : "any",
    openAccess: openAccess === "yes" || openAccess === "no" ? openAccess : "any",
    retracted: retracted === "hide" || retracted === "only" ? retracted : "any",
  };
}

export function filterScreeningCards(cards: readonly ScreeningCard[], filters: ScreeningFilters): ScreeningCard[] {
  return cards.filter((card) => {
    if (filters.curator === "pending" && card.curatorDecision) return false;
    if (filters.curator !== "any" && filters.curator !== "pending" && card.curatorDecision !== filters.curator) return false;
    if (filters.machine === "none" && card.machineDecision) return false;
    if (filters.machine !== "any" && filters.machine !== "none" && card.machineDecision !== filters.machine) return false;
    if (filters.purpose !== "any" && !card.purposes.includes(filters.purpose)) return false;
    if (filters.provider !== "any" && !card.providers.includes(filters.provider)) return false;
    if (filters.year && String(card.year ?? "") !== filters.year) return false;
    if (filters.signal && card.studySignal !== filters.signal) return false;
    if (filters.abstract === "yes" && !card.abstractText) return false;
    if (filters.abstract === "no" && card.abstractText) return false;
    if (filters.openAccess === "yes" && card.openAccess !== true) return false;
    if (filters.openAccess === "no" && card.openAccess !== false) return false;
    if (filters.retracted === "hide" && (card.retracted || card.publicationStatus === "RETRACTED")) return false;
    if (filters.retracted === "only" && !card.retracted && card.publicationStatus !== "RETRACTED") return false;
    return true;
  });
}

function jsonString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function abstractLabel(provenance: string | null, abstractText: string | null): string | null {
  if (!abstractText) return null;
  if (provenance === "PUBMED") return "Abstract from PubMed";
  if (provenance === "EUROPE_PMC") return "Abstract from Europe PMC";
  return "Abstract from the stored provider";
}

export async function loadBpaScreeningQueue(store: Store): Promise<{ compoundId: string; cards: ScreeningCard[]; duplicateHitCount: number }> {
  const compound = await store.compound.findUnique({ where: { slug: "bpa" }, select: { id: true } });
  if (!compound) throw new Error("BPA is not in the database.");
  const sources = await store.evidenceSource.findMany({
    where: {
      publicationStatus: { in: ["SCREENING_PENDING", "RETRACTED"] },
      searchHits: { some: { searchRun: { queryVersion: SCREENING_QUERY_VERSION, compoundId: compound.id } } },
    },
    select: {
      id: true,
      title: true,
      year: true,
      journalOrPublisher: true,
      doi: true,
      pmid: true,
      pmcid: true,
      openAccess: true,
      retracted: true,
      publicationStatus: true,
      abstractText: true,
      supplemental: true,
      searchHits: {
        select: {
          disposition: true,
          searchRun: { select: { provider: true, purpose: true, resultWindow: true, queryVersion: true, compoundId: true } },
        },
      },
      screeningDecisions: {
        where: { compoundId: compound.id, domainCode: SCREENING_DOMAIN },
        select: {
          machineDecision: true,
          machineReason: true,
          machineConfidence: true,
          machineRationale: true,
          curatorDecision: true,
          curatorReasonCode: true,
          curatorNotes: true,
        },
      },
    },
  });

  let duplicateHitCount = 0;
  const cards = sources.map((source) => {
    const hits = source.searchHits.filter(
      (hit) => hit.searchRun.compoundId === compound.id && hit.searchRun.queryVersion === SCREENING_QUERY_VERSION,
    );
    duplicateHitCount += hits.filter((hit) => hit.disposition === "DUPLICATE").length;
    const purposes = [...new Set(hits.map((hit) => hit.searchRun.purpose))];
    const providers = [...new Set(hits.map((hit) => hit.searchRun.provider))];
    const windows = [...new Set(hits.map((hit) => hit.searchRun.resultWindow))];
    const decision = source.screeningDecisions[0] ?? null;
    return {
      sourceId: source.id,
      title: source.title,
      year: source.year,
      journal: source.journalOrPublisher,
      doi: source.doi,
      pmid: source.pmid,
      pmcid: source.pmcid,
      openAccess: source.openAccess,
      retracted: source.retracted || source.publicationStatus === "RETRACTED",
      publicationStatus: source.publicationStatus,
      abstractText: source.abstractText,
      abstractLabel: abstractLabel(jsonString(source.supplemental, "abstractProvenance"), source.abstractText),
      studySignal: jsonString(source.supplemental, "studySignal"),
      purposes,
      providers,
      windows,
      provenance: hits.map((hit) => {
        const provider = hit.searchRun.provider === "PUBMED" ? "PubMed" : "Europe PMC";
        return `${provider}, ${PURPOSE_LABEL[hit.searchRun.purpose]}, ${hit.searchRun.resultWindow}`;
      }),
      machineDecision: decision?.machineDecision ?? null,
      machineReason: decision?.machineReason ?? null,
      machineConfidence: decision?.machineConfidence ?? null,
      machineRationale: decision?.machineRationale ?? null,
      curatorDecision: decision?.curatorDecision ?? null,
      curatorReasonCode: decision?.curatorReasonCode ?? null,
      curatorNotes: decision?.curatorNotes ?? null,
      governingPurpose: governingPurpose(purposes),
    };
  });

  return { compoundId: compound.id, cards: sortScreeningQueue(cards), duplicateHitCount };
}
