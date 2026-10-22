import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { applyLiteratureRun } from "../literature/applyCandidates";
import { planLiteratureHits, type IncomingPaper } from "../literature/dedup";
import { applyMachineSuggestions, deterministicProvider, fixtureSuggestion } from "./applySuggestions";
import { CLAUDE_SCREENING_MODEL, CLAUDE_SCREENING_PROMPT_VERSION, suggestWithClaude, type ScreeningCompletionRequest, type ScreeningTransport } from "./claude";
import { assertLocalDatabase, parseCompareArgs, parseScreeningArgs } from "./cli";
import { cohensKappa, renderComparisonMarkdown, summarizeComparison, type ComparisonRow } from "./compare";
import { ScreeningError, applyCuratorDecision, assertCuratorCommand } from "./curate";
import { suggestDeterministic } from "./deterministic";
import { SCREENING_OUTPUT_SCHEMA, ScreeningProviderError, buildScreeningSystemPrompt, buildScreeningUserPrompt, parseScreeningOutput } from "./prompt";
import { filterScreeningCards, parseScreeningFilters, type ScreeningCard } from "./queue";
import { SCREENING_CONFIDENCE, SCREENING_DECISIONS, SCREENING_REASONS, reasonsForDecision } from "./reasons";
import { selectSuggestionSample, type QueueCandidate } from "./sample";

