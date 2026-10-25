import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { SuggestionCandidate } from "./applySuggestions";
import {
  buildClaudeScreeningRequest,
  CLAUDE_SCREENING_MODEL,
  CLAUDE_SCREENING_PROMPT_VERSION,
  CLAUDE_SCREENING_PROVENANCE,
  CLAUDE_SCREENING_SYSTEM_PROMPT,
  ClaudeScreeningError,
  createClaudeClient,
  createClaudeSuggestionProvider,
  parseClaudeSuggestion,
  readScreeningTranscript,
  transcriptCompletion,
  type ScreeningTranscript,
} from "./claude";
import { parseScreeningArgs } from "./cli";
import { SCREENING_REASONS } from "./reasons";

const FIXTURE_PATH = "src/server/screening/fixtures/claude-screening.fixture.json";

function candidate(overrides: Partial<SuggestionCandidate> = {}): SuggestionCandidate {
  return {
    evidenceSourceId: "fixture-human-cohort",
    title: "Urinary bisphenol A and semen quality in a fertility clinic cohort",
    abstractText: "Fixture abstract: urinary bisphenol A was measured in men attending a fertility clinic and compared with semen parameters.",
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
    publicationStatus: "SCREENING_PENDING",
    ...overrides,
  };
}

/** The fixture file stores a placeholder hash; the test binds each entry to the prompt it is replayed against. */
function fixtureTranscript(candidates: readonly SuggestionCandidate[]): ScreeningTranscript {
  const transcript = readScreeningTranscript(FIXTURE_PATH);
  for (const item of candidates) {
    const entry = transcript.entries[item.evidenceSourceId];
    if (entry) entry.promptSha256 = buildClaudeScreeningRequest(item).promptSha256;
  }
  return transcript;
}

test("the Claude screening prompt carries the vocabulary and asks for no thought trace", () => {
  assert.equal(CLAUDE_SCREENING_PROMPT_VERSION, "bpa-reproductive-claude-v1");
  assert.equal(CLAUDE_SCREENING_MODEL, "claude-haiku-5-5");
  assert.deepEqual(CLAUDE_SCREENING_PROVENANCE, { provider: "claude", model: CLAUDE_SCREENING_MODEL, promptVersion: CLAUDE_SCREENING_PROMPT_VERSION });
  for (const reason of SCREENING_REASONS) assert.match(CLAUDE_SCREENING_SYSTEM_PROMPT, new RegExp(`- ${reason}: .+`));
  assert.doesNotMatch(CLAUDE_SCREENING_SYSTEM_PROMPT, /think step by step|chain of thought|show your reasoning/i);

  const human = buildClaudeScreeningRequest(candidate());
  assert.match(human.user, /Governing purpose: HUMAN_REPRODUCTIVE/);
  assert.match(human.user, /EXCLUDE: .*ANIMAL_ONLY, IN_VITRO_ONLY/);
  assert.match(human.user, /Title: Urinary bisphenol A/);
  assert.match(human.user, /Fixture abstract/);
  assert.equal(human.system, CLAUDE_SCREENING_SYSTEM_PROMPT);

  const review = buildClaudeScreeningRequest(candidate({ purposes: ["CONTRADICTORY_OR_NULL", "SYSTEMATIC_REVIEWS"], abstractText: null }));
  assert.match(review.user, /Governing purpose: SYSTEMATIC_REVIEWS/);
  assert.match(review.user, /All search purposes: CONTRADICTORY_OR_NULL, SYSTEMATIC_REVIEWS/);
  assert.doesNotMatch(review.user, /EXCLUDE: .*ANIMAL_ONLY/);
  assert.match(review.user, /\(no abstract stored\)/);
  assert.notEqual(review.promptSha256, human.promptSha256);
  assert.equal(buildClaudeScreeningRequest(candidate()).promptSha256, human.promptSha256);
});

