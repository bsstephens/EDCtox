import { type ProviderMetadata } from "./dedup";

/**
 * Layer 0 of `docs/SCREENING_REDESIGN.md`: what the provider states, turned into facts, with no
 * model and no guessing.
 *
 * The keyword screener was inferring most of this from titles, which is where it went wrong on
 * bisphenol S and on narrative reviews. PubMed has already said it. Nothing here reads the
 * abstract, nothing here is a judgement, and every field can be null, which means the provider
 * did not say rather than that the answer is no.
 */

export type ProviderFacts = {
  /** False when the record carries no MeSH indexing. Every mesh-derived field below is then null. */
  indexed: boolean;
  /** Publication type says this is a systematic review or meta-analysis. */
  evidenceSynthesis: "META_ANALYSIS" | "SYSTEMATIC_REVIEW" | null;
  /** A review that is not a systematic review or meta-analysis, which screening excludes by default. */
  narrativeReview: boolean | null;
  randomisedTrial: boolean | null;
  /** Comment, editorial, letter, or news. Not a study. */
  notAStudy: boolean | null;
  retracted: boolean;
  /** MeSH species indexing. Null when not indexed. */
  humans: boolean | null;
  animals: boolean | null;
  /** Substance headings, verbatim. The independent check on which compounds a paper is about. */
  substances: string[];
  /** Descriptor headings, verbatim. */
  descriptors: string[];
};

const SYNTHESIS: Record<string, "META_ANALYSIS" | "SYSTEMATIC_REVIEW"> = {
  "meta-analysis": "META_ANALYSIS",
  "systematic review": "SYSTEMATIC_REVIEW",
};

const NOT_A_STUDY = new Set([
  "comment",
  "editorial",
  "letter",
  "news",
  "published erratum",
  "retraction of publication",
  "biography",
  "historical article",
]);

const TRIAL = new Set(["randomized controlled trial", "controlled clinical trial", "clinical trial"]);

export function providerFacts(metadata: ProviderMetadata): ProviderFacts {
  const types = new Set(metadata.publicationTypes);
  const indexed = metadata.meshDescriptors.length > 0;
  const descriptors = new Set(metadata.meshDescriptors);

  let evidenceSynthesis: ProviderFacts["evidenceSynthesis"] = null;
  for (const [type, value] of Object.entries(SYNTHESIS)) {
    // Meta-analysis wins over systematic review when a paper is indexed as both, because it is
    // the more specific claim about what the paper did.
    if (types.has(type) && (value === "META_ANALYSIS" || evidenceSynthesis === null)) {
      evidenceSynthesis = value;
    }
  }

  // "Review" alone is a narrative review. With a synthesis type beside it, it is not.
  const narrativeReview = types.size === 0 ? null : types.has("review") && evidenceSynthesis === null;

  return {
    indexed,
    evidenceSynthesis,
    narrativeReview,
    randomisedTrial: types.size === 0 ? null : [...TRIAL].some((type) => types.has(type)),
    notAStudy: types.size === 0 ? null : [...NOT_A_STUDY].some((type) => types.has(type)),
    retracted: types.has("retracted publication"),
    humans: indexed ? descriptors.has("Humans") : null,
    animals: indexed ? descriptors.has("Animals") : null,
    substances: metadata.meshSubstances,
    descriptors: metadata.meshDescriptors,
  };
}

/**
 * The `EvidenceType` the provider's own publication type supports, or null to leave the stored
 * value alone. Deliberately conservative: it returns a synthesis type or a trial, and never
 * guesses between in vitro, cellular, animal and human observational, because publication type
 * does not distinguish those. Species indexing narrows an unclassified study no further than
 * "animal", and only when the record says animals and not humans.
 */
export type ProviderEvidenceType = "META_ANALYSIS" | "SYSTEMATIC_REVIEW" | "RANDOMIZED_TRIAL" | "ANIMAL";

export function evidenceTypeFromProvider(facts: ProviderFacts): ProviderEvidenceType | null {
  if (facts.evidenceSynthesis) return facts.evidenceSynthesis;
  if (facts.randomisedTrial) return "RANDOMIZED_TRIAL";
  if (facts.indexed && facts.animals === true && facts.humans === false) return "ANIMAL";
  return null;
}

/** Normalises a MeSH substance heading for comparison with a compound name or alias. */
export function normaliseSubstance(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+compounds?$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Whether the provider's substance headings support this paper being about this compound.
 *
 * Returns null when the record is not indexed, which is the common case for recent papers and
 * must not be read as disagreement. A false is a real flag: the indexer listed chemicals and
 * none of them matched, which is how "bisphenol S paper filed under BPA" gets caught.
 */
export function substancesSupport(facts: ProviderFacts, names: readonly string[]): boolean | null {
  if (facts.substances.length === 0) return null;
  const headings = facts.substances.map(normaliseSubstance);
  return names.some((name) => {
    const target = normaliseSubstance(name);
    if (!target) return false;
    return headings.some((heading) => heading === target || heading.includes(target) || target.includes(heading));
  });
}
