export const LITERATURE_QUERY_VERSION = "bpa-reproductive-v1";
export const LITERATURE_RESULT_CAP = 15;
export const PUBMED_SORT = "pub_date";
export const EUROPE_PMC_SORT = "P_PDATE_D desc";

export const LITERATURE_PROVIDERS = ["PUBMED", "EUROPE_PMC"] as const;
export const LITERATURE_PURPOSES = [
  "SYSTEMATIC_REVIEWS",
  "HUMAN_REPRODUCTIVE",
  "CONTRADICTORY_OR_NULL",
] as const;

export type LiteratureProviderName = (typeof LITERATURE_PROVIDERS)[number];
export type LiteraturePurposeName = (typeof LITERATURE_PURPOSES)[number];

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

const IDENTITY_EUROPE =
  '("Bisphenol A" OR "BPA" OR "4,4\'-(propane-2,2-diyl)diphenol" OR "80-05-7")';

const REPRODUCTIVE_EUROPE =
  "(reproduction OR reproductive OR fertility OR infertility OR ovary OR ovarian OR sperm OR semen OR testosterone OR estradiol OR steroidogenesis)";

const REVIEW_EUROPE = '("systematic review" OR "meta-analysis")';

const NULL_EUROPE =
  '("no association" OR "not associated" OR "no significant association" OR "no effect" OR "null finding")';

const EUROPE_SOURCE = "(SRC:MED OR SRC:PMC)";

const PUBMED_QUERIES: Record<LiteraturePurposeName, string> = {
  SYSTEMATIC_REVIEWS: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND ${REVIEW_PUBMED}`,
  HUMAN_REPRODUCTIVE: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND humans[MeSH Terms] NOT ${REVIEW_PUBMED}`,
  CONTRADICTORY_OR_NULL: `${IDENTITY_PUBMED} AND ${REPRODUCTIVE_PUBMED} AND ${NULL_PUBMED}`,
};

const EUROPE_QUERIES: Record<LiteraturePurposeName, string> = {
  SYSTEMATIC_REVIEWS: `${IDENTITY_EUROPE} AND ${REPRODUCTIVE_EUROPE} AND ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
  HUMAN_REPRODUCTIVE: `${IDENTITY_EUROPE} AND ${REPRODUCTIVE_EUROPE} AND (human OR humans) AND NOT ${REVIEW_EUROPE} AND ${EUROPE_SOURCE}`,
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
