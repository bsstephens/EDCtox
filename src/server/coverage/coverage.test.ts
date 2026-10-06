import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { coverageMetrics, coverageWarnings, groupMappedClaims, unmappedClaims, type CoverageClaim } from "./query";
import { auditFamilies, type FamilyAuditRow } from "../mapping/families";

function claim(overrides: Partial<CoverageClaim> = {}): CoverageClaim {
  return {
    id: "claim-1",
    state: "CANDIDATE",
    subjectText: "bisphenol A",
    relation: "INCREASES_EXPRESSION",
    objectText: "aromatase",
    reviewDerived: false,
    directness: "STRONGLY_SUPPORTED",
    confidence: "HIGH",
    speciesText: "human",
    tissueText: null,
    cellTypeText: null,
    doseText: null,
    title: "Fixture paper",
    year: 2024,
    pmid: "1",
    doi: null,
    sourceSection: "Abstract",
    curatorVerified: false,
    machineMechanismCode: "AROMATASE_CYP19A1",
    mechanismCode: "AROMATASE_CYP19A1",
    mechanismName: "Aromatase (CYP19A1)",
    familyName: null,
    parentName: "Steroidogenic enzymes",
    parentCode: "REP_STEROIDOGENESIS",
    domainCode: "REPRODUCTIVE_ENDOCRINOLOGY",
    domainName: "Reproductive endocrinology",
    domainShortLabel: "REP",
    domainSort: 1,
    mechanismSort: 2,
    ...overrides,
  };
}

test("coverage keeps mapped, candidate, and unmapped claims apart", () => {
  const rows = [
    claim({ id: "verified", state: "VERIFIED", curatorVerified: true }),
    claim({ id: "candidate", state: "CANDIDATE" }),
    claim({
      id: "estradiol",
      state: "UNMAPPED",
      objectText: "estradiol",
      mechanismCode: null,
      mechanismName: null,
      parentCode: "REP_STEROIDOGENESIS",
      parentName: "Steroidogenic enzymes",
      machineMechanismCode: null,
      directness: "STRONGLY_SUPPORTED",
    }),
  ];
  const metrics = coverageMetrics(rows);
  assert.equal(metrics.mapped, 2);
  assert.equal(metrics.candidate, 1);
  assert.equal(metrics.unmapped, 1);
  assert.equal(metrics.verified, 1);
  assert.deepEqual(coverageWarnings(metrics), ["Some mechanistic claims are not yet mapped to the ontology."]);
  assert.deepEqual(coverageWarnings(coverageMetrics([])), ["No mechanistic claims have been extracted for this compound yet."]);
  const codes = groupMappedClaims(rows).flatMap((domain) => domain.families.flatMap((family) => family.parents.flatMap((parent) => parent.claims.map((item) => item.mechanismCode))));
  assert.deepEqual(codes.sort(), ["AROMATASE_CYP19A1", "AROMATASE_CYP19A1"]);
  assert.equal(codes.includes("REP_STEROIDOGENESIS"), false);
  assert.deepEqual(unmappedClaims(rows).map((item) => item.objectText), ["estradiol"]);
});

test("a machine-only compound warns without treating the claims as verified", () => {
  const metrics = coverageMetrics([claim(), claim({ id: "open", state: "UNMAPPED", mechanismCode: null, objectText: "steroidogenesis" })]);
  assert.equal(metrics.verified, 0);
  assert.deepEqual(coverageWarnings(metrics), [
    "Mechanistic claims are machine-extracted; no curator-verified mappings yet.",
    "Some mechanistic claims are not yet mapped to the ontology.",
  ]);
});

test("the family audit only names families already stored", () => {
  const rows: FamilyAuditRow[] = [
    {
      code: "GUT_BARRIER",
      name: "Gut barrier",
      domainCode: "IMMUNOLOGY_IMMUNOENDOCRINOLOGY",
      domainName: "Immunology",
      domainShortLabel: "IMM",
      domainSort: 2,
      familyCode: "GUT_BARRIER_MICROBIOME",
      familyName: "Gut barrier and microbiome",
      parentFamilyCode: null,
      parentFamilyName: null,
    },
    {
      code: "AROMATASE_CYP19A1",
      name: "Aromatase (CYP19A1)",
      domainCode: "REPRODUCTIVE_ENDOCRINOLOGY",
      domainName: "Reproductive endocrinology",
      domainShortLabel: "REP",
      domainSort: 1,
      familyCode: null,
      familyName: null,
      parentFamilyCode: null,
      parentFamilyName: null,
    },
  ];
  const audit = auditFamilies(rows);
  assert.deepEqual(audit.familyCodes, ["GUT_BARRIER_MICROBIOME"]);
  assert.equal(audit.total, 2);
  assert.equal(audit.assigned, 1);
  assert.equal(audit.missing, 1);
  assert.equal(audit.assignable, 0);
  assert.equal(audit.intentional, 1);
  assert.equal(JSON.stringify(audit).includes("STEROIDOGENESIS_FAMILY"), false);
});

test("public coverage and mechanism pages keep the supporting sentence unlisted", () => {
  const coverage = readFileSync("src/components/MechanismCoverage.tsx", "utf8");
  const compound = readFileSync("src/app/compounds/[slug]/page.tsx", "utf8");
  const detail = readFileSync("src/app/mechanisms/[code]/page.tsx", "utf8");
  const queue = readFileSync("src/app/admin/mechanisms/mapping/page.tsx", "utf8");
  const evidence = readFileSync("src/app/evidence/page.tsx", "utf8");
  for (const source of [coverage, compound, detail, evidence]) {
    assert.equal(source.includes("quotedSupport"), false);
    assert.equal(source.includes("abstractText"), false);
  }
  assert.match(coverage, /Mechanism coverage/);
  assert.match(coverage, /do not change a score/);
  assert.match(compound, /MechanismCoverage/);
  assert.match(detail, /The supporting sentence stays unlisted\./);
  assert.equal(detail.includes("until a claim is curator-verified"), false);
  assert.equal(queue.includes("notFound"), false);
  assert.match(queue, /does not change a score/);
  const apply = readFileSync("src/server/mapping/apply.ts", "utf8");
  assert.equal(/mechanismAssessment\.(update|create|upsert|delete)/.test(apply), false);
  assert.equal(/evidenceFinding\.(update|create|upsert|delete)/.test(apply), false);
});
