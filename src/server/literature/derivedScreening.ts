import {
  type ScreeningConfidenceName,
  type ScreeningDecisionName,
  type ScreeningReasonName,
} from "../screening/reasons";
import { type ProviderFacts } from "./providerFacts";
import { type RoutingResult } from "./routing";

/**
 * Turn a routed paper into screening decisions, deterministically.
 *
 * This is the point of docs/SCREENING_REDESIGN.md. Screening stops being a question asked once
 * per compound and domain and becomes a consequence of two things already known: what the paper
 * is about, read once in layer 1, and what the provider says about it, which cost nothing.
 *
 * Every decision here is a machine decision. Nothing in this file may write a curator column,
 * and a curator decision already recorded always wins: the writer leaves it untouched.
 */

export type DerivedDecision = {
  compoundSlug: string;
  domain: string;
  decision: ScreeningDecisionName;
  reason: ScreeningReasonName;
  confidence: ScreeningConfidenceName;
  rationale: string;
};

/**
 * Reasons that disqualify a paper whatever it is about, so they are decided once and applied to
 * every context. A retraction or an editorial is a property of the document.
 */
function documentLevelExclusion(facts: ProviderFacts): { reason: ScreeningReasonName; rationale: string } | null {
  if (facts.retracted) {
    return { reason: "RETRACTED", rationale: "The provider has indexed this publication as retracted." };
  }
  if (facts.notAStudy === true) {
    return {
      reason: "COMMENTARY_OR_EDITORIAL",
      rationale: `Indexed as ${facts.descriptors.length > 0 ? "a non-study publication type" : "commentary or an editorial"}, so it reports no findings of its own.`,
    };
  }
  if (facts.narrativeReview === true) {
    return {
      reason: "NARRATIVE_REVIEW_ONLY",
      rationale:
        "The provider indexes this as a review and not as a systematic review or meta-analysis, so it summarises others' work without a stated method.",
    };
  }
  return null;
}

/**
 * What kind of evidence this is, when it is being included.
 *
 * Only the provider's own indexing decides this. An abstract that mentions people is not a human
 * study, which is the inference the keyword rules made and got wrong repeatedly.
 */
function inclusionReason(facts: ProviderFacts): { reason: ScreeningReasonName; confidence: ScreeningConfidenceName; why: string } {
  if (facts.evidenceSynthesis === "META_ANALYSIS") {
    return { reason: "META_ANALYSIS", confidence: "HIGH", why: "indexed as a meta-analysis" };
  }
  if (facts.evidenceSynthesis === "SYSTEMATIC_REVIEW") {
    return { reason: "SYSTEMATIC_REVIEW", confidence: "HIGH", why: "indexed as a systematic review" };
  }
  if (facts.randomisedTrial === true) {
    return { reason: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH", why: "indexed as a controlled trial" };
  }
  if (facts.humans === true) {
    return { reason: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH", why: "indexed for humans" };
  }
  if (facts.animals === true && facts.humans === false) {
    return {
      reason: "DIRECT_EXPERIMENTAL_EVIDENCE",
      confidence: "HIGH",
      why: "indexed for animals and not for humans",
    };
  }
  // Unindexed, or indexed for neither. The paper routed on its own words alone, which is a
  // weaker basis and is recorded as such rather than dressed up.
  return {
    reason: "MECHANISTIC_RELEVANCE",
    confidence: facts.indexed ? "MODERATE" : "LOW",
    why: facts.indexed ? "indexed, but for neither humans nor animals" : "not indexed, so read from the abstract alone",
  };
}

export function deriveDecisions(input: {
  routing: RoutingResult;
  facts: ProviderFacts;
  /** Compounds the paper names that matched no record. Reported, never turned into a decision. */
}): DerivedDecision[] {
  const { routing, facts } = input;

  // A paper that measures exposure and reports no outcome is excluded wherever it would have
  // routed. Routing already emits no contexts for it, so this is recorded against the compounds
  // it named rather than invented against none.
  if (routing.exposureOnly) return [];

  const exclusion = documentLevelExclusion(facts);
  if (exclusion) {
    return routing.contexts.map((context) => ({
      compoundSlug: context.compoundSlug,
      domain: context.domain,
      decision: "EXCLUDE" as const,
      reason: exclusion.reason,
      confidence: "HIGH",
      rationale: exclusion.rationale,
    }));
  }

  const inclusion = inclusionReason(facts);
  return routing.contexts.map((context) => ({
    compoundSlug: context.compoundSlug,
    domain: context.domain,
    decision: "INCLUDE" as const,
    reason: inclusion.reason,
    confidence: inclusion.confidence,
    rationale: `Routed to ${context.domain} because it is ${context.evidence.join(", ")}, and ${inclusion.why}.`,
  }));
}