test("Claude answers are accepted only inside the screening vocabulary", () => {
  const ok = parseClaudeSuggestion(
    { decision: "INCLUDE", reasonCode: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH", rationale: `  ${"x".repeat(500)}  ` },
    candidate(),
  );
  assert.equal(ok.decision, "INCLUDE");
  assert.equal(ok.searchPurpose, "HUMAN_REPRODUCTIVE");
  assert.equal(ok.rationale.length, 400);
  assert.equal("thought" in ok, false);

  assert.throws(
    () => parseClaudeSuggestion({ decision: "INCLUDE", reasonCode: "ANIMAL_ONLY", confidence: "HIGH", rationale: "r" }, candidate()),
    ClaudeScreeningError,
  );
  assert.throws(
    () =>
      parseClaudeSuggestion(
        { decision: "EXCLUDE", reasonCode: "ANIMAL_ONLY", confidence: "HIGH", rationale: "r" },
        candidate({ purposes: ["SYSTEMATIC_REVIEWS"] }),
      ),
    /not offered/,
  );
  assert.throws(() => parseClaudeSuggestion({ decision: "MAYBE", reasonCode: "OTHER", confidence: "LOW", rationale: "r" }, candidate()), ClaudeScreeningError);
  assert.throws(() => parseClaudeSuggestion("INCLUDE", candidate()), ClaudeScreeningError);
  assert.throws(() => parseClaudeSuggestion({ decision: "INCLUDE", reasonCode: "DIRECT_HUMAN_EVIDENCE", confidence: "LOW", rationale: "   " }, candidate()), /empty rationale/);
});

test("the provider replays a fixture transcript and never reaches the network", async () => {
  const human = candidate();
  const animal = candidate({
    evidenceSourceId: "fixture-animal-on-human-queue",
    title: "Bisphenol A lowers sperm count in adult male mice",
    abstractText: "Fixture abstract: adult male mice.",
  });
  const malformed = candidate({
    evidenceSourceId: "fixture-malformed",
    title: "Bisphenol A migration from canned beverages",
    abstractText: "Fixture abstract: migration.",
  });
  const unknown = candidate({ evidenceSourceId: "fixture-unknown", title: "Not in the transcript" });
  const transcript = fixtureTranscript([human, animal, malformed]);
  const seen: string[] = [];
  const provider = createClaudeSuggestionProvider({
    completion: transcriptCompletion(transcript),
    onAnswer: (request) => seen.push(request.evidenceSourceId),
  });

  const suggestion = await provider(human);
  assert.equal(suggestion.decision, "INCLUDE");
  assert.equal(suggestion.reasonCode, "DIRECT_HUMAN_EVIDENCE");
  assert.equal(suggestion.confidence, "HIGH");
  assert.equal(suggestion.searchPurpose, "HUMAN_REPRODUCTIVE");
  assert.equal(suggestion.rationale.endsWith("asks for."), true);
  assert.deepEqual(seen, ["fixture-human-cohort"]);

  await assert.rejects(() => provider(animal), /INCLUDE with ANIMAL_ONLY/);
  await assert.rejects(() => provider(malformed), ClaudeScreeningError);
  await assert.rejects(() => provider(unknown), /No recorded answer/);
  await assert.rejects(() => provider(candidate({ abstractText: "a different abstract" })), /different prompt/);
  assert.deepEqual(seen, ["fixture-human-cohort"]);

  const raw = readFileSync(FIXTURE_PATH, "utf8");
  assert.equal(raw.includes("sk-ant"), false);
  assert.throws(() => createClaudeClient(undefined), /ANTHROPIC_API_KEY/);
  assert.throws(() => createClaudeClient(""), ClaudeScreeningError);
});

test("the screening command offers the Claude provider in dry run only", () => {
  const base = ["--compound", "bpa", "--domain", "reproductive", "--pending"];
  assert.equal(parseScreeningArgs([...base, "--dry-run"]).provider, "deterministic");
  const claude = parseScreeningArgs([...base, "--dry-run", "--provider", "claude", "--transcript", "t.json"]);
  assert.equal(claude.provider, "claude");
  assert.equal(claude.transcript, "t.json");
  assert.equal(claude.writePrompts, null);
  assert.equal(parseScreeningArgs([...base, "--dry-run", "--provider", "claude", "--write-prompts", "p.json"]).writePrompts, "p.json");
  assert.throws(() => parseScreeningArgs([...base, "--apply-suggestions", "--provider", "claude"]), /dry-run only/);
  assert.throws(() => parseScreeningArgs([...base, "--dry-run", "--provider", "gpt"]), /--provider/);
  assert.throws(() => parseScreeningArgs([...base, "--dry-run", "--transcript", "t.json"]), /--provider claude only/);
  assert.throws(() => parseScreeningArgs([...base, "--dry-run", "--provider", "claude", "--all"]));
});
