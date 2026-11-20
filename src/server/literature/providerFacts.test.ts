import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { EMPTY_PROVIDER_METADATA } from "./dedup";
import { parsePubmedArticles } from "./parsePubmed";
import {
  evidenceTypeFromProvider,
  normaliseSubstance,
  providerFacts,
  substancesSupport,
} from "./providerFacts";

const fixture = readFileSync(join(import.meta.dirname, "fixtures/pubmed-efetch-mesh.xml"), "utf8");
const papers = parsePubmedArticles(fixture);
const byPmid = new Map(papers.map((paper) => [paper.pmid, paper]));

test("the parser keeps the publication types and MeSH headings it used to discard", () => {
  assert.equal(papers.length, 4);
  for (const paper of papers) {
    assert.ok(paper.provider.publicationTypes.length > 0, `${paper.pmid} has publication types`);
    assert.ok(paper.provider.indexedAt, `${paper.pmid} has a provider date`);
    // Lowercased for comparison, and deduplicated.
    for (const type of paper.provider.publicationTypes) assert.equal(type, type.toLowerCase());
    assert.equal(
      new Set(paper.provider.publicationTypes).size,
      paper.provider.publicationTypes.length,
    );
  }
  // Three of these four real records carry MeSH indexing and one does not, which is the split
  // the design has to survive rather than an accident of the fixture.
  const indexed = papers.filter((paper) => paper.provider.meshDescriptors.length > 0);
  assert.equal(indexed.length, 3);
});

test("a meta-analysis is read from the provider, not from the title", () => {
  // 41354316 is indexed as both Review and Meta-Analysis. Meta-analysis is the more specific
  // claim about what the paper did, so it wins, and the paper is not a narrative review.
  const paper = byPmid.get("41354316");
  assert.ok(paper);
  const facts = providerFacts(paper.provider);
  assert.equal(facts.evidenceSynthesis, "META_ANALYSIS");
  assert.equal(facts.narrativeReview, false);
  assert.equal(evidenceTypeFromProvider(facts), "META_ANALYSIS");
});

test("species indexing answers human versus animal without reading the abstract", () => {
  for (const paper of papers) {
    const facts = providerFacts(paper.provider);
    if (!facts.indexed) {
      assert.equal(facts.humans, null, `${paper.pmid} is unindexed, so species is unknown`);
      continue;
    }
    assert.equal(typeof facts.humans, "boolean");
    assert.equal(typeof facts.animals, "boolean");
  }
  // One is indexed with both Humans and Animals, which the keyword rules had no way to tell.
  const both = papers
    .map((paper) => providerFacts(paper.provider))
    .find((facts) => facts.humans === true && facts.animals === true);
  assert.ok(both, "a fixture paper is indexed for both humans and animals");
});

test("a real unindexed record yields nulls, never a false", () => {
  // PMID 39195676 is in the fixture and carries no MeSH heading list. "Not indexed" must not
  // read as "indexed and not a review": that is the difference between no evidence and evidence
  // of absence, and it is the mistake the keyword rules made.
  const unindexed = byPmid.get("39195676");
  assert.ok(unindexed);
  const live = providerFacts(unindexed.provider);
  assert.equal(live.indexed, false);
  assert.equal(live.humans, null);
  assert.equal(live.animals, null);
  assert.equal(substancesSupport(live, ["Bisphenol A"]), null);
  // The publication type is still known, because that is stated separately from the indexing.
  assert.equal(live.narrativeReview, false);

  const facts = providerFacts(EMPTY_PROVIDER_METADATA);
  assert.equal(facts.indexed, false);
  assert.equal(facts.humans, null);
  assert.equal(facts.animals, null);
  assert.equal(facts.narrativeReview, null);
  assert.equal(facts.notAStudy, null);
  assert.equal(facts.evidenceSynthesis, null);
  assert.equal(evidenceTypeFromProvider(facts), null);
});

test("substance headings separate the bisphenols the keyword rules kept merging", () => {
  const bpa = papers.find((paper) =>
    paper.provider.meshSubstances.some((value) => /bisphenol a/i.test(value)),
  );
  assert.ok(bpa, "a fixture paper carries a bisphenol A substance heading");
  const facts = providerFacts(bpa.provider);
  assert.equal(substancesSupport(facts, ["Bisphenol A", "BPA"]), true);
  // A compound the indexer did not list is not supported, which is the flag that catches a
  // bisphenol S paper filed under BPA.
  assert.equal(substancesSupport(facts, ["Rotenone"]), false);
  // No headings at all is unknown, not disagreement.
  assert.equal(substancesSupport(providerFacts(EMPTY_PROVIDER_METADATA), ["Bisphenol A"]), null);
});

test("substance normalisation drops the MeSH plural form", () => {
  assert.equal(normaliseSubstance("Bisphenol A Compounds"), "bisphenol a");
  assert.equal(normaliseSubstance("Phthalic Acids"), "phthalic acids");
  assert.equal(normaliseSubstance("4,4'-isopropylidenediphenol"), "4 4 isopropylidenediphenol");
});

test("the provider never upgrades a paper into evidence", () => {
  // Layer 0 may set what kind of document this is. It may not decide that the document counts,
  // and nothing in it touches a score. Guarding the rule, not the implementation.
  const source = readFileSync(join(import.meta.dirname, "applyCandidates.ts"), "utf8");
  assert.match(source, /countsAsScientificEvidence: false/);
  assert.doesNotMatch(source, /countsAsScientificEvidence: true/);
  const facts = readFileSync(join(import.meta.dirname, "providerFacts.ts"), "utf8");
  assert.doesNotMatch(facts, /effectScore|curator|assessment/i);
});

test("a role heading is not a compound claim", () => {
  // The first real run flagged a review that named bisphenol A, phthalates and flame retardants
  // while MeSH carried only "Endocrine Disruptors". The model was more specific than the indexer,
  // not in conflict with it, so headings that name a role rather than a chemical yield unknown.
  const roleOnly = providerFacts({
    publicationTypes: ["journal article"],
    meshDescriptors: ["Humans", "Female"],
    meshSubstances: ["Endocrine Disruptors", "Environmental Pollutants"],
    indexedAt: "2011-01-01",
  });
  assert.equal(substancesSupport(roleOnly, ["Bisphenol A", "phthalates"]), null);
  // One specific heading beside the role labels makes the check meaningful again.
  const withSpecific = providerFacts({
    publicationTypes: ["journal article"],
    meshDescriptors: ["Humans"],
    meshSubstances: ["Endocrine Disruptors", "Bisphenol A Compounds"],
    indexedAt: "2011-01-01",
  });
  assert.equal(substancesSupport(withSpecific, ["Bisphenol A"]), true);
  assert.equal(substancesSupport(withSpecific, ["Rotenone"]), false);
});
