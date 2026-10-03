import { type IncomingPaper } from "./dedup";
import { plainText } from "./entities";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const plain = plainText(value);
  return plain.length > 0 ? plain : null;
}

function parseYear(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : text(value);
  const match = raw?.match(/\d{4}/);
  if (!match) return null;
  return Number(match[0]);
}

function parsePaper(row: Record<string, unknown>): IncomingPaper {
  const source = text(row.source);
  const id = text(row.id);
  const pmid = text(row.pmid) ?? (source === "MED" && id && /^\d+$/.test(id) ? id : null);
  const doi = text(row.doi);
  const pmcid = text(row.pmcid);
  const title = text(row.title) ?? "";
  const pubType = text(row.pubType)?.toLowerCase() ?? "";
  const open = text(row.isOpenAccess);
  return {
    doi,
    pmid,
    pmcid,
    title,
    authors: text(row.authorString),
    journal: text(row.journalTitle),
    year: parseYear(row.pubYear),
    abstractText: text(row.abstractText),
    openAccess: open === "Y" ? true : open === "N" ? false : null,
    retracted: title.toLowerCase().startsWith("retracted") || pubType.includes("retracted"),
    url: pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : pmcid
          ? `https://europepmc.org/articles/${pmcid.toUpperCase().startsWith("PMC") ? pmcid : `PMC${pmcid}`}`
          : "",
  };
}

export function parseEuropePmcSearch(payload: unknown): { count: number; papers: IncomingPaper[] } {
  const root = asRecord(payload);
  if (!root) throw new Error("Europe PMC response was not an object.");
  const resultList = asRecord(root.resultList);
  const raw = resultList?.result;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const papers = rows.map((row) => {
    const record = asRecord(row);
    if (!record) throw new Error("Europe PMC result was not an object.");
    return parsePaper(record);
  });
  const reported = typeof root.hitCount === "number" ? root.hitCount : Number(root.hitCount ?? papers.length);
  return { count: Number.isFinite(reported) ? reported : papers.length, papers };
}
