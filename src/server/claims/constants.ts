export const CLAIM_DOMAIN = "reproductive";
export const CLAIM_PROVIDER = "deterministic";
export const CLAIM_MODEL = "bpa-claim-abstract-v1";
export const CLAIM_PROMPT_VERSION = "bpa-claim-abstract-v1";
export const CLAIM_TASK = "literature-claim-extraction";

/** Five BPA reproductive papers whose stored abstracts name a specific event. Not the machine-include queue. */
export const CLAIM_PILOT_PMIDS = ["40362320", "40753778", "26361328", "42023145", "27543890"] as const;

export const MITOCHONDRIAL_MECHANISM_CODES = [
  "ETC_COMPLEX_I",
  "ETC_COMPLEX_II",
  "ETC_COMPLEX_III",
  "ETC_COMPLEX_IV",
  "ATP_SYNTHASE",
  "ETC_FLUX",
  "ATP_PRODUCTION",
] as const;

/**
 * The compound-and-domain pairs claim extraction will run for.
 *
 * A pair belongs here when a literature search has actually been run for it and the screener
 * has included papers, which is a deliberate act rather than a consequence of a compound
 * existing in the database. `screeningDomain` is the screening table's code and `CLAIM_DOMAIN`
 * is the claim table's: the two tables still use different vocabularies for the same concept
 * ("REP" against "reproductive"), which is worth tidying one day and is not this change.
 */
export const CLAIM_COHORTS = [
  { compound: "bpa", domain: "reproductive", screeningDomain: "REP", hasPilot: true },
  { compound: "glyphosate", domain: "reproductive", screeningDomain: "REP", hasPilot: false },
] as const;

export type ClaimCohortTarget = (typeof CLAIM_COHORTS)[number];

export function claimCohortFor(compound: string, domain: string): ClaimCohortTarget {
  const found = CLAIM_COHORTS.find((row) => row.compound === compound && row.domain === domain);
  if (!found) {
    const known = CLAIM_COHORTS.map((row) => `${row.compound}/${row.domain}`).join(", ");
    throw new Error(`No claim cohort for ${compound}/${domain}. Known cohorts: ${known}.`);
  }
  return found;
}
