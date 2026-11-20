import {
  CLASS_TERM_PLACEHOLDER,
  MESH_DOMAIN,
  MESH_NOT_A_DOMAIN,
  MESH_OUTCOME,
} from "../../data/seeds/meshCrosswalk";
import { normaliseSubstance, type ProviderFacts } from "./providerFacts";

/**
 * Layer 2 of docs/SCREENING_REDESIGN.md: derive the contexts a paper belongs to from the profile
 * that was already read, with no model call.
 *
 * This is the property that makes the redesign worth doing. Adding a compound re-runs routing
 * over stored profiles for nothing; no paper is read a second time. Routing is pure: it takes a
 * profile, provider facts and the ontology, and returns contexts and unmatched terms. It writes
 * nothing and it decides nothing about evidence.
 */

export type CompoundRecord = {
  slug: string;
  displayName: string;
  canonicalName: string;
  casNumber: string | null;
  aliases: string[];
  /** SPECIFIC_COMPOUND, CLASS_PLACEHOLDER, REPRESENTATIVE_STAND_IN or FORMULATION. */
  recordKind: string;
};

/**
 * What one name the paper used resolved to.
 *
 * "class-without-record" is deliberately not the same as "none". The first says this database
 * has nowhere to put a recognised chemical class; the second says a name was not recognised at
 * all. They call for different responses, so routing keeps them apart.
 */
export type CompoundMatch =
  | { kind: "specific"; record: CompoundRecord }
  | { kind: "class"; record: CompoundRecord }
  | { kind: "class-without-record"; term: string }
  | { kind: "none" };

export type RoutedContext = {
  compoundSlug: string;
  domain: string;
  /** Why this context was emitted, in terms a reader can check against the paper. */
  evidence: string[];
  /** Outcome codes the indexing supports, where the outcome carries no direction of its own. */
  outcomeCodes: string[];
};

export type RoutingResult = {
  contexts: RoutedContext[];
  /** Compounds the paper names that no record matched. Candidates for a new compound record. */
  unmatchedCompounds: string[];
  /** Recognised chemical classes with no placeholder record. A different gap from the above. */
  unmatchedClasses: string[];
  /** Indexed terms that are neither a known domain nor a known non-domain. Ontology gap signal. */
  unmappedTerms: string[];
  /** Set when the paper measures exposure and reports no outcome, so it routes nowhere. */
  exposureOnly: boolean;
};

const CAS = /\b\d{2,7}-\d{2}-\d\b/;

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Match one name the paper used against the compound records.
 *
 * Exact on a normalised name or alias, or on a registry number the paper quoted. Deliberately not
 * fuzzy: "bisphenol S" must not match "bisphenol A", and a substring rule would do exactly that.
 * A name that matches nothing is returned as unmatched rather than forced onto the nearest record.
 */
export function matchCompound(name: string, records: readonly CompoundRecord[]): CompoundMatch {
  const target = normalise(name);

  // A class term resolves to a placeholder or to nothing. It never reaches a specific compound,
  // however close the names look, because a paper about phthalates is not a paper about DEHP.
  if (target in CLASS_TERM_PLACEHOLDER) {
    const slug = CLASS_TERM_PLACEHOLDER[target];
    if (!slug) return { kind: "class-without-record", term: name };
    const record = records.find((candidate) => candidate.slug === slug);
    return record ? { kind: "class", record } : { kind: "class-without-record", term: name };
  }

  const cas = CAS.exec(name)?.[0];
  if (cas) {
    const byCas = records.find((record) => record.casNumber === cas);
    if (byCas) return { kind: "specific", record: byCas };
  }
  if (!target) return { kind: "none" };

  for (const record of records) {
    const names = [record.displayName, record.canonicalName, record.slug, ...record.aliases];
    if (names.some((candidate) => normalise(candidate) === target)) {
      return { kind: record.recordKind === "CLASS_PLACEHOLDER" ? "class" : "specific", record };
    }
  }
  // A MeSH-style plural heading, "Bisphenol A Compounds", names the same substance.
  const stripped = normaliseSubstance(name);
  for (const record of records) {
    const names = [record.displayName, record.canonicalName, ...record.aliases];
    if (names.some((candidate) => normaliseSubstance(candidate) === stripped)) {
      return { kind: record.recordKind === "CLASS_PLACEHOLDER" ? "class" : "specific", record };
    }
  }
  return { kind: "none" };
}

