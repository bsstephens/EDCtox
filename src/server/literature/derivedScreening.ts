import {
  type ScreeningConfidenceName,
  type ScreeningDecisionName,
  type ScreeningReasonName,
} from "../screening/reasons";
import { type ProviderFacts } from "./providerFacts";
import { routedOnModelAlone, type RoutingResult } from "./routing";

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
export type ProfileView = {
  /** What the publication says it did, from layer 1. Null for a profile read before this existed. */
  evidenceSynthesis?: string | null;
  /** What it studied, from layer 1. Empty or absent for a profile read before this existed. */
  speciesStudied?: readonly string[] | null;
};

/**
 * Enough to recognise a plant, fungal or bacterial study. Deliberately a word list and not a
 * taxonomy: the only decision it has to make is whether the organism could have the receptors
 * and axes this ontology is built from, and a plant cannot.
 */
const NON_ANIMAL_WORDS = [
  "plant",
  "plants",
  "seedling",
  "seedlings",
  "crop",
  "crops",
  "weed",
  "weeds",
  "algae",
  "alga",
  "cyanobacteria",
  "bacteria",
  "bacterium",
  "fungus",
  "fungi",
  "yeast",
  "arabidopsis",
  "hordeum",
  "barley",
  "maize",
  "soybean",
  "soya",
  "wheat",
  "rice",
  "lemna",
  "duckweed",
  "chlorella",
  "e coli",
  "escherichia",
] as const;

function isNonAnimal(species: string): boolean {
  const text = ` ${species.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  return NON_ANIMAL_WORDS.some((word) => text.includes(` ${word} `));
}

/**
 * True when every organism the paper names is a plant, fungus or microbe.
 *
 * Every, not any: a study that exposes both barley and rats is still a rat study and must not be
 * thrown away. A paper that names no species at all is not judged here either -- an in-vitro
 * human cell study often names none, and silence is not evidence of a plant.
 */
export function studiesOnlyNonAnimals(species: readonly string[] | null | undefined): boolean {
  if (!species || species.length === 0) return false;
  return species.every((item) => isNonAnimal(item));
}

function documentLevelExclusion(
  facts: ProviderFacts,
  profile: ProfileView,
): { reason: ScreeningReasonName; rationale: string } | null {
  if (facts.retracted) {
    return { reason: "RETRACTED", rationale: "The provider has indexed this publication as retracted." };
  }
  if (facts.notAStudy === true) {
    return {
      reason: "COMMENTARY_OR_EDITORIAL",
      rationale: `Indexed as ${facts.descriptors.length > 0 ? "a non-study publication type" : "commentary or an editorial"}, so it reports no findings of its own.`,
    };
  }
  // Glyphosate is a herbicide, so its literature is full of plant studies, and the relevance
  // gate's domain terms match "reproduction" in a barley paper as readily as in a rat one. One
  // such paper reached claim extraction and produced claims about the seed yield of fast-growing
  // plants. The profiler already recorded the species; nothing downstream was reading it.
  if (studiesOnlyNonAnimals(profile.speciesStudied)) {
    return {
      reason: "NON_ANIMAL_MODEL",
      rationale: `The only organisms studied are ${(profile.speciesStudied ?? []).join(", ")}, which have none of the receptors or axes this ontology holds.`,
    };
  }
  if (facts.narrativeReview === true) {
    // The indexing is incomplete here in a known way. MEDLINE only introduced a systematic-review
    // publication type in 2019 and still indexes recent systematic reviews as plain reviews, so a
    // publication that states a systematic method is not contradicted by the absence of that type.
    //
    // The two errors are not equal. Excluding a systematic review loses the best evidence this
    // database can hold, permanently and silently. Including a narrative review costs one
    // extraction call and is caught downstream, where a claim from a review is recorded as
    // inferred rather than demonstrated. So on disagreement, do not exclude.
    if (profile.evidenceSynthesis === "SYSTEMATIC_REVIEW" || profile.evidenceSynthesis === "META_ANALYSIS") {
      return null;
    }
    return {
      reason: "NARRATIVE_REVIEW_ONLY",
      rationale:
        "The provider indexes this as a review and not as a systematic review or meta-analysis, and the publication does not claim a systematic method either.",
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
function inclusionReason(
  facts: ProviderFacts,
  profile: ProfileView,
): { reason: ScreeningReasonName; confidence: ScreeningConfidenceName; why: string } {
  // The publication claims a systematic method the indexing does not record. Included on the
  // publication's own account, at moderate confidence, with the disagreement stated.
  if (
    facts.narrativeReview === true &&
    (profile.evidenceSynthesis === "SYSTEMATIC_REVIEW" || profile.evidenceSynthesis === "META_ANALYSIS")
  ) {
    return {
      reason: profile.evidenceSynthesis === "META_ANALYSIS" ? "META_ANALYSIS" : "SYSTEMATIC_REVIEW",
      confidence: "MODERATE",
      why: "the publication states a systematic method that the provider has indexed only as a review",
    };
  }
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
  profile?: ProfileView;
}): DerivedDecision[] {
  const { routing, facts } = input;
  const profile: ProfileView = input.profile ?? {};

  // A paper that measures exposure and reports no outcome is excluded wherever it would have
  // routed. Routing already emits no contexts for it, so this is recorded against the compounds
  // it named rather than invented against none.
  if (routing.exposureOnly) return [];

  const exclusion = documentLevelExclusion(facts, profile);
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

  const inclusion = inclusionReason(facts, profile);
  // A paper routed on the model's reading alone has no independent corroboration of where it
  // belongs, so it cannot be a high-confidence include however the publication type reads.
  const onModelAlone = routedOnModelAlone(routing.contexts);
  const confidence = onModelAlone && inclusion.confidence === "HIGH" ? "MODERATE" : inclusion.confidence;
  return routing.contexts.map((context) => ({
    compoundSlug: context.compoundSlug,
    domain: context.domain,
    decision: "INCLUDE" as const,
    reason: inclusion.reason,
    confidence,
    rationale: `Routed to ${context.domain} because ${context.evidence.join(", ")}, and ${inclusion.why}.`,
  }));
}
