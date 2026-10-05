import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { applyLiteratureRun } from "../literature/applyCandidates";
import { planLiteratureHits, type IncomingPaper } from "../literature/dedup";
import { applyMachineSuggestions, fixtureSuggestion } from "./applySuggestions";
import { assertLocalDatabase, parseScreeningArgs } from "./cli";
import { ScreeningError, applyCuratorDecision, assertCuratorCommand } from "./curate";
import { suggestDeterministic } from "./deterministic";
import { filterScreeningCards, parseScreeningFilters, type ScreeningCard } from "./queue";
import { reasonsForDecision } from "./reasons";
import { selectSuggestionSample, type QueueCandidate } from "./sample";

const WRITE_PATH = [
  "src/server/screening/reasons.ts",
  "src/server/screening/deterministic.ts",
  "src/server/screening/sample.ts",
  "src/server/screening/curate.ts",
  "src/server/screening/applySuggestions.ts",
  "src/server/screening/cli.ts",
  "src/server/screening/queue.ts",
  "scripts/literature-screen.ts",
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
