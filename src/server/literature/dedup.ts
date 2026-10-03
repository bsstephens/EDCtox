import { createHash } from "node:crypto";

export type IncomingPaper = {
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  title: string;
  authors: string | null;
  journal: string | null;
  year: number | null;
  abstractText: string | null;
  openAccess: boolean | null;
  retracted: boolean;
  url: string;
};

export type ExistingSource = {
  id: string;
  doi: string | null;
  pmid: string | null;
  title: string;
  year: number;
};

export type HitDisposition = "INSERTED" | "DUPLICATE" | "CONFLICT" | "SKIPPED";

export type PlannedHit = {
  disposition: HitDisposition;
  detail: string;
  stableKey: string | null;
  matchedSourceId: string | null;
  paper: IncomingPaper;
};

export function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  let doi = value.trim().toLowerCase();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  doi = doi.replace(/^doi:\s*/, "");
  if (!doi.includes("/")) return null;
  return doi;
}

export function normalizePmid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.trim().replace(/^pmid:\s*/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const stripped = digits.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function literatureStableKey(
  doi: string | null,
  pmid: string | null,
  title: string,
  year: number,
): string {
  if (pmid) return `lit:pmid:${pmid}`;
  if (doi) return `lit:doi:${doi}`;
  const digest = createHash("sha256").update(`${normalizeTitle(title)}|${year}`).digest("hex").slice(0, 20);
  return `lit:title:${digest}`;
}

function uniqueById(sources: ExistingSource[]): ExistingSource[] {
  const seen = new Set<string>();
  const unique: ExistingSource[] = [];
  for (const source of sources) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    unique.push(source);
  }
  return unique;
}

function identifiersDisagree(paperDoi: string | null, paperPmid: string | null, source: ExistingSource): boolean {
  const doiDisagrees = Boolean(paperDoi && source.doi && source.doi !== paperDoi);
  const pmidDisagrees = Boolean(paperPmid && source.pmid && source.pmid !== paperPmid);
  return doiDisagrees || pmidDisagrees;
}

export function planLiteratureHits(existing: ExistingSource[], papers: IncomingPaper[]): PlannedHit[] {
  const pool: ExistingSource[] = existing.map((source) => ({
    ...source,
    doi: normalizeDoi(source.doi),
    pmid: normalizePmid(source.pmid),
  }));
  const hits: PlannedHit[] = [];

  for (const paper of papers) {
    const doi = normalizeDoi(paper.doi);
    const pmid = normalizePmid(paper.pmid);
    const title = paper.title.trim();
    const year = paper.year;
    if (!title || year === null || year < 1800 || year > 2100) {
      hits.push({
        disposition: "SKIPPED",
        detail: "Missing a title or a usable year.",
        stableKey: null,
        matchedSourceId: null,
        paper,
      });
      continue;
    }

    const normalizedTitle = normalizeTitle(title);
    const doiMatch = doi ? pool.find((source) => source.doi === doi) : undefined;
    const pmidMatch = pmid ? pool.find((source) => source.pmid === pmid) : undefined;
    const titleMatch = pool.find(
      (source) => normalizeTitle(source.title) === normalizedTitle && source.year === year,
    );
    const identified = uniqueById([doiMatch, pmidMatch].filter((source): source is ExistingSource => Boolean(source)));

    if (identified.length > 1) {
      hits.push({
        disposition: "CONFLICT",
        detail: `DOI and PMID match different stored sources (${identified.map((source) => source.id).join(", ")}). Not merged.`,
        stableKey: null,
        matchedSourceId: null,
        paper,
      });
      continue;
    }

    const identifiedMatch = identified[0];
    if (identifiedMatch) {
      if (titleMatch && titleMatch.id !== identifiedMatch.id) {
        hits.push({
          disposition: "CONFLICT",
          detail: `An identifier matches ${identifiedMatch.id} and the title/year matches ${titleMatch.id}. Not merged.`,
          stableKey: null,
          matchedSourceId: null,
          paper,
        });
        continue;
      }
      hits.push({
        disposition: "DUPLICATE",
        detail: `Matches existing source ${identifiedMatch.id}.`,
        stableKey: null,
        matchedSourceId: identifiedMatch.id,
        paper,
      });
      continue;
    }

    if (titleMatch) {
      if (identifiersDisagree(doi, pmid, titleMatch)) {
        hits.push({
          disposition: "CONFLICT",
          detail: `Title and year match ${titleMatch.id}, but DOI or PMID differs. Not merged.`,
          stableKey: null,
          matchedSourceId: null,
          paper,
        });
        continue;
      }
      hits.push({
        disposition: "DUPLICATE",
        detail: `Title and year match ${titleMatch.id}.`,
        stableKey: null,
        matchedSourceId: titleMatch.id,
        paper,
      });
      continue;
    }

    const stableKey = literatureStableKey(doi, pmid, title, year);
    hits.push({
      disposition: "INSERTED",
      detail: "New candidate source.",
      stableKey,
      matchedSourceId: null,
      paper,
    });
    pool.push({
      id: `pending:${stableKey}`,
      doi,
      pmid,
      title,
      year,
    });
  }

  return hits;
}
