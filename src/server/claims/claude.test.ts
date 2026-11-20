import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { type ClaimPaper } from "./apply";
import {
  CLAUDE_CLAIM_PROMPT_VERSION,
  ClaudeClaimError,
  buildClaimRequest,
  createClaudeExtractor,
  parseClaims,
  transcriptCompletion,
  unionPasses,
  type ClaimTranscript,
} from "./claude";
import { catalogFromRows } from "./extract";

const catalog = catalogFromRows([
  { id: "m-aromatase", code: "AROMATASE_CYP19A1", scorePolicy: "SCORABLE" },
  { id: "m-parent", code: "REP_STEROIDOGENESIS", scorePolicy: "GROUPING_ONLY" },
  { id: "m-atp", code: "ATP_PRODUCTION", scorePolicy: "SCORABLE" },
]);

const abstract =
  "Exposure to bisphenol A reduced aromatase expression in human granulosa cells. " +
  "Cell viability was unchanged at the same concentrations. " +
  "We propose that this contributes to impaired steroidogenesis.";

const paper: ClaimPaper = { evidenceSourceId: "src-1", title: "BPA and granulosa cells", abstractText: abstract };

function claim(overrides: Record<string, unknown> = {}) {
  return {
    relation: "DECREASES_EXPRESSION",
    objectType: "ENZYME",
    objectText: "aromatase",
    objectHead: "aromatase",
    directness: "STRONGLY_SUPPORTED",
    confidence: "HIGH",
    quotedSupport: "Exposure to bisphenol A reduced aromatase expression in human granulosa cells.",
    rationale: "The abstract reports a measured reduction in aromatase expression.",
    speciesText: "human",
    tissueText: "",
    cellTypeText: "granulosa cells",
    doseText: "",
    ...overrides,
  };
}

const byName: Record<string, string> = { aromatase: "AROMATASE_CYP19A1", steroidogenesis: "REP_STEROIDOGENESIS", atp: "ATP_PRODUCTION" };
const mechanismCodeFor = (objectText: string) => byName[objectText.toLowerCase()] ?? null;

function parse(claims: unknown[]) {
  return parseClaims({ claims }, { paper, compoundName: "bisphenol A", catalog, mechanismCodeFor });
}

test("a paper with no abstract yields no request rather than a guess", () => {
  assert.throws(() => buildClaimRequest({ ...paper, abstractText: null }, "bisphenol A"), ClaudeClaimError);
});

test("the prompt carries the compound and the abstract and nothing about scores", () => {
  const request = buildClaimRequest(paper, "bisphenol A");
  assert.match(request.user, /Compound: bisphenol A/);
  assert.match(request.user, /reduced aromatase expression/);
  assert.doesNotMatch(request.system, /score|\+4|toxicity rank/i);
  assert.match(request.system, /candidate list for a curator/);
});

test("the prompt teaches every directness level with an example", () => {
  // The first real run graded 50 of 52 claims STRONGLY_SUPPORTED, because the rule was one
  // sentence with one example in it. Each level now carries a worked example, and the two
  // overrides that stop a confident-sounding review sentence reading as a measurement.
  const { system } = buildClaimRequest(paper, "bisphenol A");
  for (const level of ["STRONGLY_SUPPORTED", "CONSISTENT_WITH", "INFERRED", "HYPOTHESIZED"]) {
    const line = system.split("\n").find((row) => row.includes(`- ${level}:`));
    assert.ok(line, `${level} needs its own line in the prompt`);
    assert.ok(line.includes('"'), `${level} needs a quoted example, not just a definition`);
  }
  assert.match(system, /DIRECTLY_DEMONSTRATED: not available from an abstract/);
  assert.match(system, /take the lower one/);
  assert.match(system, /review, then any sentence that is not a result these authors measured/);
});

