import { applyLiteratureRun, recordCompoundSearched, type LiteratureStore } from "./applyCandidates";
import { planLiteratureHits, type ExistingSource, type IncomingPaper, type PlannedHit } from "./dedup";
import {
  EUROPE_PMC_UNIQUE_CAP,
  PURPOSE_NOTES,
  RESULT_WINDOWS,
  buildBpaReproductiveQuery,
  windowCap,
  windowSort,
  type LiteratureProviderName,
  type LiteraturePurposeName,
  type ResultWindowName,
} from "./queries";
import { assessReproductiveRelevance, studySignal } from "./relevance";
import { fetchLiteraturePage } from "./remote";

export type LiteratureHitSummary = {
  disposition: PlannedHit["disposition"];
  title: string;
  year: number | null;
  doi: string | null;
  pmid: string | null;
  retracted: boolean;
  abstractRetained: boolean;
  studySignal: string | null;
  enrichment: boolean;
};

export type LiteratureRunReport = {
  provider: LiteratureProviderName;
  purpose: LiteraturePurposeName;
  resultWindow: ResultWindowName;
  sortMode: string;
  purposeNote: string | null;
  queryVersion: string;
  queryText: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  errorText: string | null;
  providerReportedCount: number | null;
  fetchedCount: number;
  passedCount: number;
  resultCount: number;
  insertedCount: number;
  duplicateCount: number;
  conflictCount: number;
  skippedCount: number;
  relevanceSkipCount: number;
  capSkipCount: number;
  hits: LiteratureHitSummary[];
};

function summarize(hits: PlannedHit[]): Pick<
  LiteratureRunReport,
  | "resultCount"
  | "insertedCount"
  | "duplicateCount"
  | "conflictCount"
  | "skippedCount"
  | "relevanceSkipCount"
  | "capSkipCount"
  | "hits"
> {
  return {
    resultCount: hits.length,
    insertedCount: hits.filter((hit) => hit.disposition === "INSERTED").length,
    duplicateCount: hits.filter((hit) => hit.disposition === "DUPLICATE").length,
    conflictCount: hits.filter((hit) => hit.disposition === "CONFLICT").length,
    skippedCount: hits.filter((hit) => hit.disposition === "SKIPPED").length,
    relevanceSkipCount: hits.filter((hit) => hit.skipReason?.startsWith("relevance-")).length,
    capSkipCount: hits.filter((hit) => hit.skipReason === "provider-cap").length,
    hits: hits.map((hit) => ({
      disposition: hit.disposition,
      title: hit.paper.title,
      year: hit.paper.year,
      doi: hit.paper.doi,
      pmid: hit.paper.pmid,
      retracted: hit.paper.retracted,
      abstractRetained: Boolean(hit.paper.abstractText) && hit.disposition === "INSERTED",
      studySignal: hit.studySignal,
      enrichment: Boolean(hit.enrichment),
    })),
  };
}

export function capNewInserts(hits: PlannedHit[], room: number): { hits: PlannedHit[]; used: number } {
  let remaining = room;
  let used = 0;
  const next = hits.map((hit) => {
    if (hit.disposition !== "INSERTED") return hit;
    if (remaining > 0) {
      remaining -= 1;
      used += 1;
      return hit;
    }
    return {
      ...hit,
      disposition: "SKIPPED" as const,
      stableKey: null,
      skipReason: "provider-cap" as const,
      detail: "Europe PMC unique cap for this purpose.",
    };
  });
  return { hits: next, used };
}

function absorb(existing: ExistingSource[], hits: PlannedHit[], written: Map<string, string>): ExistingSource[] {
  const next = existing.map((source) => ({ ...source }));
  for (const hit of hits) {
    if (hit.disposition !== "INSERTED" || !hit.stableKey || hit.paper.year === null) continue;
    next.push({
      id: written.get(hit.stableKey) ?? `pending:${hit.stableKey}`,
      doi: hit.paper.doi,
      pmid: hit.paper.pmid,
      title: hit.paper.title,
      year: hit.paper.year,
      pmcid: hit.paper.pmcid,
      openAccess: hit.paper.openAccess,
    });
  }
  for (const hit of hits) {
    if (!hit.enrichment || !hit.matchedSourceId) continue;
    const resolved = hit.matchedSourceId.startsWith("pending:")
      ? written.get(hit.matchedSourceId.slice("pending:".length)) ?? hit.matchedSourceId
      : hit.matchedSourceId;
    const match = next.find((source) => source.id === resolved || source.id === hit.matchedSourceId);
    if (!match) continue;
    if (hit.enrichment.pmcid) match.pmcid = hit.enrichment.pmcid;
    if (hit.enrichment.openAccess !== undefined) match.openAccess = hit.enrichment.openAccess;
  }
  return next;
}