/** Domains the indexing and the profile between them put this paper in, with the reason for each. */
export function domainsFor(
  profile: { outcomesReported: readonly string[]; domainsBorneOn?: readonly string[] },
  facts: ProviderFacts,
  ontology: { outcomeNames: ReadonlyMap<string, string>; mechanismNames: ReadonlyMap<string, string> },
): { domains: Map<string, string[]>; outcomeCodes: Map<string, string[]>; unmapped: string[] } {
  const domains = new Map<string, string[]>();
  const outcomeCodes = new Map<string, string[]>();
  const unmapped: string[] = [];

  const add = (domain: string, why: string) => {
    const reasons = domains.get(domain) ?? [];
    if (!reasons.includes(why)) reasons.push(why);
    domains.set(domain, reasons);
  };

  // MeSH indexes a chemical in both the descriptor list and the substance list, so a compound
  // name arrives here as well. Compound identity is matched separately and must not be reported
  // as a missing domain concept, or the real gaps drown in chemical names.
  const chemicals = new Set(facts.substances);

  // Controlled vocabulary first. A descriptor is an indexer's judgement, which is a firmer basis
  // than a phrase lifted from an abstract.
  for (const descriptor of facts.descriptors) {
    const domain = MESH_DOMAIN[descriptor];
    if (domain) {
      add(domain, `indexed under "${descriptor}"`);
      const outcome = MESH_OUTCOME[descriptor];
      if (outcome) {
        const codes = outcomeCodes.get(domain) ?? [];
        if (!codes.includes(outcome)) codes.push(outcome);
        outcomeCodes.set(domain, codes);
      }
      continue;
    }
    if (chemicals.has(descriptor)) continue;
    if (!MESH_NOT_A_DOMAIN.has(descriptor)) unmapped.push(descriptor);
  }

  // Then the paper's own words, matched exactly against names the ontology already holds. A
  // phrase that matches nothing is not a gap: abstracts phrase things freely, and treating every
  // unmatched phrase as a missing concept would bury the real gaps the descriptors surface.
  for (const reported of profile.outcomesReported) {
    const key = normalise(reported);
    const outcomeDomain = ontology.outcomeNames.get(key);
    if (outcomeDomain) {
      add(outcomeDomain, `reports "${reported}"`);
      continue;
    }
    const mechanismDomain = ontology.mechanismNames.get(key);
    if (mechanismDomain) add(mechanismDomain, `reports "${reported}"`);
  }

  // The provider's indexing is the firmer basis and is used wherever it decided anything. Where
  // it decided nothing, either because the record is not indexed yet or because its descriptors
  // name no biology, fall back to the model's own reading. Recent papers are routinely
  // unindexed, which is exactly when a database like this most wants them.
  //
  // The fallback is marked in the reason, so a reader and the confidence calculation can both
  // tell a provider-backed route from a model-backed one.
  if (domains.size === 0) {
    for (const domain of profile.domainsBorneOn ?? []) {
      add(domain, "the publication reports it, and the record is not indexed");
    }
  }

  return { domains, outcomeCodes, unmapped };
}

/** True when every domain on this result came from the model rather than the provider. */
export function routedOnModelAlone(contexts: readonly RoutedContext[]): boolean {
  return (
    contexts.length > 0 &&
    contexts.every((context) => context.evidence.every((why) => why.startsWith("the publication reports it")))
  );
}

export function routeProfile(input: {
  profile: {
    compoundsStudied: readonly string[];
    outcomesReported: readonly string[];
    measuresOutcome: boolean | null;
    domainsBorneOn?: readonly string[];
  };
  facts: ProviderFacts;
  compounds: readonly CompoundRecord[];
  ontology: { outcomeNames: ReadonlyMap<string, string>; mechanismNames: ReadonlyMap<string, string> };
}): RoutingResult {
  const matched: CompoundRecord[] = [];
  const unmatchedCompounds: string[] = [];
  const unmatchedClasses: string[] = [];
  for (const name of input.profile.compoundsStudied) {
    const match = matchCompound(name, input.compounds);
    if (match.kind === "specific" || match.kind === "class") {
      if (!matched.some((existing) => existing.slug === match.record.slug)) matched.push(match.record);
    } else if (match.kind === "class-without-record") {
      unmatchedClasses.push(match.term);
    } else {
      unmatchedCompounds.push(name);
    }
  }

  const { domains, outcomeCodes, unmapped } = domainsFor(input.profile, input.facts, input.ontology);

  // A paper that measures exposure and reports no outcome routes nowhere, however many compounds
  // it names. That is the EXPOSURE_ONLY exclusion, reached without asking a model.
  const exposureOnly = input.profile.measuresOutcome === false;

  const contexts: RoutedContext[] = exposureOnly
    ? []
    : matched.flatMap((record) =>
        [...domains.entries()].map(([domain, evidence]) => ({
          compoundSlug: record.slug,
          domain,
          evidence,
          outcomeCodes: outcomeCodes.get(domain) ?? [],
        })),
      );

  return {
    contexts,
    unmatchedCompounds,
    unmatchedClasses,
    unmappedTerms: [...new Set(unmapped)].sort(),
    exposureOnly,
  };
}

/** Builds the exact-match lookups routing needs from the stored ontology. */
export function buildOntologyIndex(input: {
  outcomes: ReadonlyArray<{ name: string; category: string }>;
  mechanisms: ReadonlyArray<{ name: string; domainShortLabel: string }>;
  outcomeCategoryToDomain: Readonly<Record<string, string>>;
}): { outcomeNames: Map<string, string>; mechanismNames: Map<string, string> } {
  const outcomeNames = new Map<string, string>();
  for (const outcome of input.outcomes) {
    const domain = input.outcomeCategoryToDomain[outcome.category];
    if (domain) outcomeNames.set(normalise(outcome.name), domain);
  }
  const mechanismNames = new Map<string, string>();
  for (const mechanism of input.mechanisms) {
    mechanismNames.set(normalise(mechanism.name), mechanism.domainShortLabel);
  }
  return { outcomeNames, mechanismNames };
}

/** Outcome categories to the profile domain they belong under. */
export const OUTCOME_CATEGORY_DOMAIN: Record<string, string> = {
  REPRODUCTIVE: "REP",
  DEVELOPMENTAL: "DEV",
  NEURODEVELOPMENTAL: "DEV",
  NEUROENDOCRINE: "NEUROENDO",
  THYROID: "THY",
  IMMUNE: "IMM",
  METABOLIC: "MET",
  MITOCHONDRIAL: "MITO",
  REDOX: "REDOX",
  VASCULAR: "VASCULAR",
  GASTROINTESTINAL: "EXPOSURE",
  // Cancer outcomes are recorded without a domain of their own, by design. A cancer routes
  // through the mechanism that bears on it, never through a cancer column, because there is none.
};