test("a claim whose quotation is not in the abstract is dropped", () => {
  // A quotation that cannot be found is the clearest signal that a reading was invented, so it
  // is checked here rather than asked for and trusted.
  const result = parse([
    claim(),
    claim({ objectText: "oestrogen receptor", objectHead: "oestrogen receptor", quotedSupport: "BPA activated the oestrogen receptor." }),
  ]);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0]?.objectText, "aromatase");
  assert.deepEqual(result.dropped, [
    { objectText: "oestrogen receptor", why: "the quoted sentence is not in the abstract" },
  ]);
});

test("an abstract can never support a direct demonstration", () => {
  // Full text is where a demonstration can be checked, and this stage never sees it.
  const result = parse([claim({ directness: "DIRECTLY_DEMONSTRATED" })]);
  assert.equal(result.drafts[0]?.machineDirectness, "STRONGLY_SUPPORTED");
});

test("mapping reuses the existing guards rather than trusting the match", () => {
  const mapped = parse([claim()]);
  assert.equal(mapped.drafts[0]?.mechanismCode, "AROMATASE_CYP19A1");
  assert.equal(mapped.drafts[0]?.machineMappingState, "CANDIDATE");

  // A grouping-only parent is a display node and is refused as a claim target.
  const grouping = parse([
    claim({ objectText: "steroidogenesis", objectHead: "steroidogenesis", quotedSupport: "We propose that this contributes to impaired steroidogenesis." }),
  ]);
  assert.equal(grouping.drafts[0]?.mechanismCode, null);
  assert.equal(grouping.drafts[0]?.machineMappingState, "UNMAPPED");

  // An object the ontology does not hold stays unmapped rather than being forced onto a neighbour.
  const unknown = parse([claim({ objectText: "cell viability", objectHead: "cell viability", quotedSupport: "Cell viability was unchanged at the same concentrations." })]);
  assert.equal(unknown.drafts[0]?.mechanismCode, null);
});

test("no field length can lose a paper's claims", () => {
  // Two pilot runs lost a paper's whole answer to one overlong field, because the response is a
  // single structured object. The columns behind these fields are Postgres text, so the limits
  // that caused it corresponded to nothing. Long values now survive; labels are trimmed.
  const long = "ovarian granulosa cells ".repeat(30);
  const result = parse([claim({ tissueText: long, rationale: long, quotedSupport: abstract })]);
  assert.equal(result.drafts.length, 1);
  const draft = result.drafts[0];
  assert.equal(draft?.tissueText?.length, 240);
  assert.ok(draft?.tissueText?.endsWith("\u2026"));
  // A rationale is prose, not a label, and is kept whole.
  assert.ok((draft?.machineRationale.length ?? 0) > 240);
  // A field within the limit is untouched.
  assert.equal(parse([claim()]).drafts[0]?.cellTypeText, "granulosa cells");
});

test("a qualified phrase maps on its head, and the verbatim text is kept", () => {
  // Across four runs the model named one finding three ways, from "ERa immunoreactive neurons
  // in the BST, Arc, VMH and MeA of female mice" down to "ERa immunoreactive neurons". None of
  // those is in the ontology; the head is.
  const result = parse([claim({ objectText: "aromatase expression in human granulosa cells" })]);
  const draft = result.drafts[0];
  assert.equal(draft?.mechanismCode, "AROMATASE_CYP19A1");
  assert.equal(draft?.objectText, "aromatase expression in human granulosa cells");

  // A head the ontology does not hold leaves the claim unmapped rather than falling back to a
  // qualifier that happens to match something.
  const unmapped = parse([
    claim({ objectText: "aromatase expression in human granulosa cells", objectHead: "granulosa cells" }),
  ]);
  assert.equal(unmapped.drafts[0]?.mechanismCode, null);
});

test("a reported absence of effect is kept, not dropped", () => {
  const result = parse([
    claim({
      relation: "NO_EFFECT",
      objectText: "cell viability",
      objectHead: "cell viability",
      quotedSupport: "Cell viability was unchanged at the same concentrations.",
    }),
  ]);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0]?.relation, "NO_EFFECT");
});

