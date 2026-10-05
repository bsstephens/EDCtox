import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { applyMachineClaims } from "./apply";
import { assertClaimDatabase, parseClaimArgs } from "./cli";
import { CLAIM_PILOT_PMIDS, MITOCHONDRIAL_MECHANISM_CODES } from "./constants";
import { acronymIsSpecific, claimStableKey, extractMechanisticClaims, resolveMechanismCode, type ClaimDraft, type MechanismCatalog } from "./extract";
import { selectClaimPilot } from "./select";

const WRITE_PATH = [
  "src/server/claims/constants.ts",
  "src/server/claims/extract.ts",
  "src/server/claims/select.ts",
  "src/server/claims/apply.ts",
  "src/server/claims/cli.ts",
  "src/server/claims/load.ts",
  "scripts/literature-claims.ts",
];

const AROMATASE: MechanismCatalog = { AROMATASE_CYP19A1: { id: "aromatase-id", scorePolicy: "SCORABLE" } };
const MITO: MechanismCatalog = {
  ETC_COMPLEX_I: { id: "complex-i", scorePolicy: "SCORABLE" },
  ATP_PRODUCTION: { id: "atp-production", scorePolicy: "SCORABLE" },
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

function claims(title: string, abstractText: string, catalog: MechanismCatalog = AROMATASE) {
  return extractMechanisticClaims({ title, abstractText, catalog });
}

function one(title: string, abstractText: string, catalog?: MechanismCatalog): ClaimDraft {
  const found = claims(title, abstractText, catalog);
  const draft = found[0];
  assert.ok(draft, `${title} produced no claim`);
  return draft;
}

test("one abstract can yield more than one claim, with provenance", () => {
  const found = claims(
    "Bisphenol A in granulosa cells",
    "Bisphenol A reduced concentrations of estradiol and progesterone in human granulosa cells. IC50 of 12.5 µM was not reported.",
  );
  assert.equal(found.length, 2);
  assert.deepEqual(
    found.map((claim) => claim.objectText).sort(),
    ["estradiol", "progesterone"],
  );
  const estradiol = found.find((claim) => claim.objectText === "estradiol");
  assert.ok(estradiol);
  assert.equal(estradiol.textOrigin, "ABSTRACT");
  assert.equal(estradiol.sourceSection, "Abstract");
  assert.match(estradiol.quotedSupport ?? "", /estradiol and progesterone/);
  assert.equal(estradiol.machineDirectness, "STRONGLY_SUPPORTED");
  assert.equal(estradiol.speciesText, "human");
  assert.equal(estradiol.cellTypeText, "granulosa");
  assert.equal("ontologyId" in estradiol, false);
});

test("abstract inhibition stays strongly supported, and a direct assay can be directly demonstrated", () => {
  const ordinary = one("Bisphenol A", "Bisphenol A inhibits aromatase activity in granulosa cells.");
  assert.equal(ordinary.relation, "INHIBITS");
  assert.equal(ordinary.machineDirectness, "STRONGLY_SUPPORTED");
  assert.equal(ordinary.mechanismCode, "AROMATASE_CYP19A1");
  assert.equal(ordinary.mechanismId, "aromatase-id");
  assert.equal(ordinary.machineMappingState, "CANDIDATE");
  const kinetic = one("Bisphenol A", "Enzyme kinetics showed bisphenol A inhibits aromatase, with an IC50 of 12.5 µM.");
  assert.equal(kinetic.machineDirectness, "DIRECTLY_DEMONSTRATED");
  assert.equal(kinetic.measureType, "IC50");
  assert.equal(kinetic.measureValue, "12.5");
  assert.equal(kinetic.measureUnit, "µM");
});

test("review text stays inferred or hypothesized", () => {
  const inferred = one("Ovarian steroidogenesis", "This review reports that bisphenol A inhibits aromatase activity.");
  assert.equal(inferred.reviewDerived, true);
  assert.equal(inferred.machineDirectness, "INFERRED");
  assert.equal(inferred.reviewPriority, "REVIEW_REQUIRED");
  const hypothesized = one("Ovarian steroidogenesis", "This review suggests bisphenol A may inhibit aromatase.");
  assert.equal(hypothesized.machineDirectness, "HYPOTHESIZED");
  assert.equal(hypothesized.machineConfidence, "LOW");
});

test("ATP and lactate dehydrogenase stay off mitochondrial mechanisms", () => {
  const atp = one("Bisphenol A and energy", "Bisphenol A decreased cellular ATP. Oxygen consumption was not measured.", MITO);
  assert.equal(atp.objectText, "ATP");
  assert.equal(atp.relation, "DECREASES_LEVEL");
  assert.equal(atp.mechanismId, null);
  assert.equal(atp.mechanismCode, null);
  assert.equal(atp.machineMappingState, "UNMAPPED");
  const blocked = resolveMechanismCode("ATP_PRODUCTION", "ATP", MITO);
  assert.equal(blocked.mechanismId, null);
  const complex = resolveMechanismCode("ETC_COMPLEX_I", "cellular ATP", MITO);
  assert.equal(complex.mechanismId, null);
  const ldh = one("Bisphenol A", "Bisphenol A inhibits lactate dehydrogenase.", MITO);
  assert.equal(ldh.objectText, "lactate dehydrogenase");
  assert.equal(ldh.mechanismId, null);
  assert.equal(ldh.machineMappingState, "UNMAPPED");
});

test("a missing mechanism and a grouping parent stay unmapped", () => {
  const missing = one("Bisphenol A", "Bisphenol A impaired spermatogenesis in adult mice.", {});
  assert.equal(missing.objectText, "spermatogenesis");
  assert.equal(missing.mechanismId, null);
  assert.equal(missing.machineMappingState, "UNMAPPED");
  const grouped = resolveMechanismCode("REP_STEROIDOGENESIS", "steroidogenesis", {
    REP_STEROIDOGENESIS: { id: "parent", scorePolicy: "GROUPING_ONLY" },
  });
  assert.equal(grouped.mechanismId, null);
  assert.equal(grouped.mappingState, "UNMAPPED");
  const process = one("Bisphenol A", "Bisphenol A disrupts steroidogenesis in ovarian cells.", {
    REP_STEROIDOGENESIS: { id: "parent", scorePolicy: "GROUPING_ONLY" },
  });
  assert.equal(process.mechanismId, null);
});

test("contradictory aromatase claims both remain", () => {
  const found = claims(
    "Bisphenol A",
    "Bisphenol A inhibits aromatase activity. A later assay found no effect on aromatase.",
  );
  assert.deepEqual(
    found.map((claim) => claim.relation).sort(),
    ["INHIBITS", "NO_EFFECT"],
  );
});

test("receptor level and estrogen-like wording are not agonism", () => {
  const level = one("Pubertal BPA exposure", "Bisphenol A significantly increased ERα immunoreactive neurons in female mice.");
  assert.equal(level.relation, "INCREASES_LEVEL");
  assert.equal(level.objectText, "estrogen receptor alpha");
  assert.equal(level.mechanismCode, null);
  assert.equal(claims("Bisphenol A", "Bisphenol A has estrogen like effects on ovarian cells.").length, 0);
  assert.equal(claims("Bisphenol A", "Bisphenol A acts via ERα-dependent signaling in ovarian cells.").length, 0);
  assert.equal(claims("Bisphenol S study", "Bisphenol S inhibited aromatase. Bisphenol A was mentioned as context.").length, 0);
});

test("mitochondrial impairment wording does not create an electron-transport claim", () => {
  const found = claims(
    "Prenatal bisphenol A exposure",
    "Bisphenol A elevated CYP19A1 expression and mitochondrial impairment in human endometrial stromal cells.",
  );
  assert.equal(found.length, 1);
  assert.equal(found[0]?.mechanismCode, "AROMATASE_CYP19A1");
  assert.equal(
    found.some((claim) => claim.mechanismCode !== null && MITOCHONDRIAL_MECHANISM_CODES.includes(claim.mechanismCode as (typeof MITOCHONDRIAL_MECHANISM_CODES)[number])),
    false,
  );
});

test("TFA acronym alone is not a specific compound name", () => {
  assert.equal(acronymIsSpecific("TFA", "TFA reduced T4 in serum."), false);
  assert.equal(acronymIsSpecific("TFA", "Trifluoroacetic acid reduced T4 in serum."), true);
  assert.equal(claims("TFA method", "TFA reduced aromatase activity.").length, 0);
});

test("claim identity follows source, subject, relation, and object", () => {
  const left = claimStableKey("source-1", "Bisphenol A", "INHIBITS", "Aromatase");
  assert.equal(left, claimStableKey("source-1", "bisphenol a", "INHIBITS", "aromatase"));
  assert.notEqual(left, claimStableKey("source-1", "bisphenol a", "NO_EFFECT", "aromatase"));
  assert.notEqual(left, claimStableKey("source-2", "bisphenol a", "INHIBITS", "aromatase"));
});

test("the pilot is five pending papers and the command stays local", () => {
  const rows = CLAIM_PILOT_PMIDS.map((pmid, index) => ({
    pmid,
    retracted: index === 4,
    publicationStatus: index === 3 ? "DUPLICATE" : "SCREENING_PENDING",
  }));
  assert.deepEqual(
    selectClaimPilot(rows, 5).map((row) => row.pmid),
    ["40362320", "40753778", "26361328"],
  );
  assert.equal(selectClaimPilot(CLAIM_PILOT_PMIDS.map((pmid) => ({ pmid, retracted: false, publicationStatus: "SCREENING_PENDING" })), 2).length, 2);
  assert.throws(() => parseClaimArgs(["--all", "--dry-run", "--compound", "bpa", "--domain", "reproductive"]), /--all/);
  assert.throws(() => parseClaimArgs(["--dry-run", "--apply", "--compound", "bpa", "--domain", "reproductive"]), /either/);
  assert.throws(() => parseClaimArgs(["--dry-run", "--compound", "bpa", "--domain", "reproductive", "--limit", "90"]), /1 to 5/);
  assert.deepEqual(parseClaimArgs(["--dry-run", "--compound", "bpa", "--domain", "reproductive"]), { dryRun: true, limit: 5 });
  try {
    assertClaimDatabase("postgresql://scott:secret@db.example/edctox");
    assert.fail("non-local database was accepted");
  } catch (error) {
    assert.match(error instanceof Error ? error.message : "", /localhost/);
    assert.equal(String(error).includes("secret"), false);
  }
});

test("claim pages stay off the public site", () => {
  const page = read("src/app/admin/literature/claims/page.tsx");
  assert.match(page, /notFound/);
  assert.match(page, /not scientific acceptance/);
  assert.equal(page.includes("abstractText"), false);
  for (const path of walk("src/app")) {
    if (path.includes("/admin/literature/")) continue;
    const source = read(path);
    assert.equal(source.includes("quotedSupport"), false, path);
    assert.equal(source.includes("mechanisticClaim"), false, path);
    assert.equal(source.includes("abstractText"), false, path);
  }
  const atlas = read("src/server/atlas/queries.ts");
  assert.equal(atlas.includes("mechanisticClaim"), false);
  assert.equal(atlas.includes("quotedSupport"), false);
  for (const path of WRITE_PATH) {
    const source = read(path);
    assert.equal(source.includes("evidenceFinding"), false, path);
    assert.equal(source.includes("mechanismAssessment"), false, path);
    assert.equal(source.includes("compoundOutcomeAssessment"), false, path);
    assert.equal(source.includes("biologicalContext"), false, path);
    assert.equal(source.includes("exposureContext"), false, path);
    assert.equal(source.includes("chainOfThought"), false, path);
    assert.equal(source.includes("effectDirection"), false, path);
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

function fixtureDraft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    subjectType: "CHEMICAL",
    subjectText: "bisphenol A",
    relation: "INHIBITS",
    objectType: "ENZYME",
    objectText: "aromatase",
    machineDirectness: "STRONGLY_SUPPORTED",
    machineConfidence: "HIGH",
    machineRationale: "Fixture edge.",
    machineMappingState: "UNMAPPED",
    mechanismCode: null,
    mechanismId: null,
    speciesText: "human",
    tissueText: null,
    cellTypeText: "granulosa",
    doseText: null,
    measureType: null,
    measureValue: null,
    measureUnit: null,
    textOrigin: "ABSTRACT",
    sourceSection: "Abstract",
    quotedSupport: "Bisphenol A inhibits aromatase.",
    reviewPriority: "REVIEW_RECOMMENDED",
    reviewDerived: false,
    ...overrides,
  };
}

test("claim apply does not change scores, findings, or curator fields", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { assertScientificSnapshotUnchanged, scientificSnapshot } = await import("../literature/guard");
  const db = new PrismaClient();
  const stableKey = "lit:pmid:claim-fixture";
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
          const mechanisms = await tx.mechanism.count();
          const biological = await tx.biologicalContext.count();
          const exposure = await tx.exposureContext.count();
          const source = await tx.evidenceSource.create({
            data: {
              stableKey,
              title: "Fixture bisphenol A aromatase study",
              journalOrPublisher: "Fixture",
              year: 2024,
              sourceType: "UNSPECIFIED",
              countsAsScientificEvidence: false,
              publicationStatus: "SCREENING_PENDING",
              abstractText: "secret abstract text. Bisphenol A inhibits aromatase.",
              url: "",
            },
          });
          const written = await applyMachineClaims(tx, {
            compoundId: bpaBefore.id,
            papers: [{ evidenceSourceId: source.id, title: source.title, abstractText: source.abstractText }],
            extract: () => [fixtureDraft(), fixtureDraft({ relation: "NO_EFFECT", machineRationale: "Separate no-effect edge." })],
          });
          assert.equal(written.written, 2);
          const stored = await tx.mechanisticClaim.findMany({ where: { evidenceSourceId: source.id } });
          assert.equal(stored.length, 2);
          assert.ok(stored.every((claim) => claim.curatorVerified === false));
          assert.ok(stored.every((claim) => claim.machineMappingState !== "VERIFIED"));
          const run = await tx.curationAgentRun.findUniqueOrThrow({ where: { id: written.runId } });
          const packed = JSON.stringify(run);
          assert.equal(packed.includes("secret abstract text"), false);
          assert.equal(packed.includes("chain of thought"), false);
          assert.equal(await tx.evidenceFinding.count({ where: { sourceId: source.id } }), 0);
          assert.equal(await tx.mechanism.count(), mechanisms);
          assert.equal(await tx.biologicalContext.count(), biological);
          assert.equal(await tx.exposureContext.count(), exposure);
          assert.equal((await tx.evidenceSource.findUniqueOrThrow({ where: { id: source.id } })).publicationStatus, "SCREENING_PENDING");
          await tx.mechanisticClaim.updateMany({
            where: { evidenceSourceId: source.id },
            data: { curatorVerified: true, curatorNote: "Keep this note." },
          });
          await applyMachineClaims(tx, {
            compoundId: bpaBefore.id,
            papers: [{ evidenceSourceId: source.id, title: source.title, abstractText: source.abstractText }],
            extract: () => [fixtureDraft({ machineRationale: "Updated fixture edge." }), fixtureDraft({ relation: "NO_EFFECT" })],
          });
          const again = await tx.mechanisticClaim.findMany({ where: { evidenceSourceId: source.id } });
          assert.ok(again.every((claim) => claim.curatorVerified && claim.curatorNote === "Keep this note."));
          assert.ok(again.some((claim) => claim.machineRationale === "Updated fixture edge."));
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
    assert.equal(await db.evidenceSource.findUnique({ where: { stableKey } }), null);
    assertScientificSnapshotUnchanged(beforeOutside, await scientificSnapshot(db));
  } finally {
    await db.$disconnect();
  }
});

