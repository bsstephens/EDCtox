import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { EMPTY_PROVIDER_METADATA } from "./dedup";
import { deriveDecisions } from "./derivedScreening";
import { providerFacts } from "./providerFacts";
import { type RoutingResult } from "./routing";

function facts(types: string[], descriptors: string[] = [], substances: string[] = []) {
  return providerFacts({
    publicationTypes: types,
    meshDescriptors: descriptors,
    meshSubstances: substances,
    indexedAt: descriptors.length > 0 ? "2025-01-01" : null,
  });
}

function routed(overrides: Partial<RoutingResult> = {}): RoutingResult {
  return {
    contexts: [{ compoundSlug: "bpa", domain: "REP", evidence: ['indexed under "Spermatozoa"'], outcomeCodes: [] }],
    unmatchedCompounds: [],
    unmatchedClasses: [],
    unmappedTerms: [],
    exposureOnly: false,
    ...overrides,
  };
}

test("a retracted paper is excluded in every context it would have routed to", () => {
  const result = deriveDecisions({
    routing: routed({
      contexts: [
        { compoundSlug: "bpa", domain: "REP", evidence: ["x"], outcomeCodes: [] },
        { compoundSlug: "bpa", domain: "MET", evidence: ["y"], outcomeCodes: [] },
      ],
    }),
    facts: facts(["journal article", "retracted publication"], ["Humans"]),
  });
  assert.equal(result.length, 2);
  assert.ok(result.every((row) => row.decision === "EXCLUDE" && row.reason === "RETRACTED"));
});

test("a narrative review is excluded, and a systematic review is not", () => {
  const narrative = deriveDecisions({ routing: routed(), facts: facts(["journal article", "review"], ["Humans"]) });
  assert.equal(narrative[0]?.decision, "EXCLUDE");
  assert.equal(narrative[0]?.reason, "NARRATIVE_REVIEW_ONLY");

  // The same "review" type beside a synthesis type is not a narrative review. This is the
  // distinction the keyword rules could not make and that the provider states outright.
  const systematic = deriveDecisions({
    routing: routed(),
    facts: facts(["journal article", "review", "systematic review"], ["Humans"]),
  });
  assert.equal(systematic[0]?.decision, "INCLUDE");
  assert.equal(systematic[0]?.reason, "SYSTEMATIC_REVIEW");
});

test("an exposure-only paper produces no decision at all", () => {
  const result = deriveDecisions({
    routing: routed({ contexts: [], exposureOnly: true }),
    facts: facts(["journal article"], ["Humans"]),
  });
  assert.deepEqual(result, []);
});

test("the evidence kind comes from the indexing, never from the abstract", () => {
  const human = deriveDecisions({ routing: routed(), facts: facts(["journal article"], ["Humans", "Adult"]) });
  assert.equal(human[0]?.reason, "DIRECT_HUMAN_EVIDENCE");
  assert.equal(human[0]?.confidence, "HIGH");

  const animal = deriveDecisions({ routing: routed(), facts: facts(["journal article"], ["Animals", "Rats"]) });
  assert.equal(animal[0]?.reason, "DIRECT_EXPERIMENTAL_EVIDENCE");

  // Unindexed: included on the profile alone, and the confidence says so rather than pretending.
  const unindexed = deriveDecisions({ routing: routed(), facts: providerFacts(EMPTY_PROVIDER_METADATA) });
  assert.equal(unindexed[0]?.decision, "INCLUDE");
  assert.equal(unindexed[0]?.reason, "MECHANISTIC_RELEVANCE");
  assert.equal(unindexed[0]?.confidence, "LOW");
});

test("a rationale says what routed it and on what basis", () => {
  const result = deriveDecisions({
    routing: routed({
      contexts: [{ compoundSlug: "bpa", domain: "REP", evidence: ['indexed under "Spermatozoa"'], outcomeCodes: [] }],
    }),
    facts: facts(["journal article"], ["Humans", "Spermatozoa"]),
  });
  assert.match(result[0]?.rationale ?? "", /Spermatozoa/);
  assert.match(result[0]?.rationale ?? "", /indexed for humans/);
});