function emptyReport(
  provider: LiteratureProviderName,
  purpose: LiteraturePurposeName,
  resultWindow: ResultWindowName,
  sortMode: string,
  queryVersion: string,
  queryText: string,
  errorText: string,
): LiteratureRunReport {
  return {
    provider,
    purpose,
    resultWindow,
    sortMode,
    purposeNote: PURPOSE_NOTES[purpose],
    queryVersion,
    queryText,
    status: "FAILED",
    errorText,
    providerReportedCount: null,
    fetchedCount: 0,
    passedCount: 0,
    resultCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    conflictCount: 0,
    skippedCount: 0,
    relevanceSkipCount: 0,
    capSkipCount: 0,
    hits: [],
  };
}

export async function runBpaReproductiveSearch(options: {
  compound: { id: string; curationStatus: string };
  purposes: LiteraturePurposeName[];
  providers: LiteratureProviderName[];
  existing: ExistingSource[];
  dryRun: boolean;
  store?: LiteratureStore;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: Date;
  ncbiApiKey?: string;
  ncbiEmail?: string;
}): Promise<LiteratureRunReport[]> {
  if (!options.dryRun && !options.store) throw new Error("Apply requires a store.");
  const now = options.now ?? new Date();
  let existing = options.existing;
  const reports: LiteratureRunReport[] = [];
  let anySuccess = false;

  for (const purpose of options.purposes) {
    let europeRoom = EUROPE_PMC_UNIQUE_CAP;
    for (const provider of options.providers) {
      for (const window of RESULT_WINDOWS) {
        const built = buildBpaReproductiveQuery(purpose, provider);
        const sort = windowSort(provider, window.name);
        const sortMode = sort ?? "relevance";
        const startedAt = new Date();
        try {
          const page = await fetchLiteraturePage({
            provider,
            query: built.query,
            sort,
            resultCap: windowCap(provider, window.name),
            fetchImpl: options.fetchImpl,
            sleep: options.sleep,
            ncbiApiKey: options.ncbiApiKey,
            ncbiEmail: options.ncbiEmail,
          });
          const skipped: PlannedHit[] = [];
          const passed: IncomingPaper[] = [];
          for (const item of page.papers) {
            const decision = assessReproductiveRelevance(item);
            if (!decision.pass && decision.skipReason) {
              skipped.push({
                disposition: "SKIPPED",
                detail: decision.detail,
                stableKey: null,
                matchedSourceId: null,
                paper: item,
                enrichment: null,
                skipReason: decision.skipReason,
                studySignal: null,
              });
            } else {
              passed.push(item);
            }
          }
          let planned = planLiteratureHits(existing, passed).map((hit) => {
            if (hit.disposition === "SKIPPED") return hit;
            const signal = studySignal(hit.paper);
            const detail = hit.disposition === "INSERTED" ? `${hit.detail} Study signal: ${signal}.` : hit.detail;
            return { ...hit, studySignal: signal, detail };
          });
          if (provider === "EUROPE_PMC") {
            const capped = capNewInserts(planned, europeRoom);
            planned = capped.hits;
            europeRoom -= capped.used;
          }
          const hits = [...skipped, ...planned];
          let written = new Map<string, string>();
          if (!options.dryRun && options.store) {
            written = await applyLiteratureRun(options.store, {
              compoundId: options.compound.id,
              provider,
              purpose,
              queryText: built.query,
              resultWindow: window.name,
              sortMode,
              startedAt,
              completedAt: now,
              providerReportedCount: page.providerReportedCount,
              status: page.providerReportedCount > page.papers.length ? "PARTIAL" : "SUCCEEDED",
              errorText: null,
              hits,
            });
          }
          existing = absorb(existing, hits, written);
          anySuccess = true;
          reports.push({
            provider,
            purpose,
            resultWindow: window.name,
            sortMode,
            purposeNote: PURPOSE_NOTES[purpose],
            queryVersion: built.version,
            queryText: built.query,
            status: page.providerReportedCount > page.papers.length ? "PARTIAL" : "SUCCEEDED",
            errorText: null,
            providerReportedCount: page.providerReportedCount,
            fetchedCount: page.papers.length,
            passedCount: passed.length,
            ...summarize(hits),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Literature search failed.";
          if (!options.dryRun && options.store) {
            await applyLiteratureRun(options.store, {
              compoundId: options.compound.id,
              provider,
              purpose,
              queryText: built.query,
              resultWindow: window.name,
              sortMode,
              startedAt,
              completedAt: now,
              providerReportedCount: null,
              status: "FAILED",
              errorText: message.slice(0, 2000),
              hits: [],
            });
          }
          reports.push(emptyReport(provider, purpose, window.name, sortMode, built.version, built.query, message.slice(0, 2000)));
        }
      }
    }
  }

  if (!options.dryRun && anySuccess && options.store) {
    await recordCompoundSearched(options.store, options.compound.id, options.compound.curationStatus, now);
  }

  return reports;
}
