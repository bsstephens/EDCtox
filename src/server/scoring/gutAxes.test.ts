import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { domains } from "../../data/seeds/domains";
import {
  DESCRIPTIVE_COMPOSITION_CODES,
  gutVascularMechanisms,
} from "../../data/seeds/gutVascularMechanisms";
import { mechanismAssessments, outcomeAssessments, pathways } from "../../data/seeds/initialAssessments";
import { mechanisms } from "../../data/seeds/mechanisms";
import { outcomeSeeds } from "../../data/seeds/outcomes";
import { PROFILE_LABELS } from "../../lib/labels";
import { descriptiveScoreError } from "./compositionScores";

const gutCodes = new Set(gutVascularMechanisms.map((row) => row.code));

test("the seven profile columns stay the displayed domains", () => {
  assert.deepEqual([...PROFILE_LABELS], ["REP", "DEV", "NEUROENDO", "IMM", "MET", "MITO", "REDOX"]);
  const vascular = domains.find((row) => row.code === "VASCULAR_ENDOTHELIAL");
  const exposure = domains.find((row) => row.code === "EXPOSURE_DEVELOPMENTAL_MODIFIERS");
  assert.equal(vascular?.shortLabel, "VASCULAR");
  assert.equal(vascular?.contributesToProfile, false);
  assert.equal(exposure?.contributesToProfile, false);
  assert.equal(PROFILE_LABELS.includes("VASCULAR" as never), false);
  assert.equal(PROFILE_LABELS.includes("EXPOSURE" as never), false);
});

test("gut and endothelial mechanisms exist without becoming headline columns", () => {
  const required = [
    "INTESTINAL_PERMEABILITY",
    "ENDOTOXEMIA_LPS",
    "MICROBIOME_ALPHA_DIVERSITY",
    "SCFA_PRODUCTION",
    "FXR_SIGNALING",
    "GLP1_SIGNALING",
    "MICROBIAL_BIOACTIVATION",
    "ENDOTHELIAL_NO_BIOAVAILABILITY",
    "ENDOTHELIAL_PERMEABILITY",
    "ANGIOGENESIS",
    "COAGULATION",
    "VCAM1",
    "ENDOTHELIAL_ROS",
  ];
  for (const code of required) {
    assert.ok(mechanisms.some((row) => row.code === code), code);
  }
  const nitricOxide = mechanisms.find((row) => row.code === "ENDOTHELIAL_NO_BIOAVAILABILITY");
  assert.equal(nitricOxide?.domainCode, "VASCULAR_ENDOTHELIAL");
  const tone = gutVascularMechanisms.filter((row) => row.aggregationGroup === "VASCULAR_TONE");
  assert.ok(tone.every((row) => row.domainCode === "VASCULAR_ENDOTHELIAL"));
  const xenobiotic = mechanisms.find((row) => row.code === "MICROBIAL_BIOACTIVATION");
  assert.equal(xenobiotic?.domainCode, "EXPOSURE_DEVELOPMENTAL_MODIFIERS");
  const ros = mechanisms.find((row) => row.code === "ENDOTHELIAL_ROS");
  assert.equal(ros?.domainCode, "REDOX_CELLULAR_STRESS");
  assert.equal(ros?.aggregationGroup, "ENDOTHELIAL_ROS");
  assert.notEqual(ros?.aggregationGroup, "ROS_GENERATION");
  const cytokine = mechanisms.find((row) => row.code === "INTESTINAL_CYTOKINE_SIGNALING");
  assert.equal(cytokine?.aggregationGroup, "CYTOKINE_INFLAMMATION");
  assert.equal(cytokine?.domainCode, "IMMUNOLOGY_IMMUNOENDOCRINOLOGY");
  const permeability = mechanisms.find((row) => row.code === "INTESTINAL_PERMEABILITY");
  assert.equal(permeability?.domainCode, "IMMUNOLOGY_IMMUNOENDOCRINOLOGY");
  assert.equal(
    PROFILE_LABELS.includes(domains.find((row) => row.code === permeability?.domainCode)?.shortLabel as never),
    true,
  );
});