test("an answer outside the vocabulary is an error, never a partial list", () => {
  assert.throws(() => parse([claim({ relation: "CAUSES_CANCER" })]), ClaudeClaimError);
  assert.throws(() => parse([claim({ quotedSupport: "" })]), ClaudeClaimError);
  // An empty list is a valid answer and a common one.
  assert.deepEqual(parse([]).drafts, []);
});

test("a transcript replays only for the prompt it was recorded against", async () => {
  const request = buildClaimRequest(paper, "bisphenol A");
  const extractor = createClaudeExtractor({
    completion: transcriptCompletion({
      promptVersion: CLAUDE_CLAIM_PROMPT_VERSION,
      entries: {
        "src-1": { title: paper.title, promptSha256: request.promptSha256, model: "test", response: { claims: [claim()] } },
      },
    } satisfies ClaimTranscript),
    compoundNameFor: () => "bisphenol A",
    mechanismCodeFor,
  });
  const drafts = await extractor(paper, catalog);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.subjectText, "bisphenol A");

  const stale = createClaudeExtractor({
    completion: transcriptCompletion({
      promptVersion: CLAUDE_CLAIM_PROMPT_VERSION,
      entries: { "src-1": { title: paper.title, promptSha256: "stale", model: "test", response: { claims: [] } } },
    }),
    compoundNameFor: () => "bisphenol A",
    mechanismCodeFor,
  });
  await assert.rejects(stale(paper, catalog), ClaudeClaimError);
});

