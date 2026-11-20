import { type IncomingPaper, type ProviderMetadata } from "./dedup";
import { plainText } from "./entities";

function decodeXml(value: string): string {
  return plainText(value);
}

function block(xml: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return match?.[1] ?? null;
}

export function parseEsearch(payload: unknown): { count: number; ids: string[] } {
  if (!payload || typeof payload !== "object") {
    throw new Error("PubMed esearch response was not an object.");
  }
  const result = (payload as { esearchresult?: { count?: string; idlist?: unknown } }).esearchresult;
  if (!result) throw new Error("PubMed esearch response had no esearchresult.");
  const count = Number(result.count ?? "0");
  const ids = Array.isArray(result.idlist)
    ? result.idlist.filter((id): id is string => typeof id === "string" && /^\d+$/.test(id))
    : [];
  return { count: Number.isFinite(count) ? count : ids.length, ids };
}

function all(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g"))]
    .map((match) => decodeXml(match[1] ?? "").trim())
    .filter(Boolean);
}

/** A PubMed date block, as an ISO day. Only the provider's own indexing dates go through here. */
function dateFrom(xml: string | null): string | null {
  if (!xml) return null;
  const year = block(xml, "Year");
  if (!year) return null;
  const month = block(xml, "Month") ?? "01";
  const day = block(xml, "Day") ?? "01";
  const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function parseProviderMetadata(article: string): ProviderMetadata {
  const publicationTypes = [
    ...new Set(all(article, "PublicationType").map((value) => value.toLowerCase())),
  ].sort();
  // Descriptor headings carry the subject indexing, including species and life stage.
  const meshDescriptors = [...new Set(all(block(article, "MeshHeadingList") ?? "", "DescriptorName"))].sort();
  // Substance headings are the indexer's view of which chemicals the paper is about. They are
  // the independent check on compound identity: bisphenol A and bisphenol S are separate rows.
  const meshSubstances = [...new Set(all(block(article, "ChemicalList") ?? "", "NameOfSubstance"))].sort();
  const indexedAt = dateFrom(block(article, "DateCompleted")) ?? dateFrom(block(article, "DateRevised"));
  return { publicationTypes, meshDescriptors, meshSubstances, indexedAt };
}

function parseArticle(article: string): IncomingPaper {
  const journal = block(article, "Journal") ?? "";
  const journalTitle = decodeXml(block(journal, "Title") ?? "");
  const medline = /<MedlineDate>([^<]+)<\/MedlineDate>/.exec(journal)?.[1];
  const yearText =
    /<Year>(\d{4})<\/Year>/.exec(journal)?.[1] ??
    (medline ? /\d{4}/.exec(medline)?.[0] : undefined) ??
    /<ArticleDate[^>]*>[\s\S]*?<Year>(\d{4})<\/Year>/.exec(article)?.[1] ??
    null;
  const title = decodeXml(block(article, "ArticleTitle") ?? "");
  const pmid = /<PMID[^>]*>(\d+)<\/PMID>/.exec(article)?.[1] ?? null;
  const doi = /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i.exec(article)?.[1]?.trim() ?? null;
  const pmcid = /<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/i.exec(article)?.[1]?.trim() ?? null;
  const abstractParts = [...article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((match) =>
    decodeXml(match[1] ?? ""),
  );
  const authorBlock = block(article, "AuthorList") ?? "";
  const authors = [...authorBlock.matchAll(/<Author[\s>][\s\S]*?<\/Author>/g)].map((match) => {
    const author = match[0] ?? "";
    const last = decodeXml(block(author, "LastName") ?? "");
    const fore = decodeXml(block(author, "ForeName") ?? "");
    return [last, fore].filter(Boolean).join(" ");
  });
  const provider = parseProviderMetadata(article);
  const pubTypes = provider.publicationTypes;
  const retracted =
    pubTypes.includes("retracted publication") ||
    article.includes('RefType="RetractionIn"') ||
    title.toLowerCase().startsWith("retracted");
  const year = yearText ? Number(yearText) : null;

  return {
    doi,
    pmid,
    pmcid,
    title,
    authors: authors.length > 0 ? authors.slice(0, 12).join(", ") : null,
    journal: journalTitle || null,
    year: year !== null && Number.isFinite(year) ? year : null,
    abstractText: abstractParts.filter(Boolean).join("\n") || null,
    openAccess: null,
    retracted,
    url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : doi ? `https://doi.org/${doi}` : "",
    provider,
  };
}

export function parsePubmedArticles(xml: string): IncomingPaper[] {
  if (!xml.includes("<PubmedArticleSet")) {
    throw new Error("PubMed efetch response was not a PubmedArticleSet.");
  }
  const parts = xml.split(/<PubmedArticle[\s>]/).slice(1);
  return parts.map((part) => parseArticle(part.split("</PubmedArticle>")[0] ?? ""));
}
