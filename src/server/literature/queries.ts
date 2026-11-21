/** BPA's, kept for the callers that predate per-compound versions. */
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
/**
 * What identifies one compound in a literature search, for one domain.
 *
 * The search layer was written for a single compound with its query strings inlined. Routing and
 * profiling were built to be compound-agnostic from the start -- their whole point is that
 * adding a compound costs nothing and re-reads no paper -- so search was the only stage that
 * had to be generalised to run glyphosate, and this is the shape it needed: the identity terms
 * differ per compound and the domain terms are shared.
 */
export type SearchScope = {
  slug: string;
  domain: string;
  /** Stored on every search run, so a run says which compound's query produced it. */
  queryVersion: string;
  canonicalName: string;
  abbreviation: string | null;
  iupacName: string | null;
  casNumber: string | null;
  /**
   * Extra phrases to retrieve on, which are **not** a claim that they name this compound. For a
   * pesticide this matters: most of the relevant literature studies a formulation and names the
   * brand, so a search that omits "Roundup" misses it. But the formulation is its own record,
   * whose seed says in as many words that no commercial brand is named on it, and Roundup is
   * not glyphosate. So these are retrieval aids only, never checked against stored aliases, and
   * which compound a retrieved paper is actually about is decided later by the profiler's
   * compoundsStudied and by routing, which is where that judgment belongs.
   */
  searchAlsoFor?: readonly string[];
  /** A MeSH term where one exists, which `[MeSH Terms]` cannot be guessed from the name. */
  meshTerm?: string | null;
};

export const BPA_REPRODUCTIVE_SCOPE: SearchScope = {
  slug: "bpa",
  domain: "reproductive",
  queryVersion: "bpa-reproductive-v2",
  canonicalName: "Bisphenol A",
  abbreviation: "BPA",
  iupacName: "4,4'-(propane-2,2-diyl)diphenol",
  casNumber: "80-05-7",
  meshTerm: "Bisphenol A",
};

/**
 * Glyphosate and its formulations searched as one scope, deliberately.
 *
 * The ontology holds `glyphosate` and `glyphosate-based-herbicide` separately, and the evidence
 * turns on that distinction: the NIEHS review assessed the active ingredient and the commercial
 * formulations apart from each other and found the same effects in both. A search query cannot
 * make that split, though -- a paper on Roundup names glyphosate throughout -- so the search is
 * broad and the separation happens where it can be done properly, in the profiler's
 * compoundsStudied and in routing. Searching them as two scopes would mostly return one set of
 * papers twice.
 */
export const GLYPHOSATE_REPRODUCTIVE_SCOPE: SearchScope = {
  slug: "glyphosate",
  domain: "reproductive",
  queryVersion: "glyphosate-reproductive-v1",
  canonicalName: "Glyphosate",
  abbreviation: null,
  iupacName: "N-(phosphonomethyl)glycine",
  casNumber: "1071-83-6",
  searchAlsoFor: ["glyphosate-based herbicide", "Roundup", "MON 52276", "glyphosate-based herbicides"],
  meshTerm: "Glyphosate",
};

export const SEARCH_SCOPES: readonly SearchScope[] = [BPA_REPRODUCTIVE_SCOPE, GLYPHOSATE_REPRODUCTIVE_SCOPE];

export function searchScopeFor(slug: string): SearchScope {
  const scope = SEARCH_SCOPES.find((item) => item.slug === slug);
  if (!scope) {
    throw new Error(`No search scope for ${slug}. Known scopes: ${SEARCH_SCOPES.map((item) => item.slug).join(", ")}.`);
  }
  return scope;
}

function present(terms: ReadonlyArray<string | null | undefined>): string[] {
  return [...new Set(terms.filter((term): term is string => Boolean(term)))];
}

/**
 * Term order is part of the query text, and the query text is stored on every search run and
 * covered by a version. Reordering these clauses changes nothing about which papers come back
 * and everything about whether a stored run still matches the query that produced it, so each
 * provider emits its clauses in the order the original hand-written query used.
 */
function identityPubmed(scope: SearchScope): string {
  const clauses = [
    `"${scope.canonicalName}"[Title/Abstract]`,
    ...(scope.meshTerm ? [`"${scope.meshTerm}"[MeSH Terms]`] : []),
    ...present([scope.abbreviation, scope.iupacName, ...(scope.searchAlsoFor ?? [])]).map(
      (term) => `"${term}"[Title/Abstract]`,
    ),
    ...(scope.casNumber ? [`"${scope.casNumber}"[RN]`] : []),
  ];
  return `(${clauses.join(" OR ")})`;
}

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

