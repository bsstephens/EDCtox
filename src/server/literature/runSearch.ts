import { applyLiteratureRun, recordCompoundSearched, type LiteratureStore } from "./applyCandidates";
import { planLiteratureHits, type ExistingSource, type PlannedHit } from "./dedup";
import { buildBpaReproductiveQuery, type LiteratureProviderName, type LiteraturePurposeName } from "./queries";
import { fetchLiteraturePage } from "./remote";

export type LiteratureHitSummary = {
  disposition: PlannedHit["disposition"];
  title: string;
  year: number | null;
  doi: string | null;
  pmid: string | null;
  retracted: boolean;
  abstractRetained: boolean;
};

export type LiteratureRunReport = {
  provider: LiteratureProviderName;
  purpose: LiteraturePurposeName;
  queryVersion: string;
  queryText: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  errorText: string | null;
  providerReportedCount: number | null;
  resultCount: number;
  insertedCount: number;
  duplicateCount: number;
  conflictCount: number;
  skippedCount: number;
  hits: LiteratureHitSummary[];
};

function summarize(hits: PlannedHit[]): Pick<
  LiteratureRunReport,
  "resultCount" | "insertedCount" | "duplicateCount" | "conflictCount" | "skippedCount" | "hits"
> {
  return {
    resultCount: hits.length,
    insertedCount: hits.filter((hit) => hit.disposition === "INSERTED").length,
    duplicateCount: hits.filter((hit) => hit.disposition === "DUPLICATE").length,
    conflictCount: hits.filter((hit) => hit.disposition === "CONFLICT").length,
    skippedCount: hits.filter((hit) => hit.disposition === "SKIPPED").length,
    hits: hits.map((hit) => ({
      disposition: hit.disposition,
      title: hit.paper.title,
      year: hit.paper.year,
      doi: hit.paper.doi,
      pmid: hit.paper.pmid,
      retracted: hit.paper.retracted,
      abstractRetained: Boolean(hit.paper.abstractText) && hit.disposition === "INSERTED",
    })),
  };
}

function absorb(existing: ExistingSource[], hits: PlannedHit[], written: Map<string, string>): ExistingSource[] {
  const next = existing.slice();
  for (const hit of hits) {
    if (hit.disposition !== "INSERTED" || !hit.stableKey || hit.paper.year === null) continue;
    next.push({
      id: written.get(hit.stableKey) ?? `pending:${hit.stableKey}`,
      doi: hit.paper.doi,
      pmid: hit.paper.pmid,
      title: hit.paper.title,
      year: hit.paper.year,
    });
  }
  return next;
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
    for (const provider of options.providers) {
      const built = buildBpaReproductiveQuery(purpose, provider);
      const startedAt = new Date();
      try {
        const page = await fetchLiteraturePage({
          provider,
          query: built.query,
          fetchImpl: options.fetchImpl,
          sleep: options.sleep,
          ncbiApiKey: options.ncbiApiKey,
          ncbiEmail: options.ncbiEmail,
        });
        const hits = planLiteratureHits(existing, page.papers);
        const status = page.providerReportedCount > page.papers.length ? "PARTIAL" : "SUCCEEDED";
        let written = new Map<string, string>();
        if (!options.dryRun && options.store) {
          written = await applyLiteratureRun(options.store, {
            compoundId: options.compound.id,
            provider,
            purpose,
            queryText: built.query,
            startedAt,
            completedAt: now,
            providerReportedCount: page.providerReportedCount,
            status,
            errorText: null,
            hits,
          });
        }
        existing = absorb(existing, hits, written);
        anySuccess = true;
        reports.push({
          provider,
          purpose,
          queryVersion: built.version,
          queryText: built.query,
          status,
          errorText: null,
          providerReportedCount: page.providerReportedCount,
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
            startedAt,
            completedAt: now,
            providerReportedCount: null,
            status: "FAILED",
            errorText: message.slice(0, 2000),
            hits: [],
          });
        }
        reports.push({
          provider,
          purpose,
          queryVersion: built.version,
          queryText: built.query,
          status: "FAILED",
          errorText: message.slice(0, 2000),
          providerReportedCount: null,
          resultCount: 0,
          insertedCount: 0,
          duplicateCount: 0,
          conflictCount: 0,
          skippedCount: 0,
          hits: [],
        });
      }
    }
  }

  if (!options.dryRun && anySuccess && options.store) {
    await recordCompoundSearched(options.store, options.compound.id, options.compound.curationStatus, now);
  }

  return reports;
}
