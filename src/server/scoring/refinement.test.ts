import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compounds } from "../../data/seeds/compounds";
import { evidenceFindings, mechanismAssessments, relationships } from "../../data/seeds/initialAssessments";
import { mechanisms } from "../../data/seeds/mechanisms";
import { effectSemanticsError, migrateReportedSex } from "./effectSemantics";
import { summarizeDomain } from "./summarize";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../prisma/migrations/20261002041500_scientific_context/migration.sql", import.meta.url),
  "utf8",
);

test("effect scores stay inside −4 to +4", () => {
  assert.equal(effectSemanticsError({ effectScore: 4, effectDirection: "DISRUPTIVE" }), null);
  assert.equal(effectSemanticsError({ effectScore: -4, effectDirection: "PROTECTIVE" }), null);
  assert.match(effectSemanticsError({ effectScore: 5, effectDirection: "DISRUPTIVE" }) ?? "", /−4 to \+4/);
  assert.match(effectSemanticsError({ effectScore: -5, effectDirection: "PROTECTIVE" }) ?? "", /−4 to \+4/);
});

test("protective scores are not positive and disruptive scores are not negative", () => {
  assert.match(effectSemanticsError({ effectScore: 1, effectDirection: "PROTECTIVE" }) ?? "", /positive/);
  assert.match(effectSemanticsError({ effectScore: -1, effectDirection: "DISRUPTIVE" }) ?? "", /negative/);
  assert.equal(effectSemanticsError({ effectScore: null, effectDirection: "PROTECTIVE" }), null);
  assert.equal(effectSemanticsError({ effectScore: null, effectDirection: "DISRUPTIVE" }), null);
});

test("physiological activity can be null, and an uncertain direction can keep a score", () => {
  assert.equal(
    effectSemanticsError({
      effectScore: null,
      effectDirection: "PHYSIOLOGICAL",
      quantitativeScoreSupported: false,
    }),
    null,
  );
  assert.match(
    effectSemanticsError({ effectScore: 4, effectDirection: "PHYSIOLOGICAL", quantitativeScoreSupported: false }) ?? "",
    /physiological/,
  );
  const fertility = mechanismAssessments.find(
    (row) => row.compoundSlug === "melatonin" && row.mechanismCode === "FERTILITY",
  );
  assert.equal(fertility?.effectDirection, "UNKNOWN");
  assert.equal(fertility?.effectScore, 1);
  assert.equal(effectSemanticsError(fertility ?? { effectScore: 1, effectDirection: "UNKNOWN" }), null);
  const mt1 = mechanismAssessments.find(
    (row) => row.compoundSlug === "melatonin" && row.mechanismCode === "MELATONIN_MT1",
  );
  assert.equal(mt1?.effectScore, null);
  assert.equal(mt1?.effectDirection, "PHYSIOLOGICAL");
});

test("reorganization energy is not given a seed score", () => {
  const policy = mechanisms.find((row) => row.code === "REORGANIZATION_ENERGY");
  assert.equal(policy?.scorePolicy, "RESEARCH_ONLY");
  const scored = mechanismAssessments.filter(
    (row) => row.mechanismCode === "REORGANIZATION_ENERGY" && row.effectScore !== null,
  );
  assert.equal(scored.length, 0);
});

