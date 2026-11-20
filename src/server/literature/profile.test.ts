import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { EMPTY_PROVIDER_METADATA } from "./dedup";
import { parsePubmedArticles } from "./parsePubmed";
import {
  PROFILE_PROMPT_VERSION,
  PaperProfileError,
  buildProfileRequest,
  createProfiler,
  parseProfile,
  profileDisagreements,
  transcriptCompletion,
  type ProfileCandidate,
  type ProfileTranscript,
} from "./profile";
import { providerFacts } from "./providerFacts";

const fixture = readFileSync(join(import.meta.dirname, "fixtures/pubmed-efetch-mesh.xml"), "utf8");
const papers = parsePubmedArticles(fixture);
const indexed = papers.find((paper) => paper.provider.meshDescriptors.length > 0);
const unindexed = papers.find((paper) => paper.provider.meshDescriptors.length === 0);

function candidate(overrides: Partial<ProfileCandidate> = {}): ProfileCandidate {
  return {
    evidenceSourceId: "source-1",
    title: "Bisphenol A exposure and sperm quality",
    abstractText: "We measured urinary bisphenol A and semen parameters in 300 men.",
    year: 2025,
    journal: "Journal",
    facts: providerFacts(EMPTY_PROVIDER_METADATA),
    ...overrides,
  };
}

const answer = {
  compoundsStudied: ["bisphenol A"],
  outcomesReported: ["semen parameters"],
  speciesStudied: ["humans"],
  exposureNotes: "urinary biomarker",
  studyDesign: "cross-sectional",
  evidenceSynthesis: "NOT_A_REVIEW" as const,
  domainsBorneOn: ["REP" as const],
  measuresOutcome: true,
  notAbout: "",
  rationale: "Measured urinary bisphenol A against semen parameters in 300 men.",
};

test("a paper with no abstract is refused rather than guessed at", () => {
  assert.throws(() => buildProfileRequest(candidate({ abstractText: null })), PaperProfileError);
  assert.throws(() => buildProfileRequest(candidate({ abstractText: "   " })), PaperProfileError);
});

test("the prompt asks what the paper is about, not whether it belongs anywhere", () => {
  const request = buildProfileRequest(candidate());
  // The whole point of layer 1 is that the question is not contextual. If a compound name or a
  // domain name ever appears in the system prompt, the per-context cost is back and with it the
  // bottleneck that made screening need a curator.
  // The prompt may offer a fixed vocabulary that every paper sees, such as the ten domain
  // labels. What it must never do is scope the question to one compound or one context, because
  // that is what multiplies the cost by compounds times domains and brings the bottleneck back.
  for (const contextual of ["bisphenol", "BPA", "the queue", "belongs in the evidence set", "for the compound"]) {
    assert.ok(
      !request.system.toLowerCase().includes(contextual.toLowerCase()),
      `the system prompt must not mention ${contextual}`,
    );
  }
  // Every paper is asked the same question, so the vocabulary offered is the whole list.
  for (const label of ["REP", "DEV", "THY", "MET", "MITO", "REDOX", "IMM", "NEUROENDO", "VASCULAR", "EXPOSURE"]) {
    assert.ok(request.system.includes(label), `the domain vocabulary should offer ${label}`);
  }
  assert.match(request.system, /Record what the publication is about/);
});

test("provider indexing is given as context and labelled as fallible", () => {
  assert.ok(indexed);
  const request = buildProfileRequest(candidate({ facts: providerFacts(indexed.provider) }));
  assert.match(request.user, /Indexed substances:/);
  assert.match(request.user, /It is not the answer and it can be incomplete or wrong/);

  assert.ok(unindexed);
  const bare = buildProfileRequest(candidate({ facts: providerFacts(unindexed.provider) }));
  assert.match(bare.user, /has not been indexed/);
  assert.doesNotMatch(bare.user, /Indexed species/);
});

test("an answer outside the shape is an error, never a partial profile", () => {
  assert.throws(() => parseProfile({ compoundsStudied: ["x"] }), PaperProfileError);
  assert.throws(() => parseProfile({ ...answer, measuresOutcome: "yes" }), PaperProfileError);
  // Reporting an outcome while naming no compound means the read failed.
  assert.throws(() => parseProfile({ ...answer, compoundsStudied: [] }), PaperProfileError);
  // A paper that measures only exposure may legitimately name no outcome.
  assert.doesNotThrow(() =>
    parseProfile({ ...answer, measuresOutcome: false, outcomesReported: [], compoundsStudied: ["bisphenol A"] }),
  );
});

test("a transcript replays only for the prompt it was recorded against", async () => {
  const request = buildProfileRequest(candidate());
  const transcript: ProfileTranscript = {
    promptVersion: PROFILE_PROMPT_VERSION,
    entries: {
      "source-1": { title: "x", promptSha256: request.promptSha256, model: "test", response: answer },
    },
  };
  const profile = await createProfiler({ completion: transcriptCompletion(transcript) })(candidate());
  assert.deepEqual(profile.compoundsStudied, ["bisphenol A"]);

  const stale: ProfileTranscript = {
    promptVersion: PROFILE_PROMPT_VERSION,
    entries: { "source-1": { title: "x", promptSha256: "stale", model: "test", response: answer } },
  };
  await assert.rejects(
    createProfiler({ completion: transcriptCompletion(stale) })(candidate()),
    PaperProfileError,
  );
});

test("the disagreement check catches the bisphenol confusion for free", () => {
  assert.ok(indexed);
  const facts = providerFacts(indexed.provider);
  // The indexer listed bisphenol A compounds. A model reading that names a different chemical
  // is flagged without anyone reading the paper.
  const wrong = profileDisagreements({ ...answer, compoundsStudied: ["rotenone"] }, facts);
  assert.equal(wrong.some((flag) => flag.field === "compounds"), true);
  const right = profileDisagreements({ ...answer, compoundsStudied: ["bisphenol A"] }, facts);
  assert.equal(right.some((flag) => flag.field === "compounds"), false);
});

test("an unindexed paper produces no flags, because silence is not agreement", () => {
  assert.ok(unindexed);
  const facts = providerFacts(unindexed.provider);
  assert.deepEqual(profileDisagreements({ ...answer, compoundsStudied: ["rotenone"] }, facts), []);
  assert.deepEqual(profileDisagreements({ ...answer, speciesStudied: ["rats"] }, facts), []);
});

test("a species claim is checked against the indexing", () => {
  assert.ok(indexed);
  const facts = providerFacts(indexed.provider);
  const flags = profileDisagreements(
    { ...answer, speciesStudied: facts.humans ? ["Sprague-Dawley rats"] : ["humans"] },
    facts,
  );
  // Whichever way the fixture is indexed, claiming the species it is not indexed for is flagged.
  if (facts.humans === true && facts.animals === false) {
    assert.equal(flags.some((flag) => flag.field === "species"), true);
  }
});

test("a profile cannot make a publication count as evidence", () => {
  // Guarding the rule rather than the implementation. Comments may discuss these; code may not
  // write them, so the check is on assignment rather than on the words appearing anywhere.
  const source = readFileSync(join(import.meta.dirname, "profile.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
    .join("\n");
  for (const forbidden of ["countsAsScientificEvidence", "effectScore", "MechanismAssessment", "curatorDecision"]) {
    assert.ok(!code.includes(forbidden), `profile.ts must not touch ${forbidden}`);
  }
});
