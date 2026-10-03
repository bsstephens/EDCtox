export const LITERATURE_QUERY_VERSION = "bpa-reproductive-v2";

/** PubMed relevance window. Foundational and highly matched records. */
export const PUBMED_RELEVANCE_CAP = 15;
/** PubMed publication-date window. Newer records after the relevance set. */
export const PUBMED_RECENT_CAP = 10;
/** Europe PMC is a complement, not a second firehose. Each window stays small. */
export const EUROPE_PMC_WINDOW_CAP = 10;
/** Unique Europe PMC inserts per purpose, after the relevance gate and deduplication. */
export const EUROPE_PMC_UNIQUE_CAP = 10;

export const LITERATURE_PROVIDERS = ["PUBMED", "EUROPE_PMC"] as const;
export const LITERATURE_PURPOSES = [
  "SYSTEMATIC_REVIEWS",
  "HUMAN_REPRODUCTIVE",
  "CONTRADICTORY_OR_NULL",
] as const;

export type LiteratureProviderName = (typeof LITERATURE_PROVIDERS)[number];
export type LiteraturePurposeName = (typeof LITERATURE_PURPOSES)[number];
export type ResultWindowName = "relevance" | "recent";

export const RESULT_WINDOWS: Array<{
  name: ResultWindowName;
  pubmedSort: string;
  /** Null omits the sort parameter. Europe PMC then uses its relevance default. */
  europePmcSort: string | null;
}> = [
  { name: "relevance", pubmedSort: "relevance", europePmcSort: null },
  { name: "recent", pubmedSort: "pub_date", europePmcSort: "P_PDATE_D desc" },
];

/**
 * HUMAN_REPRODUCTIVE is a human-relevant candidate search.
 * humans[MeSH] and the words human/humans do not confirm an observational or clinical study.
 * CONTRADICTORY_OR_NULL is a separate supplemental search for null-result language.
 * It is noisy, it is not exhaustive, and a hit is not a confirmed null finding.
 */
export const PURPOSE_NOTES: Record<LiteraturePurposeName, string | null> = {
  SYSTEMATIC_REVIEWS: null,
  HUMAN_REPRODUCTIVE:
    "Human-relevant candidates. The humans filter does not confirm an observational or clinical study.",
  CONTRADICTORY_OR_NULL:
    "Supplemental search for null-result language. Noisy and not exhaustive. A hit is not a confirmed null finding.",
};

/** Locked to the seeded BPA record. This phase does not search any other compound. */
export const BPA_REPRODUCTIVE_SCOPE = {
  slug: "bpa",
  domain: "reproductive",
  canonicalName: "Bisphenol A",
  abbreviation: "BPA",
  iupacName: "4,4'-(propane-2,2-diyl)diphenol",
  casNumber: "80-05-7",
} as const;

const IDENTITY_PUBMED =
  '("Bisphenol A"[Title/Abstract] OR "Bisphenol A"[MeSH Terms] OR "BPA"[Title/Abstract] OR "4,4\'-(propane-2,2-diyl)diphenol"[Title/Abstract] OR "80-05-7"[RN])';

const REPRODUCTIVE_PUBMED =
  "(reproduction[Title/Abstract] OR reproductive[Title/Abstract] OR fertility[Title/Abstract] OR infertility[Title/Abstract] OR ovary[Title/Abstract] OR ovarian[Title/Abstract] OR sperm[Title/Abstract] OR semen[Title/Abstract] OR testosterone[Title/Abstract] OR estradiol[Title/Abstract] OR steroidogenesis[Title/Abstract])";

const REVIEW_PUBMED = "(systematic review[Publication Type] OR meta-analysis[Publication Type])";

const NULL_PUBMED =
  '("no association"[Title/Abstract] OR "not associated"[Title/Abstract] OR "no significant association"[Title/Abstract] OR "no effect"[Title/Abstract] OR "null finding"[Title/Abstract])';

const EUROPE_SOURCE = "(SRC:MED OR SRC:PMC)";

function europeField(term: string): string {
  return `(TITLE:"${term}" OR ABSTRACT:"${term}")`;
}

