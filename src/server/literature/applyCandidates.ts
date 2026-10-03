import { normalizeDoi, normalizePmid, type PlannedHit } from "./dedup";
import {
  LITERATURE_QUERY_VERSION,
  type LiteratureProviderName,
  type LiteraturePurposeName,
} from "./queries";

const CANDIDATE_NOTE =
  "Candidate from a literature search. Not a curated finding and not scientific evidence until a later review includes it. Any abstract is an internal screening copy and is not for public display.";

type RunRow = { id: string };
type SourceRow = { id: string };

export type LiteratureStore = {
  literatureSearchRun: {
    create(args: { data: Record<string, unknown> }): Promise<RunRow>;
  };
  literatureSearchHit: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  evidenceSource: {
    create(args: { data: Record<string, unknown> }): Promise<SourceRow>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  compound: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type LiteratureRunWrite = {
  compoundId: string;
  provider: LiteratureProviderName;
  purpose: LiteraturePurposeName;
  queryText: string;
  resultWindow: string;
  sortMode: string;
  startedAt: Date;
  completedAt: Date;
  providerReportedCount: number | null;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  errorText: string | null;
  hits: PlannedHit[];
};

function counts(hits: PlannedHit[]) {
  return {
    resultCount: hits.length,
    insertedCount: hits.filter((hit) => hit.disposition === "INSERTED").length,
    duplicateCount: hits.filter((hit) => hit.disposition === "DUPLICATE").length,
    conflictCount: hits.filter((hit) => hit.disposition === "CONFLICT").length,
    skippedCount: hits.filter((hit) => hit.disposition === "SKIPPED").length,
  };
}

function journalOf(paper: PlannedHit["paper"]): string {
  const journal = paper.journal?.trim() ?? "";
  if (journal.length === 0) return "Not supplied by the provider";
  return journal;
}

function resolveSourceId(matched: string | null, created: Map<string, string>): string | null {
  if (!matched) return null;
  if (matched.startsWith("pending:")) return created.get(matched.slice("pending:".length)) ?? null;
  return matched;
}

export async function applyLiteratureRun(
  store: LiteratureStore,
  input: LiteratureRunWrite,
): Promise<Map<string, string>> {
  const failed = input.status === "FAILED";
  const tally = failed ? { resultCount: 0, insertedCount: 0, duplicateCount: 0, conflictCount: 0, skippedCount: 0 } : counts(input.hits);
  const run = await store.literatureSearchRun.create({
    data: {
      compoundId: input.compoundId,
      provider: input.provider,
      queryText: input.queryText,
      queryVersion: LITERATURE_QUERY_VERSION,
      resultWindow: input.resultWindow,
      sortMode: input.sortMode,
      purpose: input.purpose,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      providerReportedCount: input.providerReportedCount,
      status: input.status,
      errorText: input.errorText,
      ...tally,
    },
  });

  const created = new Map<string, string>();
  if (failed) return created;

  for (const hit of input.hits) {
    if (hit.disposition !== "INSERTED" || !hit.stableKey || hit.paper.year === null) continue;
    const doi = normalizeDoi(hit.paper.doi);
    const pmid = normalizePmid(hit.paper.pmid);
    const retracted = hit.paper.retracted;
    const source = await store.evidenceSource.create({
      data: {
        stableKey: hit.stableKey,
        title: hit.paper.title.trim(),
        authors: hit.paper.authors,
        journalOrPublisher: journalOf(hit.paper),
        year: hit.paper.year,
        doi,
        pmid,
        pmcid: hit.paper.pmcid,
        url: hit.paper.url,
        sourceType: "UNSPECIFIED",
        peerReviewed: false,
        countsAsScientificEvidence: false,
        abstractText: hit.paper.abstractText,
        notes: CANDIDATE_NOTE,
        retrievedAt: input.completedAt,
        retracted,
        openAccess: hit.paper.openAccess,
        publicationStatus: retracted ? "RETRACTED" : "SCREENING_PENDING",
        supplemental: {
          abstractProvenance: hit.paper.abstractText ? input.provider : null,
          queryVersion: LITERATURE_QUERY_VERSION,
          searchPurpose: input.purpose,
          studySignal: hit.studySignal,
        },
      },
    });
    created.set(hit.stableKey, source.id);
  }

  for (const hit of input.hits) {
    if (hit.enrichment) {
      const sourceId = resolveSourceId(hit.matchedSourceId, created);
      const data: Record<string, unknown> = {};
      if (hit.enrichment.pmcid) data.pmcid = hit.enrichment.pmcid;
      if (hit.enrichment.openAccess !== undefined) data.openAccess = hit.enrichment.openAccess;
      if (sourceId && Object.keys(data).length > 0) {
        await store.evidenceSource.update({ where: { id: sourceId }, data });
      }
    }
    await store.literatureSearchHit.create({
      data: {
        searchRunId: run.id,
        sourceId: hit.disposition === "INSERTED" ? created.get(hit.stableKey ?? "") ?? null : resolveSourceId(hit.matchedSourceId, created),
        doi: normalizeDoi(hit.paper.doi),
        pmid: normalizePmid(hit.paper.pmid),
        pmcid: hit.paper.pmcid,
        title: hit.paper.title,
        year: hit.paper.year,
        disposition: hit.disposition,
        detail: hit.detail,
      },
    });
  }

  return created;
}

const GATHERING_FROM = new Set(["UNREVIEWED", "IDENTITY_VERIFIED"]);

export async function recordCompoundSearched(
  store: LiteratureStore,
  compoundId: string,
  currentStatus: string,
  searchedAt: Date,
): Promise<void> {
  const data: Record<string, unknown> = { lastEvidenceSearchAt: searchedAt };
  if (GATHERING_FROM.has(currentStatus)) data.curationStatus = "EVIDENCE_GATHERING";
  await store.compound.update({ where: { id: compoundId }, data });
}