test("the five pilot abstracts support specific claims", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { catalogFromRows } = await import("./extract");
  const db = new PrismaClient();
  try {
    const sources = await db.evidenceSource.findMany({
      where: { pmid: { in: [...CLAIM_PILOT_PMIDS] } },
      select: { pmid: true, title: true, abstractText: true, publicationStatus: true, retracted: true },
    });
    assert.equal(sources.length, 5);
    const catalog = catalogFromRows(await db.mechanism.findMany({ select: { id: true, code: true, scorePolicy: true } }));
    for (const source of sources) {
      assert.equal(source.publicationStatus, "SCREENING_PENDING");
      assert.equal(source.retracted, false);
      const found = extractMechanisticClaims({ title: source.title, abstractText: source.abstractText, catalog });
      assert.ok(found.length >= 1 && found.length <= 8, `${source.pmid ?? "?"} yielded ${found.length}`);
      const haystack = `${source.title} ${source.abstractText ?? ""}`.replace(/\s+/g, " ");
      for (const claim of found) {
        assert.equal(claim.subjectText, "bisphenol A");
        assert.notEqual(claim.machineDirectness, "DIRECTLY_DEMONSTRATED");
        assert.notEqual(claim.machineMappingState, "VERIFIED");
        assert.equal(claim.textOrigin, "ABSTRACT");
        assert.equal(claim.machineRationale.includes("chain of thought"), false);
        const quote = (claim.quotedSupport ?? "").replace(/\.\.\.$/, "");
        assert.ok(quote.length > 0 && haystack.includes(quote), source.pmid ?? "quote");
        if (claim.mechanismCode) assert.equal(MITOCHONDRIAL_MECHANISM_CODES.includes(claim.mechanismCode as (typeof MITOCHONDRIAL_MECHANISM_CODES)[number]), false);
      }
    }
    const byPmid = new Map(sources.map((source) => [source.pmid, source]));
    const granulosa = byPmid.get("40362320");
    const testis = byPmid.get("40753778");
    const receptor = byPmid.get("26361328");
    const aromatase = byPmid.get("42023145");
    const review = byPmid.get("27543890");
    assert.ok(granulosa && testis && receptor && aromatase && review);
    const granulosaClaims = extractMechanisticClaims({ title: granulosa.title, abstractText: granulosa.abstractText, catalog });
    assert.ok(granulosaClaims.some((claim) => claim.relation === "DECREASES_LEVEL" && claim.objectText === "estradiol" && claim.machineDirectness === "STRONGLY_SUPPORTED"));
    assert.ok(granulosaClaims.some((claim) => claim.objectText === "progesterone"));
    assert.ok(granulosaClaims.some((claim) => claim.mechanismCode === "HSD3B" && claim.mechanismId));
    const testisClaims = extractMechanisticClaims({ title: testis.title, abstractText: testis.abstractText, catalog });
    assert.ok(testisClaims.some((claim) => claim.relation === "DECREASES_LEVEL" && claim.objectText === "testosterone"));
    const receptorClaims = extractMechanisticClaims({ title: receptor.title, abstractText: receptor.abstractText, catalog });
    assert.ok(receptorClaims.every((claim) => claim.relation !== "AGONIZES"));
    assert.ok(receptorClaims.some((claim) => claim.objectText === "estrogen receptor alpha" && claim.mechanismId === null));
    const aromataseClaims = extractMechanisticClaims({ title: aromatase.title, abstractText: aromatase.abstractText, catalog });
    assert.ok(aromataseClaims.some((claim) => claim.mechanismCode === "AROMATASE_CYP19A1" && claim.machineDirectness === "STRONGLY_SUPPORTED"));
    assert.equal(aromataseClaims.some((claim) => claim.objectText === "ATP"), false);
    const reviewClaims = extractMechanisticClaims({ title: review.title, abstractText: review.abstractText, catalog });
    assert.ok(reviewClaims.length >= 2);
    assert.ok(reviewClaims.every((claim) => claim.reviewDerived && (claim.machineDirectness === "INFERRED" || claim.machineDirectness === "HYPOTHESIZED")));
    assert.ok(reviewClaims.some((claim) => claim.mechanismCode === "AROMATASE_CYP19A1"));
  } finally {
    await db.$disconnect();
  }
});