function identityEurope(scope: SearchScope): string {
  return europeAny(
    present([scope.canonicalName, scope.iupacName, scope.casNumber, scope.abbreviation, ...(scope.searchAlsoFor ?? [])]),
  );
}

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

// The domain half of every query, which is shared across compounds: it is the same
// reproductive literature whichever compound is being looked for.
function pubmedQueries(scope: SearchScope): Record<LiteraturePurposeName, string> {
  const identity = identityPubmed(scope);
  return {
    SYSTEMATIC_REVIEWS: `${identity} AND ${REPRODUCTIVE_PUBMED} AND ${REVIEW_PUBMED}`,
    HUMAN_REPRODUCTIVE: `${identity} AND ${REPRODUCTIVE_PUBMED} AND humans[MeSH Terms] NOT ${REVIEW_PUBMED}`,
    CONTRADICTORY_OR_NULL: `${identity} AND ${REPRODUCTIVE_PUBMED} AND ${NULL_PUBMED}`,
  };
}

function europeQueries(scope: SearchScope): Record<LiteraturePurposeName, string> {
  const identity = identityEurope(scope);
  return {
    SYSTEMATIC_REVIEWS: `${identity} AND ${REPRODUCTIVE_EUROPE} AND ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
    HUMAN_REPRODUCTIVE: `${identity} AND ${REPRODUCTIVE_EUROPE} AND ${HUMAN_EUROPE} AND NOT ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
    CONTRADICTORY_OR_NULL: `${identity} AND ${REPRODUCTIVE_EUROPE} AND ${NULL_EUROPE} AND ${EUROPE_SOURCE}`,
  };
}

export type BuiltLiteratureQuery = {
  version: string;
  purpose: LiteraturePurposeName;
  provider: LiteratureProviderName;
  query: string;
};

export function buildScopeQuery(
  scope: SearchScope,
  purpose: LiteraturePurposeName,
  provider: LiteratureProviderName,
): BuiltLiteratureQuery {
  const queries = provider === "PUBMED" ? pubmedQueries(scope) : europeQueries(scope);
  return {
    version: scope.queryVersion,
    purpose,
    provider,
    query: queries[purpose],
  };
}

/** The original entry point, kept so the BPA callers and their tests read unchanged. */
export function buildBpaReproductiveQuery(
  purpose: LiteraturePurposeName,
  provider: LiteratureProviderName,
): BuiltLiteratureQuery {
  return buildScopeQuery(BPA_REPRODUCTIVE_SCOPE, purpose, provider);
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

export type CompoundIdentityRecord = {
  slug: string;
  canonicalName: string;
  displayName: string;
  casNumber: string | null;
  aliasNames: string[];
};

/**
 * Refuses to search when the stored compound does not match the identity the query was written
 * against. A query naming a CAS number or an IUPAC name the record does not carry would return
 * papers filed under a compound that is not quite the one searched for, and nothing downstream
 * would notice. Only the fields a scope declares are checked, so a scope with no abbreviation
 * is not required to invent one.
 */
export function assertScopeMatchesRecord(scope: SearchScope, compound: CompoundIdentityRecord): void {
  if (compound.slug !== scope.slug) {
    throw new Error(`This search is scoped to ${scope.slug}, not ${compound.slug}.`);
  }
  if (compound.canonicalName !== scope.canonicalName) {
    throw new Error(`The ${scope.slug} record's name does not match the versioned query identity.`);
  }
  if (scope.casNumber && compound.casNumber !== scope.casNumber) {
    throw new Error(`The ${scope.slug} record's CAS number does not match the versioned query identity.`);
  }
  if (scope.abbreviation && compound.displayName !== scope.abbreviation) {
    throw new Error(`The ${scope.slug} abbreviation used by the query is not the stored display name.`);
  }
  if (scope.iupacName && !compound.aliasNames.includes(scope.iupacName)) {
    throw new Error(`The ${scope.slug} IUPAC alias required by the query is not stored.`);
  }
  // searchAlsoFor is deliberately not checked here. Those phrases are how the literature is
  // found, not an assertion that they name this compound.
}

/** The original entry point, kept so the BPA caller and its tests read unchanged. */
export function assertBpaReproductiveTarget(compound: CompoundIdentityRecord): void {
  assertScopeMatchesRecord(BPA_REPRODUCTIVE_SCOPE, compound);
}
