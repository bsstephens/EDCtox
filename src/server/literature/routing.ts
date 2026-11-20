import {
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
};

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
export function matchCompound(name: string, records: readonly CompoundRecord[]): CompoundRecord | null {
  const cas = CAS.exec(name)?.[0];
  if (cas) {
    const byCas = records.find((record) => record.casNumber === cas);
    if (byCas) return byCas;
  }
  const target = normalise(name);
  if (!target) return null;
  for (const record of records) {
    const names = [record.displayName, record.canonicalName, record.slug, ...record.aliases];
    if (names.some((candidate) => normalise(candidate) === target)) return record;
  }
  // A MeSH-style plural heading, "Bisphenol A Compounds", names the same substance.
  const stripped = normaliseSubstance(name);
  for (const record of records) {
    const names = [record.displayName, record.canonicalName, ...record.aliases];
    if (names.some((candidate) => normaliseSubstance(candidate) === stripped)) return record;
  }
  return null;
}

/** Domains the indexing and the profile between them put this paper in, with the reason for each. */
export function domainsFor(
  profile: { outcomesReported: readonly string[] },
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

  return { domains, outcomeCodes, unmapped };
}

export function routeProfile(input: {
  profile: { compoundsStudied: readonly string[]; outcomesReported: readonly string[]; measuresOutcome: boolean | null };
  facts: ProviderFacts;
  compounds: readonly CompoundRecord[];
  ontology: { outcomeNames: ReadonlyMap<string, string>; mechanismNames: ReadonlyMap<string, string> };
}): RoutingResult {
  const matched: CompoundRecord[] = [];
  const unmatchedCompounds: string[] = [];
  for (const name of input.profile.compoundsStudied) {
    const record = matchCompound(name, input.compounds);
    if (record) {
      if (!matched.some((existing) => existing.slug === record.slug)) matched.push(record);
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