function europeAny(terms: readonly string[]): string {
  return `(${terms.map(europeField).join(" OR ")})`;
}

const IDENTITY_EUROPE = europeAny([
  BPA_REPRODUCTIVE_SCOPE.canonicalName,
  BPA_REPRODUCTIVE_SCOPE.iupacName,
  BPA_REPRODUCTIVE_SCOPE.casNumber,
  BPA_REPRODUCTIVE_SCOPE.abbreviation,
]);

const REPRODUCTIVE_TERMS = [
  "reproduction",
  "reproductive",
  "fertility",
  "infertility",
  "ovary",
  "ovarian",
  "sperm",
  "semen",
  "testosterone",
  "estradiol",
  "steroidogenesis",
] as const;

const REPRODUCTIVE_EUROPE = europeAny(REPRODUCTIVE_TERMS);
const REVIEW_EUROPE = europeAny(["systematic review", "meta-analysis"]);
const NULL_EUROPE = europeAny([
  "no association",
  "not associated",
  "no significant association",
  "no effect",
  "null finding",
]);
const HUMAN_EUROPE = europeAny(["human", "humans"]);

const PUBMED_QUERIES: Record<LiteraturePurposeName, string> = {
  SYSTEMATIC_REVIEWS: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND ${REVIEW_PUBMED}`,
  HUMAN_REPRODUCTIVE: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND humans[MeSH Terms] NOT ${REVIEW_PUBMED}`,
  CONTRADICTORY_OR_NULL: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND ${NULL_PUBMED}`,
};

const EUROPE_QUERIES: Record<LiteraturePurposeName, string> = {
  SYSTEMATIC_REVIEWS: `${IDENTITY_EUROPE} AND ${REPRODUCTIVE_EUROPE} AND ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
  HUMAN_REPRODUCTIVE: `${IDENTITY_EUROPE} AND ${REPRODUCTIVE_EUROPE} AND ${HUMAN_EUROPE} AND NOT ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
  CONTRADICTORY_OR_NULL: `${IDENTITY_EUROPE} AND ${REPRODUCTIVE_EUROPE} AND ${NULL_EUROPE} AND ${EUROPE_SOURCE}`,
};

export type BuiltLiteratureQuery = {
  version: string;
  purpose: LiteraturePurposeName;
  provider: LiteratureProviderName;
  query: string;
};

export function buildBpaReproductiveQuery(
  purpose: LiteraturePurposeName,
  provider: LiteratureProviderName,
): BuiltLiteratureQuery {
  const query = provider === "PUBMED" ? PUBMED_QUERIES[purpose] : EUROPE_QUERIES[purpose];
  return {
    version: LITERATURE_QUERY_VERSION,
    purpose,
    provider,
    query,
  };
}

export function windowCap(provider: LiteratureProviderName, windowName: ResultWindowName): number {
  if (provider === "EUROPE_PMC") return EUROPE_PMC_WINDOW_CAP;
  return windowName === "relevance" ? PUBMED_RELEVANCE_CAP : PUBMED_RECENT_CAP;
}

export function windowSort(provider: LiteratureProviderName, windowName: ResultWindowName): string | null {
  const window = RESULT_WINDOWS.find((item) => item.name === windowName);
  if (!window) throw new Error(`Unknown result window ${windowName}.`);
  return provider === "PUBMED" ? window.pubmedSort : window.europePmcSort;
}

export function assertBpaReproductiveTarget(compound: {
  slug: string;
  canonicalName: string;
  displayName: string;
  casNumber: string | null;
  aliasNames: string[];
}): void {
  const scope = BPA_REPRODUCTIVE_SCOPE;
  if (compound.slug !== scope.slug) {
    throw new Error("Phase 3A searches BPA only.");
  }
  if (compound.canonicalName !== scope.canonicalName || compound.casNumber !== scope.casNumber) {
    throw new Error("The BPA record does not match the versioned query identity.");
  }
  if (compound.displayName !== scope.abbreviation) {
    throw new Error("The BPA abbreviation used by the query is not the stored display name.");
  }
  if (!compound.aliasNames.includes(scope.iupacName)) {
    throw new Error("The BPA IUPAC alias required by the query is not stored.");
  }
}