test("composition changes stay descriptive unless a functional consequence is explicit", () => {
  for (const code of DESCRIPTIVE_COMPOSITION_CODES) {
    const mechanism = mechanisms.find((row) => row.code === code);
    assert.equal(mechanism?.quantitativeScoreByDefault, false, code);
    assert.equal(mechanism?.scorePolicy, "SCORABLE", code);
    assert.equal(mechanism?.aggregationGroup, "MICROBIAL_ECOLOGY", code);
  }
  for (const code of ["SCFA_PRODUCTION", "FXR_SIGNALING", "TGR5_SIGNALING", "INTESTINAL_PERMEABILITY", "ENDOTOXEMIA_LPS", "MICROBIAL_BIOACTIVATION", "GLP1_SIGNALING"]) {
    assert.equal(mechanisms.find((row) => row.code === code)?.quantitativeScoreByDefault, true, code);
  }
  assert.equal(
    mechanisms.some((row) => row.code.includes("FIRMICUTES") || row.code.includes("BACTEROIDETES")),
    false,
  );
  assert.equal(
    descriptiveScoreError({
      quantitativeScoreByDefault: false,
      effectScore: null,
      quantitativeScoreSupported: false,
    }),
    null,
  );
  assert.match(
    descriptiveScoreError({
      quantitativeScoreByDefault: false,
      effectScore: 2,
      quantitativeScoreSupported: false,
    }) ?? "",
    /descriptive/,
  );
  assert.equal(
    descriptiveScoreError({
      quantitativeScoreByDefault: false,
      effectScore: 2,
      quantitativeScoreSupported: true,
    }),
    null,
  );
});

test("new mechanisms and outcomes are not attached to compounds", () => {
  const attached = mechanismAssessments.filter((row) => gutCodes.has(row.mechanismCode));
  assert.equal(attached.length, 0);
  const newOutcomes = new Set([
    "INCREASED_INTESTINAL_PERMEABILITY",
    "GUT_BARRIER_DYSFUNCTION",
    "MICROBIAL_DYSBIOSIS",
    "ALTERED_SCFA_PROFILE",
    "ENDOTOXEMIA",
    "ENDOTHELIAL_DYSFUNCTION",
    "MICROVASCULAR_DYSFUNCTION",
    "IMPAIRED_VASODILATION",
    "THROMBOTIC_EVENT",
    "VASCULAR_INFLAMMATION",
  ]);
  for (const code of newOutcomes) {
    assert.ok(outcomeSeeds.some((row) => row.code === code), code);
  }
  assert.equal(
    outcomeAssessments.filter((row) => newOutcomes.has(row.outcomeCode)).length,
    0,
  );
});

test("existing melatonin judgments in the seed are unchanged", () => {
  const fertility = mechanismAssessments.find(
    (row) => row.compoundSlug === "melatonin" && row.mechanismCode === "FERTILITY",
  );
  const mt1 = mechanismAssessments.find(
    (row) => row.compoundSlug === "melatonin" && row.mechanismCode === "MELATONIN_MT1",
  );
  assert.equal(fertility?.effectDirection, "UNKNOWN");
  assert.equal(fertility?.effectScore, 1);
  assert.equal(fertility?.evidenceConfidence, "VERY_LOW");
  assert.equal(fertility?.humanRelevance, "H0");
  assert.equal(mt1?.effectDirection, "PHYSIOLOGICAL");
  assert.equal(mt1?.effectScore, null);
  assert.equal(mt1?.quantitativeScoreSupported, false);
});

test("pathway definitions name chains and do not themselves cap scores", () => {
  const gut = pathways.find((row) => row.code === "GUT_BARRIER_METABOLIC_CHAIN");
  const bile = pathways.find((row) => row.code === "BILE_ACID_FXR_METABOLIC");
  assert.match(gut?.description ?? "", /Aggregation groups/);
  assert.match(gut?.description ?? "", /not pathway membership alone/);
  assert.match(bile?.description ?? "", /Pathway membership alone does not prevent score inflation/);
  assert.equal(
    mechanismAssessments.some((row) => row.pathwayCode === "GUT_BARRIER_METABOLIC_CHAIN" || row.pathwayCode === "BILE_ACID_FXR_METABOLIC"),
    false,
  );
});

test("microbiome method metadata is a finding annotation, and provenance still makes no network call", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /model MicrobiomeStudyMetadata/);
  assert.match(schema, /enum MicrobiomeSequencingMethod/);
  assert.match(schema, /evidenceFindingId\s+String\s+@unique/);
  const providers = readFileSync(new URL("../external/providers.ts", import.meta.url), "utf8");
  assert.equal(providers.includes("fetch("), false);
  assert.equal(providers.includes("http://"), false);
  assert.equal(providers.includes("https://"), false);
});