test("every claim lands unverified and touches no curator column", () => {
  const result = parse([claim()]);
  const draft = result.drafts[0];
  assert.ok(draft);
  assert.equal("curatorVerified" in draft, false);
  assert.equal("curatorDirectness" in draft, false);
  const source = readFileSync(join(import.meta.dirname, "claude.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
    .join("\n");
  for (const forbidden of ["curatorVerified", "curatorDirectness", "effectScore", "MechanismAssessment"]) {
    assert.ok(!code.includes(forbidden), `claude.ts must not touch ${forbidden}`);
  }
});

test("the same relationship read twice is one claim", () => {
  // The first real run returned one gene expression change seven times from a single panel.
  // The prompt asks for one claim per distinct relationship; this enforces it.
  const result = parse([claim(), claim(), claim({ relation: "INCREASES_EXPRESSION" })]);
  assert.equal(result.drafts.length, 2);
  assert.equal(result.dropped.filter((row) => row.why.includes("already read")).length, 1);
});

test("two passes keep the union, and a claim only one pass found needs review", () => {
  const both = { ...claim(), objectHead: "aromatase" } as never;
  const onlyFirst = { ...claim({ relation: "INCREASES_LEVEL" }), objectHead: "estradiol" } as never;
  const { drafts, agreement } = unionPasses([
    parse([both, onlyFirst]).drafts,
    parse([both]).drafts,
  ]);
  assert.equal(drafts.length, 2);
  assert.equal(agreement.get("DECREASES_EXPRESSION|aromatase"), 2);
  assert.equal(agreement.get("INCREASES_LEVEL|estradiol"), 1);

  const agreed = drafts.find((d) => d.objectHead === "aromatase");
  const single = drafts.find((d) => d.objectHead === "estradiol");
  // The mapped, twice-seen claim keeps the lighter queue; the once-seen one does not.
  assert.equal(agreed?.reviewPriority, "REVIEW_RECOMMENDED");
  assert.equal(single?.reviewPriority, "REVIEW_REQUIRED");
  // The model's own confidence is untouched either way: agreement is a different question.
  assert.equal(single?.machineConfidence, "HIGH");
});

test("the union collapses two phrasings of one relationship", () => {
  // This is why the union keys on the head. Across runs the model wrote the same finding as
  // "aromatase", "aromatase expression in human granulosa cells" and worse; keyed on the
  // verbatim text those would be three claims for a curator to reconcile by hand.
  const short = parse([claim()]).drafts;
  const long = parse([claim({ objectText: "aromatase expression in human granulosa cells" })]).drafts;
  const { drafts, agreement } = unionPasses([short, long]);
  assert.equal(drafts.length, 1);
  assert.equal(agreement.get("DECREASES_EXPRESSION|aromatase"), 2);
  // The phrasing kept is the first pass's, and it is the one a curator reads.
  assert.equal(drafts[0]?.objectText, "aromatase");
  assert.equal(drafts[0]?.reviewPriority, "REVIEW_RECOMMENDED");
});

test("a single pass is left exactly as it was", () => {
  const drafts = parse([claim()]).drafts;
  const { drafts: unioned, agreement } = unionPasses([drafts]);
  assert.deepEqual(unioned, drafts);
  assert.equal(agreement.get("DECREASES_EXPRESSION|aromatase"), 1);
});

test("one sentence read two ways is one claim; one sentence with two findings stays two", () => {
  // The model copied the whole phrase into objectHead on the very case the prompt teaches, so
  // the union needs a fallback that does not depend on the model having stripped it.
  const quote = "Exposure to bisphenol A reduced aromatase expression in human granulosa cells.";
  const stripped = parse([claim({ objectHead: "aromatase", quotedSupport: quote })]).drafts;
  const notStripped = parse([
    claim({
      relation: "DECREASES_LEVEL",
      objectText: "aromatase expression in human granulosa cells",
      objectHead: "aromatase expression in human granulosa cells",
      quotedSupport: quote,
    }),
  ]).drafts;
  const { drafts } = unionPasses([stripped, notStripped]);
  assert.equal(drafts.length, 1, "same sentence, same direction, one name inside the other");
  assert.equal(drafts[0]?.objectText, "aromatase");

  // Two entities in one sentence are two findings: neither name contains the other.
  const two = parse([
    claim({ relation: "DECREASES_LEVEL", objectText: "estradiol", objectHead: "estradiol", quotedSupport: quote }),
    claim({ relation: "DECREASES_LEVEL", objectText: "progesterone", objectHead: "progesterone", quotedSupport: quote }),
  ]).drafts;
  assert.equal(unionPasses([two, two]).drafts.length, 2);

  // A sign flip on the same sentence is a disagreement, not a duplicate: both are kept so a
  // curator sees the conflict rather than whichever pass happened to run first.
  const up = parse([claim({ relation: "INCREASES_EXPRESSION", quotedSupport: quote })]).drafts;
  assert.equal(unionPasses([stripped, up]).drafts.length, 2);
});

test("a pass that fails does not lose the paper, and a paper with no answer still fails", async () => {
  // Three of six pilot runs lost a whole paper because one claim in one pass carried a relation
  // outside the vocabulary. The enum stays; the loss does not.
  const request = buildClaimRequest(paper, "bisphenol A");
  const failures: number[] = [];
  let asked = 0;
  const extractor = createClaudeExtractor({
    completion: (_request, pass) => {
      asked += 1;
      return pass === 0
        ? Promise.reject(new ClaudeClaimError("relation outside the vocabulary"))
        : Promise.resolve({ claims: [{ ...claim(), objectHead: "aromatase" }] });
    },
    compoundNameFor: () => "bisphenol A",
    mechanismCodeFor,
    passes: 2,
    onPassFailed: (_paper, pass) => failures.push(pass),
  });
  const drafts = await extractor(paper, catalog);
  assert.equal(asked, 2);
  assert.deepEqual(failures, [0]);
  assert.equal(drafts.length, 1);
  // One pass answered, so it is not treated as a disputed claim.
  assert.equal(drafts[0]?.reviewPriority, "REVIEW_RECOMMENDED");
  assert.ok(request.promptSha256);

  const allFail = createClaudeExtractor({
    completion: () => Promise.reject(new ClaudeClaimError("relation outside the vocabulary")),
    compoundNameFor: () => "bisphenol A",
    mechanismCodeFor,
    passes: 2,
  });
  await assert.rejects(allFail(paper, catalog), /relation outside the vocabulary/);
});