test("one finding can hold more than one measurement, and one source can hold more than one finding", () => {
  assert.match(schema, /model EvidenceMeasurement \{[\s\S]*findingId/);
  const rows = [
    { findingId: "same-finding", endpoint: "ATP" },
    { findingId: "same-finding", endpoint: "ROS" },
  ];
  assert.equal(new Set(rows.map((row) => row.findingId)).size, 1);
  assert.equal(rows.length, 2);
  assert.equal(new Set(evidenceFindings.map((finding) => finding.sourceKey)).size, 1);
  assert.equal(evidenceFindings.length, 2);
});

test("one compound can differ by biological context", () => {
  const melatonin = mechanismAssessments.filter((row) => row.compoundSlug === "melatonin");
  const contexts = new Set(melatonin.map((row) => row.biologicalContextKey ?? "unspecified"));
  assert.ok(contexts.has("mitochondrion"));
  assert.ok(contexts.has("dopaminergic-neuron"));
  assert.ok(contexts.has("unspecified"));
});

test("formulation evidence is a separate record from the active ingredient", () => {
  const formulation = compounds.find((row) => row.slug === "glyphosate-based-herbicide");
  assert.equal(formulation?.recordKind, "FORMULATION");
  assert.equal(
    mechanismAssessments.some((row) => row.compoundSlug === "glyphosate-based-herbicide"),
    false,
  );
  assert.equal(
    mechanismAssessments.some((row) => row.compoundSlug === "glyphosate"),
    false,
  );
  const types = relationships.map((row) => row[2]);
  assert.ok(types.includes("CONTAINS"));
  assert.ok(types.includes("ACTIVE_INGREDIENT_OF"));
});

test("study quality is not assessment confidence", () => {
  for (const finding of evidenceFindings) {
    assert.equal(finding.studyQuality, "NOT_ASSESSED");
  }
  const assessment = mechanismAssessments.find(
    (row) => row.compoundSlug === "bpa" && row.mechanismCode === "ER_ALPHA_AGONISM",
  );
  assert.notEqual(assessment?.evidenceConfidence, "NOT_ASSESSED");
  assert.equal(schema.includes("studyQuality"), true);
  assert.equal(schema.includes("evidenceConfidence"), true);
});

test("an empty domain stays unscored", () => {
  const summary = summarizeDomain({
    domainCode: "SYSTEMIC_METABOLISM",
    shortLabel: "MET",
    contributesToProfile: true,
    assessments: [],
  });
  assert.equal(summary.maximumEvidenceSupportedEffect, null);
  assert.match(summary.summaryText, /No quantitative mechanistic score/);
});

test("child mechanisms in one group are not summed", () => {
  const summary = summarizeDomain({
    domainCode: "SYSTEMIC_METABOLISM",
    shortLabel: "MET",
    contributesToProfile: true,
    assessments: [
      {
        mechanismCode: "INSULIN_RESISTANCE",
        mechanismName: "Insulin resistance",
        aggregationGroup: "INSULIN_SIGNALING",
        scorePolicy: "SCORABLE",
        effectScore: 4,
        effectDirection: "DISRUPTIVE",
        activityMagnitude: "VERY_HIGH",
        evidenceConfidence: "MODERATE",
        humanRelevance: "H3",
        conflictingEvidence: false,
        quantitativeScoreSupported: true,
        causalPathwayCode: null,
        supportingFindingCount: 0,
        contradictoryFindingCount: 0,
      },
      {
        mechanismCode: "IRS1_SIGNALING",
        mechanismName: "IRS1",
        aggregationGroup: "INSULIN_SIGNALING",
        scorePolicy: "SCORABLE",
        effectScore: 3,
        effectDirection: "DISRUPTIVE",
        activityMagnitude: "HIGH",
        evidenceConfidence: "LOW",
        humanRelevance: "H2",
        conflictingEvidence: false,
        quantitativeScoreSupported: true,
        causalPathwayCode: null,
        supportingFindingCount: 0,
        contradictoryFindingCount: 0,
      },
    ],
  });
  assert.equal(summary.maximumEvidenceSupportedEffect, 4);
  assert.equal(summary.numberOfCappedObservations, 1);
});

test("reported sex is mapped without dropping the original words", () => {
  assert.deepEqual(migrateReportedSex("male"), { sex: "MALE", sexDetail: "male" });
  assert.deepEqual(migrateReportedSex("females"), { sex: "FEMALE", sexDetail: "females" });
  assert.deepEqual(migrateReportedSex("both sexes"), { sex: "MIXED", sexDetail: "both sexes" });
  assert.deepEqual(migrateReportedSex("pooled adults"), { sex: "UNSPECIFIED", sexDetail: "pooled adults" });
  assert.deepEqual(migrateReportedSex(null, "Not applicable"), { sex: "NOT_APPLICABLE", sexDetail: null });
  assert.match(migration, /sexDetail/);
  assert.doesNotMatch(migration, /UNKNOWN' AND "effectScore" IS NULL/);
});
