import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { filterMechanismRows, mechanismStatus, parseMechanismFilters, type MechanismListRow } from "./query";

function row(overrides: Partial<MechanismListRow> = {}): MechanismListRow {
  return {
    code: "EXAMPLE",
    name: "Example mechanism",
    description: "A reusable concept",
    aggregationGroup: "EXAMPLE_GROUP",
    scorePolicy: "SCORABLE",
    domainCode: "REPRODUCTIVE_ENDOCRINOLOGY",
    domainName: "Reproductive endocrinology",
    domainShortLabel: "REP",
    profile: true,
    familyCode: null,
    familyName: null,
    parentCode: "PARENT",
    parentName: "Parent",
    assessmentCompounds: 0,
    claimCompounds: 0,
    claimCount: 0,
    verifiedClaims: 0,
    directClaims: 0,
    inferredClaims: 0,
    candidateClaims: 0,
    directness: {},
    ...overrides,
  };
}

test("mechanisms with zero claims stay in the unfiltered list", () => {
  const rows = [row(), row({ code: "MAPPED", claimCount: 2, candidateClaims: 2, directness: { STRONGLY_SUPPORTED: 2 } })];
  assert.equal(filterMechanismRows(rows).length, 2);
  assert.equal(filterMechanismRows(rows, { ...parseMechanismFilters({}), claims: "no" }).map((item) => item.code).join(), "EXAMPLE");
  assert.equal(mechanismStatus(rows[0]!), "No claims yet");
});

test("filters keep assessments, claims, and verified mappings distinct", () => {
  const rows = [
    row({ code: "ASSESSED", assessmentCompounds: 1 }),
    row({ code: "CANDIDATE", claimCount: 1, candidateClaims: 1, claimCompounds: 1, directness: { INFERRED: 1 }, inferredClaims: 1, profile: false, domainCode: "EXPOSURE" }),
    row({ code: "VERIFIED", claimCount: 1, verifiedClaims: 1, claimCompounds: 1, directness: { DIRECTLY_DEMONSTRATED: 1 }, directClaims: 1 }),
  ];
  const filters = parseMechanismFilters({});
  assert.deepEqual(filterMechanismRows(rows, { ...filters, assessments: "yes" }).map((item) => item.code), ["ASSESSED"]);
  assert.deepEqual(filterMechanismRows(rows, { ...filters, mapping: "CANDIDATE" }).map((item) => item.code), ["CANDIDATE"]);
  assert.deepEqual(filterMechanismRows(rows, { ...filters, mapping: "VERIFIED" }).map((item) => item.code), ["VERIFIED"]);
  assert.deepEqual(filterMechanismRows(rows, { ...filters, directness: "INFERRED" }).map((item) => item.code), ["CANDIDATE"]);
  assert.deepEqual(filterMechanismRows(rows, { ...filters, profile: "other" }).map((item) => item.code), ["CANDIDATE"]);
  assert.equal(mechanismStatus(rows[1]!), "Candidate mappings only");
  assert.equal(mechanismStatus(rows[2]!), "Curator-verified mapping");
});

test("mechanism pages do not publish the supporting sentence or change scores", () => {
  const list = readFileSync("src/app/mechanisms/page.tsx", "utf8");
  const detail = readFileSync("src/app/mechanisms/[code]/page.tsx", "utf8");
  const query = readFileSync("src/server/mechanisms/query.ts", "utf8");
  const evidence = readFileSync("src/app/evidence/page.tsx", "utf8");
  for (const source of [list, detail, evidence]) {
    assert.equal(source.includes("quotedSupport"), false);
    assert.equal(source.includes("abstractText"), false);
  }
  assert.match(detail, /<h2[^>]*>Assessments<\/h2>/);
  assert.match(detail, /<h2[^>]*>Claims<\/h2>/);
  assert.match(detail, /does not set the score|does not change a score/);
  assert.match(detail, /Machine-extracted/);
  assert.match(readFileSync("src/components/SiteHeader.tsx", "utf8"), /\/mechanisms/);
  assert.equal(/mechanismAssessment\.(update|create|upsert|delete)/.test(query), false);
  assert.equal(query.includes("summarize"), false);
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

test("the mechanism browser reads the ontology without changing scores or findings", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { assertScientificSnapshotUnchanged, scientificSnapshot } = await import("../literature/guard");
  const { loadMechanismDetail, loadMechanismRows } = await import("./query");
  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    assert.equal(before.mechanismCount, 71);
    assert.equal(before.findingCount, 2);
    const rows = await loadMechanismRows(db);
    assert.ok(rows.length > before.mechanismCount);
    assert.ok(rows.some((item) => item.claimCount === 0));
    assert.ok(rows.some((item) => item.assessmentCompounds > 0));
    const aromatase = rows.find((item) => item.code === "AROMATASE_CYP19A1");
    assert.ok(aromatase);
    assert.ok(aromatase.claimCount > 0);
    assert.equal(aromatase.verifiedClaims, 0);
    assert.equal(aromatase.candidateClaims, aromatase.claimCount);
    const detail = await loadMechanismDetail(db, "AROMATASE_CYP19A1");
    assert.ok(detail);
    assert.ok(detail.parent);
    assert.ok(detail.claims.length > 0);
    assert.ok(detail.claims.every((claim) => claim.verifiedSentence === null && claim.curatorVerified === false));
    assert.equal(detail.claims.some((claim) => "quotedSupport" in claim), false);
    const parent = await loadMechanismDetail(db, detail.parent.code);
    assert.ok(parent);
    assert.ok(parent.children.some((child) => child.code === "AROMATASE_CYP19A1"));
    const empty = rows.find((item) => item.claimCount === 0 && item.assessmentCompounds === 0);
    assert.ok(empty);
    const emptyDetail = await loadMechanismDetail(db, empty.code);
    assert.ok(emptyDetail);
    assert.equal(emptyDetail.claims.length, 0);
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
  } finally {
    await db.$disconnect();
  }
});