test("nothing here can write a curator column", () => {
  // Guarding the rule. A derived decision is a machine decision; a curator's judgement is not
  // this module's to make, overwrite, or reason about.
  const source = readFileSync(join(import.meta.dirname, "derivedScreening.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
    .join("\n");
  for (const forbidden of ["curatorDecision", "curatorReasonCode", "curatorNotes", "screenedBy", "effectScore"]) {
    assert.ok(!code.includes(forbidden), `derivedScreening.ts must not touch ${forbidden}`);
  }
});

test("a decision names the domain by its short label, not a workflow word", () => {
  // The screening desk once keyed on a lowercase workflow name while routing used the ontology's
  // short label, so the same context existed twice under two spellings. One vocabulary now.
  const result = deriveDecisions({
    routing: routed({
      contexts: [
        { compoundSlug: "bpa", domain: "REP", evidence: ["x"], outcomeCodes: [] },
        { compoundSlug: "bpa", domain: "THY", evidence: ["y"], outcomeCodes: [] },
      ],
    }),
    facts: facts(["journal article"], ["Humans"]),
  });
  for (const row of result) {
    assert.match(row.domain, /^[A-Z]+$/, `${row.domain} should be a domain short label`);
  }
});

test("a publication claiming a systematic method is not excluded as a narrative review", () => {
  // MEDLINE only added a systematic-review publication type in 2019 and still indexes recent
  // systematic reviews as plain reviews. Two of the 90 stored papers are exactly this: a 2024
  // systematic review and meta-analysis of 18 studies, and a 2025 systematic review of 14. Both
  // were being thrown away, which is the worst loss this pipeline can make.
  const indexedAsReview = facts(["journal article", "review"], ["Humans"]);

  const claimed = deriveDecisions({
    routing: routed(),
    facts: indexedAsReview,
    profile: { evidenceSynthesis: "SYSTEMATIC_REVIEW" },
  });
  assert.equal(claimed[0]?.decision, "INCLUDE");
  assert.equal(claimed[0]?.reason, "SYSTEMATIC_REVIEW");
  // Moderate, not high: the publication and the indexer disagree and that is recorded, not hidden.
  assert.equal(claimed[0]?.confidence, "MODERATE");
  assert.match(claimed[0]?.rationale ?? "", /indexed only as a review/);

  const pooled = deriveDecisions({
    routing: routed(),
    facts: indexedAsReview,
    profile: { evidenceSynthesis: "META_ANALYSIS" },
  });
  assert.equal(pooled[0]?.reason, "META_ANALYSIS");

  // A publication that agrees it is narrative is still excluded.
  const narrative = deriveDecisions({
    routing: routed(),
    facts: indexedAsReview,
    profile: { evidenceSynthesis: "NARRATIVE_REVIEW" },
  });
  assert.equal(narrative[0]?.decision, "EXCLUDE");
  assert.equal(narrative[0]?.reason, "NARRATIVE_REVIEW_ONLY");
});

test("the override runs one way only", () => {
  // The publication's own account may rescue it from exclusion. It may not push it out: a paper
  // the indexer treats as primary research is not excluded because the model called it a review.
  const primary = facts(["journal article"], ["Humans"]);
  const result = deriveDecisions({
    routing: routed(),
    facts: primary,
    profile: { evidenceSynthesis: "NARRATIVE_REVIEW" },
  });
  assert.equal(result[0]?.decision, "INCLUDE");
});

test("a paper routed on the model alone cannot be a high-confidence include", () => {
  // Nothing corroborates where it belongs, so the stored confidence says so however firmly the
  // publication type reads.
  const onModel = deriveDecisions({
    routing: routed({
      contexts: [
        {
          compoundSlug: "bpa",
          domain: "REP",
          evidence: ["the publication reports it, and the record is not indexed"],
          outcomeCodes: [],
        },
      ],
    }),
    facts: facts(["journal article", "meta-analysis"]),
    profile: { evidenceSynthesis: "META_ANALYSIS" },
  });
  assert.equal(onModel[0]?.decision, "INCLUDE");
  assert.equal(onModel[0]?.reason, "META_ANALYSIS");
  assert.equal(onModel[0]?.confidence, "MODERATE");
});