const WRITE_PATH = [
  "src/server/screening/reasons.ts",
  "src/server/screening/deterministic.ts",
  "src/server/screening/sample.ts",
  "src/server/screening/curate.ts",
  "src/server/screening/applySuggestions.ts",
  "src/server/screening/cli.ts",
  "src/server/screening/queue.ts",
  "src/server/screening/prompt.ts",
  "src/server/screening/claude.ts",
  "src/server/screening/compare.ts",
  "scripts/literature-screen.ts",
  "scripts/literature-screen-compare.ts",
  "src/app/admin/literature/actions.ts",
  "src/app/admin/literature/page.tsx",
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function paper(overrides: Partial<IncomingPaper> = {}): IncomingPaper {
  return {
    doi: "10.1000/screen",
    pmid: "999100001",
    pmcid: null,
    title: "Bisphenol A and semen quality in men",
    authors: "Ada",
    journal: "Journal",
    year: 2021,
    abstractText: "Urinary bisphenol A and semen quality were studied in men.",
    openAccess: null,
    retracted: false,
    url: "https://pubmed.ncbi.nlm.nih.gov/999100001/",
    ...overrides,
  };
}

function candidate(id: string, purpose: QueueCandidate["purposes"][number], year: number, title: string): QueueCandidate {
  return {
    sourceId: id,
    title,
    year,
    purposes: [purpose],
    windows: ["relevance"],
    retracted: false,
    publicationStatus: "SCREENING_PENDING",
    machineDecision: null,
  };
}

test("deterministic screening separates purposes and does not store a thought trace", () => {
  const review = suggestDeterministic({
    title: "Systematic review of bisphenol A and fertility",
    abstractText: "This systematic review covers bisphenol A and fertility in humans and animals.",
    retracted: false,
    purposes: ["SYSTEMATIC_REVIEWS"],
  });
  assert.equal(review.decision, "INCLUDE");
  assert.equal(review.reasonCode, "SYSTEMATIC_REVIEW");

  const animalReview = suggestDeterministic({
    title: "Bisphenol A and sperm count in mice",
    abstractText: "Adult male mice exposed to bisphenol A had lower sperm counts.",
    retracted: false,
    purposes: ["SYSTEMATIC_REVIEWS", "HUMAN_REPRODUCTIVE"],
  });
  assert.equal(animalReview.decision, "INCLUDE");
  assert.equal(animalReview.reasonCode, "DIRECT_EXPERIMENTAL_EVIDENCE");
  assert.equal(animalReview.searchPurpose, "SYSTEMATIC_REVIEWS");

  const animalHumanQueue = suggestDeterministic({
    title: "Bisphenol A and sperm count in mice",
    abstractText: "Adult male mice exposed to bisphenol A had lower sperm counts.",
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
  });
  assert.equal(animalHumanQueue.decision, "EXCLUDE");
  assert.equal(animalHumanQueue.reasonCode, "ANIMAL_ONLY");

  const cells = suggestDeterministic({
    title: "Bisphenol A and granulosa cells",
    abstractText: "In vitro exposure of granulosa cells to bisphenol A altered steroidogenesis.",
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
  });
  assert.equal(cells.reasonCode, "IN_VITRO_ONLY");

  assert.equal(
    suggestDeterministic({
      title: "Bisphenol S and ovarian function",
      abstractText: "Bisphenol S altered ovarian follicles. Bisphenol A was mentioned as context.",
      retracted: false,
      purposes: ["HUMAN_REPRODUCTIVE"],
    }).reasonCode,
    "WRONG_BISPHENOL",
  );
  assert.equal(
    suggestDeterministic({
      title: "Environmental pollutants and testicular toxicity: a narrative review",
      abstractText: "This narrative review discusses bisphenol A, testicular toxicity, and pregnant women.",
      retracted: false,
      purposes: ["HUMAN_REPRODUCTIVE"],
    }).reasonCode,
    "NARRATIVE_REVIEW_ONLY",
  );
  assert.equal(
    suggestDeterministic({
      title: "Bisphenol A migration from canned beverages",
      abstractText: "Bisphenol A migration and estrogenic activity were measured.",
      retracted: false,
      purposes: ["HUMAN_REPRODUCTIVE"],
    }).reasonCode,
    "EXPOSURE_ONLY",
  );
  assert.equal(
    suggestDeterministic({
      title: "Bisphenol A migration from packaging",
      abstractText: "Migration of bisphenol A from food packaging was measured.",
      retracted: false,
      purposes: ["CONTRADICTORY_OR_NULL"],
    }).reasonCode,
    "EXPOSURE_ONLY",
  );
  const missing = suggestDeterministic({
    title: "Bisphenol A exposure",
    abstractText: null,
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
  });
  assert.equal(missing.decision, "UNCERTAIN");
  assert.equal(missing.reasonCode, "FULL_TEXT_NEEDED");
  assert.equal(
    suggestDeterministic({
      title: "Retracted: bisphenol A and fertility",
      abstractText: "Bisphenol A and fertility.",
      retracted: true,
      purposes: ["HUMAN_REPRODUCTIVE"],
    }).reasonCode,
    "RETRACTED",
  );
  const contradictory = suggestDeterministic({
    title: "No association between bisphenol A and semen quality",
    abstractText: "No association between bisphenol A and semen quality was reported in men.",
    retracted: false,
    purposes: ["CONTRADICTORY_OR_NULL"],
  });
  assert.equal(contradictory.decision, "INCLUDE");
  assert.match(contradictory.rationale, /not a confirmed null finding/);
  assert.doesNotMatch(contradictory.rationale, /chain of thought|step 1/i);
  assert.equal("thought" in contradictory, false);
});

test("exclude reasons for animal and in vitro studies are offered only on the human queue", () => {
  assert.equal(reasonsForDecision("EXCLUDE", "HUMAN_REPRODUCTIVE").includes("ANIMAL_ONLY"), true);
  assert.equal(reasonsForDecision("EXCLUDE", "SYSTEMATIC_REVIEWS").includes("ANIMAL_ONLY"), false);
  assert.equal(reasonsForDecision("EXCLUDE", "SYSTEMATIC_REVIEWS").includes("IN_VITRO_ONLY"), false);
  assert.equal(reasonsForDecision("UNCERTAIN", "HUMAN_REPRODUCTIVE").includes("FULL_TEXT_NEEDED"), true);
  assert.throws(
    () =>
      assertCuratorCommand({
        decision: "EXCLUDE",
        reasonCode: null,
        publicationStatus: "SCREENING_PENDING",
        retracted: false,
        purpose: "HUMAN_REPRODUCTIVE",
      }),
    ScreeningError,
  );
  assert.throws(
    () =>
      assertCuratorCommand({
        decision: "INCLUDE",
        reasonCode: null,
        publicationStatus: "RETRACTED",
        retracted: true,
        purpose: "HUMAN_REPRODUCTIVE",
      }),
    /retracted/i,
  );
  assert.throws(
    () =>
      assertCuratorCommand({
        decision: "EXCLUDE",
        reasonCode: "ANIMAL_ONLY",
        publicationStatus: "SCREENING_PENDING",
        retracted: false,
        purpose: "SYSTEMATIC_REVIEWS",
      }),
    /not available/i,
  );
  const uncertain = assertCuratorCommand({
    decision: "UNCERTAIN",
    reasonCode: "FULL_TEXT_NEEDED",
    publicationStatus: "SCREENING_PENDING",
    retracted: false,
    purpose: "HUMAN_REPRODUCTIVE",
  });
  assert.equal(uncertain.curatorReasonCode, "FULL_TEXT_NEEDED");
});

test("suggestion sample is one card per publication and keeps the 5, 8, and 7 mix", () => {
  const reviews = Array.from({ length: 6 }, (_, index) => candidate(`r${index}`, "SYSTEMATIC_REVIEWS", 2010 + index, `Review ${index}`));
  const human = Array.from({ length: 10 }, (_, index) => candidate(`h${index}`, "HUMAN_REPRODUCTIVE", 2000 + index, `Human ${index}`));
  const alreadySuggested = human[9];
  if (!alreadySuggested) throw new Error("missing human sample row");
  alreadySuggested.machineDecision = "INCLUDE";
  const contradictory = Array.from({ length: 8 }, (_, index) => candidate(`c${index}`, "CONTRADICTORY_OR_NULL", 1990 + index, `Null ${index}`));
  const sample = selectSuggestionSample(
    [
      ...reviews,
      ...human,
      ...contradictory,
      { ...candidate("dup", "HUMAN_REPRODUCTIVE", 2024, "Duplicate row"), publicationStatus: "DUPLICATE" },
      { ...candidate("gone", "HUMAN_REPRODUCTIVE", 2024, "Retracted row"), retracted: true },
    ],
    20,
  );
  assert.equal(sample.length, 20);
  assert.equal(sample.filter((row) => row.purposes[0] === "SYSTEMATIC_REVIEWS").length, 5);
  assert.equal(sample.filter((row) => row.purposes[0] === "HUMAN_REPRODUCTIVE").length, 8);
  assert.equal(sample.filter((row) => row.purposes[0] === "CONTRADICTORY_OR_NULL").length, 7);
  assert.equal(sample.some((row) => row.sourceId === "r5"), true);
  assert.equal(sample.some((row) => row.sourceId === "r0"), true);
  assert.equal(sample.some((row) => row.sourceId === "r2"), false);
  assert.equal(sample.some((row) => row.sourceId === "dup" || row.sourceId === "gone"), false);
  assert.equal(sample.some((row) => row.sourceId === alreadySuggested.sourceId && row.machineDecision === "INCLUDE"), true);
});

test("screening command stays on localhost and caps the batch at 20", () => {
  assert.equal(parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--limit", "20", "--dry-run"]).dryRun, true);
  assert.throws(() => parseScreeningArgs(["--all", "--compound", "bpa", "--domain", "reproductive", "--pending", "--dry-run"]));
  assert.throws(() => parseScreeningArgs(["--compound", "dehp", "--domain", "reproductive", "--pending", "--dry-run"]));
  assert.throws(() => parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--limit", "21", "--dry-run"]));
  assert.throws(() => parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--dry-run", "--apply-suggestions"]));
  assert.doesNotThrow(() => assertLocalDatabase("postgresql://scott@localhost:5432/edctox?schema=public"));
  assert.throws(() => assertLocalDatabase("postgresql://scott:secret@db.example:5432/edctox"), /localhost/);
});

test("filters do not turn a missing curator decision into a zero agreement display", () => {
  const card = {
    sourceId: "1",
    title: "Bisphenol A",
    year: 2020,
    purposes: ["HUMAN_REPRODUCTIVE"],
    windows: ["relevance"],
    retracted: false,
    publicationStatus: "SCREENING_PENDING",
    machineDecision: "INCLUDE",
    journal: "Journal",
    doi: null,
    pmid: "1",
    pmcid: null,
    openAccess: true,
    abstractText: "Stored",
    abstractLabel: "Abstract from PubMed",
    studySignal: "human-observational-likely",
    providers: ["PUBMED"],
    provenance: [],
    machineReason: "DIRECT_HUMAN_EVIDENCE",
    machineConfidence: "HIGH",
    machineRationale: "A suggestion.",
    curatorDecision: null,
    curatorReasonCode: null,
    curatorNotes: null,
    governingPurpose: "HUMAN_REPRODUCTIVE",
  } satisfies ScreeningCard;
  assert.equal(filterScreeningCards([card], parseScreeningFilters({ curator: "pending" })).length, 1);
  assert.equal(filterScreeningCards([card], parseScreeningFilters({ machine: "EXCLUDE" })).length, 0);
  const page = read("src/app/admin/literature/page.tsx");
  assert.match(page, /notFound/);
  assert.match(page, /Agreement is not calculated until curator decisions exist/);
  assert.equal(page.includes("pubmed.ncbi.nlm.nih.gov/entrez"), false);
  for (const path of walk("src/app")) {
    if (path.includes("/admin/literature/")) continue;
    assert.equal(read(path).includes("abstractText"), false, path);
  }
  for (const path of WRITE_PATH) {
    const source = read(path);
    assert.equal(source.includes("evidenceFinding"), false, path);
    assert.equal(source.includes("mechanismAssessment"), false, path);
    assert.equal(source.includes("compoundOutcomeAssessment"), false, path);
    assert.equal(source.includes("chainOfThought"), false, path);
  }
});

const SEED = "# Bisphenol A\n\nBisphenol S is a different compound.";

function fakeTransport(output: unknown, seen: ScreeningCompletionRequest[] = []): ScreeningTransport {
  return {
    name: "fake",
    complete: async (request) => {
      seen.push(request);
      return { output, servedModel: "claude-haiku-5-5" };
    },
  };
}

function comparisonRow(overrides: Partial<ComparisonRow> & { evidenceSourceId: string }): ComparisonRow {
  return {
    pmid: null,
    year: 2024,
    title: `Paper ${overrides.evidenceSourceId}`,
    governingPurpose: "HUMAN_REPRODUCTIVE",
    existing: null,
    curator: null,
    model: null,
    error: null,
    ...overrides,
  };
}

test("the Claude screener speaks only the reasons.ts vocabulary and carries the pinned prompt version", async () => {
  assert.equal(CLAUDE_SCREENING_PROMPT_VERSION, "bpa-reproductive-claude-v1");
  assert.equal(CLAUDE_SCREENING_MODEL, "claude-haiku-5-5");
  assert.deepEqual(SCREENING_OUTPUT_SCHEMA.properties.decision.enum, [...SCREENING_DECISIONS]);
  assert.deepEqual(SCREENING_OUTPUT_SCHEMA.properties.reasonCode.enum, [...SCREENING_REASONS]);
  assert.deepEqual(SCREENING_OUTPUT_SCHEMA.properties.confidence.enum, [...SCREENING_CONFIDENCE]);
  assert.equal(SCREENING_OUTPUT_SCHEMA.additionalProperties, false);
  assert.equal("searchPurpose" in SCREENING_OUTPUT_SCHEMA.properties, false);

  const system = buildScreeningSystemPrompt({ seedKnowledge: SEED, endpointVocabulary: ["semen quality", "granulosa"] });
  assert.match(system, /Bisphenol S is a different compound/);
  assert.match(system, /semen quality, granulosa/);
  assert.match(system, /ANIMAL_ONLY and IN_VITRO_ONLY are only valid when the governing purpose is HUMAN_REPRODUCTIVE/);
  assert.doesNotMatch(system, /curator decision column|curatorDecision/);

  const user = buildScreeningUserPrompt({
    title: "Bisphenol A and semen quality in men",
    abstractText: "  Urinary bisphenol A and semen quality were studied in men.  ",
    retracted: false,
    purposes: ["CONTRADICTORY_OR_NULL", "SYSTEMATIC_REVIEWS"],
  });
  assert.match(user, /Governing purpose: SYSTEMATIC_REVIEWS\./);
  assert.match(user, /Abstract: Urinary bisphenol A and semen quality were studied in men\.$/m);
  assert.match(
    buildScreeningUserPrompt({ title: "Bisphenol A exposure", abstractText: null, retracted: true, purposes: ["HUMAN_REPRODUCTIVE"] }),
    /Retracted: yes\.\nTitle: Bisphenol A exposure\nAbstract: none is stored\./,
  );

  const valid = parseScreeningOutput(
    { decision: "EXCLUDE", reasonCode: "ANIMAL_ONLY", confidence: "HIGH", rationale: "  Adult   mice only.\n No people. " },
    ["HUMAN_REPRODUCTIVE"],
  );
  assert.deepEqual(valid, {
    decision: "EXCLUDE",
    reasonCode: "ANIMAL_ONLY",
    confidence: "HIGH",
    rationale: "Adult mice only. No people.",
    searchPurpose: "HUMAN_REPRODUCTIVE",
  });
  assert.equal(
    parseScreeningOutput({ decision: "INCLUDE", reasonCode: "SYSTEMATIC_REVIEW", confidence: "HIGH", rationale: "x".repeat(900) }, ["SYSTEMATIC_REVIEWS"]).rationale.length,
    400,
  );
  assert.throws(
    () => parseScreeningOutput({ decision: "EXCLUDE", reasonCode: "ANIMAL_ONLY", confidence: "HIGH", rationale: "Mice." }, ["SYSTEMATIC_REVIEWS"]),
    ScreeningProviderError,
  );
  assert.throws(
    () => parseScreeningOutput({ decision: "INCLUDE", reasonCode: "WRONG_DOMAIN", confidence: "HIGH", rationale: "Mixed." }, ["HUMAN_REPRODUCTIVE"]),
    /not available/,
  );
  assert.throws(() => parseScreeningOutput({ decision: "MAYBE", reasonCode: "OTHER", confidence: "LOW", rationale: "?" }, ["HUMAN_REPRODUCTIVE"]), ScreeningProviderError);
  assert.throws(() => parseScreeningOutput({ decision: "UNCERTAIN", reasonCode: "OTHER", confidence: "LOW", rationale: "   " }, ["HUMAN_REPRODUCTIVE"]), /empty rationale/);
  assert.throws(() => parseScreeningOutput("INCLUDE", ["HUMAN_REPRODUCTIVE"]), ScreeningProviderError);

  const seen: ScreeningCompletionRequest[] = [];
  const served: Array<string | null> = [];
  const provider = suggestWithClaude({
    transport: fakeTransport({ decision: "INCLUDE", reasonCode: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH", rationale: "A cohort of men." }, seen),
    seedKnowledge: SEED,
    onServedModel: (model) => served.push(model),
  });
  const first = await provider({
    evidenceSourceId: "s1",
    title: "Bisphenol A and semen quality in men",
    abstractText: "A cohort of men.",
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
    publicationStatus: "SCREENING_PENDING",
  });
  await provider({
    evidenceSourceId: "s2",
    title: "Bisphenol A and sperm in mice",
    abstractText: "Mice.",
    retracted: false,
    purposes: ["HUMAN_REPRODUCTIVE"],
    publicationStatus: "SCREENING_PENDING",
  });
  assert.equal(first.decision, "INCLUDE");
  assert.equal(first.searchPurpose, "HUMAN_REPRODUCTIVE");
  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.model, "claude-haiku-5-5");
  assert.equal(seen[0]?.system, seen[1]?.system);
  assert.equal(seen[0]?.schema, SCREENING_OUTPUT_SCHEMA);
  assert.match(seen[0]?.user ?? "", /A cohort of men/);
  assert.deepEqual(served, ["claude-haiku-5-5", "claude-haiku-5-5"]);

  const strict = suggestWithClaude({
    transport: fakeTransport({ decision: "EXCLUDE", reasonCode: "IN_VITRO_ONLY", confidence: "HIGH", rationale: "Cells." }),
    seedKnowledge: SEED,
  });
  await assert.rejects(
    () =>
      strict({
        evidenceSourceId: "s3",
        title: "Bisphenol A and granulosa cells",
        abstractText: "Cells.",
        retracted: false,
        purposes: ["CONTRADICTORY_OR_NULL"],
        publicationStatus: "SCREENING_PENDING",
      }),
    ScreeningProviderError,
  );

  const deterministic = await deterministicProvider({
    evidenceSourceId: "s4",
    title: "Systematic review of bisphenol A and fertility",
    abstractText: "This systematic review covers bisphenol A and fertility.",
    retracted: false,
    purposes: ["SYSTEMATIC_REVIEWS"],
    publicationStatus: "SCREENING_PENDING",
  });
  assert.equal(deterministic.reasonCode, "SYSTEMATIC_REVIEW");

  for (const path of ["src/server/screening/prompt.ts", "src/server/screening/claude.ts", "src/server/screening/applySuggestions.ts"]) {
    const source = read(path);
    for (const column of ["curatorDecision", "curatorReasonCode", "curatorNotes", "screenedBy", "screenedAt"]) {
      assert.equal(source.includes(column), false, `${path} mentions ${column}`);
    }
  }
  const compareScript = read("scripts/literature-screen-compare.ts");
  assert.equal(compareScript.includes("applyMachineSuggestions"), false);
  assert.equal(compareScript.includes("applyCuratorDecision"), false);
  assert.equal(compareScript.includes(".upsert("), false);
  assert.equal(compareScript.includes(".create("), false);
  assert.equal(compareScript.includes(".update("), false);
});

test("the dry-run comparison counts agreement with the rules and the curator and lists disagreements", () => {
  const rows: ComparisonRow[] = [
    comparisonRow({
      evidenceSourceId: "a",
      existing: { decision: "INCLUDE", reasonCode: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH" },
      curator: { decision: "INCLUDE", reasonCode: null },
      model: { decision: "INCLUDE", reasonCode: "DIRECT_HUMAN_EVIDENCE", confidence: "HIGH", rationale: "People.", searchPurpose: "HUMAN_REPRODUCTIVE" },
    }),
    comparisonRow({
      evidenceSourceId: "b",
      existing: { decision: "INCLUDE", reasonCode: "REPRODUCTIVE_RELEVANCE", confidence: "MODERATE" },
      curator: { decision: "EXCLUDE", reasonCode: "WRONG_DOMAIN" },
      model: { decision: "EXCLUDE", reasonCode: "WRONG_DOMAIN", confidence: "HIGH", rationale: "Plants.", searchPurpose: "CONTRADICTORY_OR_NULL" },
    }),
    comparisonRow({
      evidenceSourceId: "c",
      existing: { decision: "EXCLUDE", reasonCode: "ANIMAL_ONLY", confidence: "MODERATE" },
      model: { decision: "EXCLUDE", reasonCode: "IN_VITRO_ONLY", confidence: "HIGH", rationale: "Cells.", searchPurpose: "HUMAN_REPRODUCTIVE" },
    }),
    comparisonRow({
      evidenceSourceId: "d",
      model: { decision: "UNCERTAIN", reasonCode: "FULL_TEXT_NEEDED", confidence: "LOW", rationale: "No abstract.", searchPurpose: "HUMAN_REPRODUCTIVE" },
    }),
    comparisonRow({ evidenceSourceId: "e", existing: { decision: "INCLUDE", reasonCode: "META_ANALYSIS", confidence: "HIGH" }, error: "provider down" }),
  ];
  const summary = summarizeComparison(rows);
  assert.equal(summary.total, 5);
  assert.equal(summary.screened, 4);
  assert.equal(summary.errors, 1);
  assert.deepEqual(summary.modelDecisions, { INCLUDE: 1, EXCLUDE: 2, UNCERTAIN: 1 });
  assert.equal(summary.versusMachine.n, 3);
  assert.equal(summary.versusMachine.decisionAgree, 2);
  assert.equal(summary.versusMachine.reasonComparable, 2);
  assert.equal(summary.versusMachine.reasonAgree, 1);
  assert.equal(summary.versusMachine.matrix.INCLUDE.EXCLUDE, 1);
  assert.equal(summary.versusMachine.matrix.EXCLUDE.EXCLUDE, 1);
  assert.equal(summary.versusCurator.n, 2);
  assert.equal(summary.versusCurator.decisionAgree, 2);
  assert.equal(summary.versusCurator.reasonComparable, 1);
  assert.equal(summary.versusCurator.reasonAgree, 1);
  assert.equal(summary.versusCurator.kappa, 1);
  assert.deepEqual(
    summary.machineDisagreements.map((row) => row.evidenceSourceId),
    ["b"],
  );
  assert.deepEqual(summary.curatorDisagreements, []);
  assert.deepEqual(
    summary.failures.map((row) => row.evidenceSourceId),
    ["e"],
  );
  assert.equal(cohensKappa({ INCLUDE: { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 }, EXCLUDE: { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 }, UNCERTAIN: { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 } }), null);
  const chance = cohensKappa({ INCLUDE: { INCLUDE: 5, EXCLUDE: 5, UNCERTAIN: 0 }, EXCLUDE: { INCLUDE: 5, EXCLUDE: 5, UNCERTAIN: 0 }, UNCERTAIN: { INCLUDE: 0, EXCLUDE: 0, UNCERTAIN: 0 } });
  assert.equal(chance, 0);

  const markdown = renderComparisonMarkdown(summary, {
    promptVersion: "bpa-reproductive-claude-v1",
    model: "claude-haiku-5-5",
    servedModels: ["claude-haiku-5-5"],
    transport: "fake",
    source: "a fixture",
    ranAt: "2026-10-22T00:00:00.000Z",
  });
  assert.match(markdown, /Decision agreement \| 2 of 3 \(67%\)/);
  assert.match(markdown, /Nothing was written/);
  assert.match(markdown, /Paper b/);
  assert.match(markdown, /provider down/);
  assert.doesNotMatch(markdown, /abstractText/);

  const nobody = summarizeComparison([rows[3]!]);
  assert.equal(nobody.versusCurator.n, 0);
  assert.equal(nobody.versusCurator.decisionRate, null);
  assert.match(renderComparisonMarkdown(nobody, { promptVersion: "v", model: "m", servedModels: [], transport: "t", source: "s", ranAt: "now" }), /No curator decision to compare against/);
});

test("the comparison command is a dry run with no apply flag and the screen command accepts a provider", () => {
  const command = parseCompareArgs(["--compound", "bpa", "--domain", "reproductive"]);
  assert.deepEqual(command, { fromFile: null, outFile: null, limit: null, concurrency: 4 });
  assert.equal(parseCompareArgs(["--compound", "bpa", "--domain", "reproductive", "--from", "x.json", "--limit", "5", "--concurrency", "2", "--out", "r.md"]).limit, 5);
  assert.throws(() => parseCompareArgs(["--compound", "bpa", "--domain", "reproductive", "--apply"]), /never writes/);
  assert.throws(() => parseCompareArgs(["--compound", "dehp", "--domain", "reproductive"]));
  assert.throws(() => parseCompareArgs(["--compound", "bpa", "--domain", "reproductive", "--concurrency", "9"]));
  assert.equal(parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--dry-run"]).provider, "deterministic");
  assert.equal(parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--dry-run", "--provider", "claude"]).provider, "claude");
  assert.throws(() => parseScreeningArgs(["--compound", "bpa", "--domain", "reproductive", "--pending", "--dry-run", "--provider", "gpt"]), /provider/);
});

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnvFile(".env");

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

test("screening writes neither findings nor assessment changes", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { assertScientificSnapshotUnchanged, scientificSnapshot } = await import("../literature/guard");
  const db = new PrismaClient();
  try {
    const beforeOutside = await scientificSnapshot(db);
    assert.equal(beforeOutside.mechanismCount, 71);
    assert.equal(beforeOutside.findingCount, 2);
    const bpaBefore = await db.compound.findUniqueOrThrow({
      where: { slug: "bpa" },
      select: { id: true, curationStatus: true },
    });
    let rolledBack = false;
    try {
      await db.$transaction(
        async (tx) => {
          const before = await scientificSnapshot(tx);
          await applyLiteratureRun(tx, {
            compoundId: bpaBefore.id,
            provider: "PUBMED",
            purpose: "HUMAN_REPRODUCTIVE",
            queryText: "screen guard",
            resultWindow: "relevance",
            sortMode: "relevance",
            startedAt: new Date("2026-10-05T00:00:00Z"),
            completedAt: new Date("2026-10-05T00:00:01Z"),
            providerReportedCount: 1,
            status: "SUCCEEDED",
            errorText: null,
            hits: planLiteratureHits([], [paper()]),
          });
          const source = await tx.evidenceSource.findUniqueOrThrow({ where: { stableKey: "lit:pmid:999100001" } });
          await assert.rejects(
            () => applyCuratorDecision(tx, { evidenceSourceId: source.id, decision: "EXCLUDE", reasonCode: null, notes: null }),
            ScreeningError,
          );
          assert.equal(await tx.literatureScreeningDecision.count({ where: { evidenceSourceId: source.id } }), 0);
          await applyCuratorDecision(tx, {
            evidenceSourceId: source.id,
            decision: "EXCLUDE",
            reasonCode: "ANIMAL_ONLY",
            notes: "Human queue.",
          });
          await applyMachineSuggestions(tx, {
            compoundId: bpaBefore.id,
            providerName: "fixture",
            provider: fixtureSuggestion({
              decision: "INCLUDE",
              reasonCode: "DIRECT_HUMAN_EVIDENCE",
              confidence: "HIGH",
              rationale: "Fixture suggestion for review.",
              searchPurpose: "HUMAN_REPRODUCTIVE",
            }),
            candidates: [
              {
                evidenceSourceId: source.id,
                title: source.title,
                abstractText: "secret abstract text",
                retracted: false,
                purposes: ["HUMAN_REPRODUCTIVE"],
                publicationStatus: source.publicationStatus,
              },
            ],
          });
          const row = await tx.literatureScreeningDecision.findUniqueOrThrow({
            where: {
              evidenceSourceId_compoundId_domainCode: {
                evidenceSourceId: source.id,
                compoundId: bpaBefore.id,
                domainCode: "reproductive",
              },
            },
          });
          assert.equal(row.curatorDecision, "EXCLUDE");
          assert.equal(row.curatorReasonCode, "ANIMAL_ONLY");
          assert.equal(row.machineDecision, "INCLUDE");
          assert.equal((await tx.evidenceSource.findUniqueOrThrow({ where: { id: source.id } })).publicationStatus, "SCREENING_PENDING");
          const run = await tx.curationAgentRun.findFirstOrThrow({ where: { provider: "fixture" } });
          const packed = JSON.stringify(run.inputRefs) + JSON.stringify(run.outputRefs);
          assert.equal(packed.includes("secret abstract"), false);
          assert.equal(packed.includes("abstract"), false);
          assert.doesNotMatch(packed, /chainOfThought|chain of thought/i);

          const runsBefore = await tx.curationAgentRun.count();
          await assert.rejects(() =>
            applyMachineSuggestions(tx, {
              compoundId: bpaBefore.id,
              provider: () => {
                throw new Error("provider down");
              },
              candidates: [
                {
                  evidenceSourceId: source.id,
                  title: source.title,
                  abstractText: null,
                  retracted: false,
                  purposes: ["HUMAN_REPRODUCTIVE"],
                  publicationStatus: "SCREENING_PENDING",
                },
              ],
            }),
          );
          assert.equal(await tx.curationAgentRun.count(), runsBefore);
          assert.equal(
            (await tx.literatureScreeningDecision.findUniqueOrThrow({ where: { id: row.id } })).curatorDecision,
            "EXCLUDE",
          );

          await applyCuratorDecision(tx, { evidenceSourceId: source.id, decision: "RESET", reasonCode: null, notes: null });
          const reset = await tx.literatureScreeningDecision.findUniqueOrThrow({ where: { id: row.id } });
          assert.equal(reset.curatorDecision, null);
          assert.equal(reset.machineDecision, "INCLUDE");
          await applyCuratorDecision(tx, {
            evidenceSourceId: source.id,
            decision: "UNCERTAIN",
            reasonCode: "FULL_TEXT_NEEDED",
            notes: null,
          });

          await tx.literatureScreeningDecision.create({
            data: {
              evidenceSourceId: source.id,
              compoundId: bpaBefore.id,
              domainCode: "developmental",
              curatorDecision: "INCLUDE",
              curatorReasonCode: "DEVELOPMENTAL_RELEVANCE",
            },
          });
          const decisions = await tx.literatureScreeningDecision.findMany({ where: { evidenceSourceId: source.id } });
          assert.equal(decisions.length, 2);
          assert.equal(decisions.find((item) => item.domainCode === "developmental")?.curatorDecision, "INCLUDE");
          assert.equal(decisions.find((item) => item.domainCode === "reproductive")?.curatorDecision, "UNCERTAIN");

          await applyLiteratureRun(tx, {
            compoundId: bpaBefore.id,
            provider: "PUBMED",
            purpose: "HUMAN_REPRODUCTIVE",
            queryText: "retracted guard",
            resultWindow: "relevance",
            sortMode: "relevance",
            startedAt: new Date("2026-10-05T00:00:00Z"),
            completedAt: new Date("2026-10-05T00:00:01Z"),
            providerReportedCount: 1,
            status: "SUCCEEDED",
            errorText: null,
            hits: planLiteratureHits(
              [],
              [paper({ pmid: "999100002", doi: "10.1000/retracted", title: "Retracted bisphenol A and fertility", retracted: true })],
            ),
          });
          const retracted = await tx.evidenceSource.findUniqueOrThrow({ where: { stableKey: "lit:pmid:999100002" } });
          await assert.rejects(
            () => applyCuratorDecision(tx, { evidenceSourceId: retracted.id, decision: "INCLUDE", reasonCode: null, notes: null }),
            /retracted/i,
          );
          assert.equal(retracted.publicationStatus, "RETRACTED");
          assert.equal(await tx.literatureScreeningDecision.count({ where: { evidenceSourceId: retracted.id } }), 0);

          await tx.evidenceSource.update({ where: { id: source.id }, data: { publicationStatus: "DUPLICATE" } });
          await assert.rejects(
            () => applyCuratorDecision(tx, { evidenceSourceId: source.id, decision: "INCLUDE", reasonCode: null, notes: null }),
            /duplicate/i,
          );
          assert.equal(await tx.evidenceFinding.count({ where: { sourceId: source.id } }), 0);
          assertScientificSnapshotUnchanged(before, await scientificSnapshot(tx));
          assert.equal((await tx.compound.findUniqueOrThrow({ where: { id: bpaBefore.id } })).curationStatus, bpaBefore.curationStatus);
          throw new Error("ROLLBACK");
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ROLLBACK")) throw error;
      rolledBack = true;
    }
    assert.equal(rolledBack, true);
    assert.equal(await db.evidenceSource.findUnique({ where: { stableKey: "lit:pmid:999100001" } }), null);
    assertScientificSnapshotUnchanged(beforeOutside, await scientificSnapshot(db));
  } finally {
    await db.$disconnect();
  }
});
