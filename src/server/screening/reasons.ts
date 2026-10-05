export const SCREENING_DECISIONS = ["INCLUDE", "EXCLUDE", "UNCERTAIN"] as const;
export type ScreeningDecisionName = (typeof SCREENING_DECISIONS)[number];

export const SCREENING_REASONS = [
  "DIRECT_HUMAN_EVIDENCE",
  "DIRECT_EXPERIMENTAL_EVIDENCE",
  "SYSTEMATIC_REVIEW",
  "META_ANALYSIS",
  "REGULATORY_REVIEW",
  "MECHANISTIC_RELEVANCE",
  "DEVELOPMENTAL_RELEVANCE",
  "REPRODUCTIVE_RELEVANCE",
  "WRONG_COMPOUND",
  "WRONG_BISPHENOL",
  "WRONG_DOMAIN",
  "EXPOSURE_ONLY",
  "ANIMAL_ONLY",
  "IN_VITRO_ONLY",
  "MIXED_OR_UNCLEAR",
  "COMMENTARY_OR_EDITORIAL",
  "NARRATIVE_REVIEW_ONLY",
  "METHOD_ONLY",
  "NON_RELEVANT_OUTCOME",
  "IRRELEVANT_KEYWORD_MATCH",
  "DUPLICATE_PUBLICATION",
  "RETRACTED",
  "FULL_TEXT_NEEDED",
  "OTHER",
] as const;
export type ScreeningReasonName = (typeof SCREENING_REASONS)[number];

export const SCREENING_CONFIDENCE = ["LOW", "MODERATE", "HIGH"] as const;
export type ScreeningConfidenceName = (typeof SCREENING_CONFIDENCE)[number];

export const SCREENING_PURPOSES = ["SYSTEMATIC_REVIEWS", "HUMAN_REPRODUCTIVE", "CONTRADICTORY_OR_NULL"] as const;
export type ScreeningPurposeName = (typeof SCREENING_PURPOSES)[number];

export const SCREENING_DOMAIN = "reproductive";
export const SCREENING_QUERY_VERSION = "bpa-reproductive-v2";
export const SCREENING_PROMPT_VERSION = "bpa-reproductive-screen-v1";
export const SCREENING_PROVIDER = "deterministic";
export const SCREENING_MODEL = "bpa-reproductive-screen-v1";

const INCLUDE_REASONS: ScreeningReasonName[] = [
  "DIRECT_HUMAN_EVIDENCE",
  "DIRECT_EXPERIMENTAL_EVIDENCE",
  "SYSTEMATIC_REVIEW",
  "META_ANALYSIS",
  "REGULATORY_REVIEW",
  "MECHANISTIC_RELEVANCE",
  "DEVELOPMENTAL_RELEVANCE",
  "REPRODUCTIVE_RELEVANCE",
];

const EXCLUDE_REASONS: ScreeningReasonName[] = [
  "WRONG_COMPOUND",
  "WRONG_BISPHENOL",
  "WRONG_DOMAIN",
  "EXPOSURE_ONLY",
  "COMMENTARY_OR_EDITORIAL",
  "NARRATIVE_REVIEW_ONLY",
  "METHOD_ONLY",
  "NON_RELEVANT_OUTCOME",
  "IRRELEVANT_KEYWORD_MATCH",
  "DUPLICATE_PUBLICATION",
  "RETRACTED",
  "OTHER",
];

const UNCERTAIN_REASONS: ScreeningReasonName[] = ["FULL_TEXT_NEEDED", "MIXED_OR_UNCLEAR", "OTHER"];

export function reasonsForDecision(
  decision: ScreeningDecisionName,
  purpose: ScreeningPurposeName | null,
): ScreeningReasonName[] {
  if (decision === "INCLUDE") return INCLUDE_REASONS;
  if (decision === "UNCERTAIN") return UNCERTAIN_REASONS;
  const reasons = [...EXCLUDE_REASONS];
  if (purpose === "HUMAN_REPRODUCTIVE") {
    reasons.splice(4, 0, "ANIMAL_ONLY", "IN_VITRO_ONLY");
  }
  return reasons;
}

export function reasonAllowed(
  decision: ScreeningDecisionName,
  reason: ScreeningReasonName,
  purpose: ScreeningPurposeName | null,
): boolean {
  return reasonsForDecision(decision, purpose).includes(reason);
}
