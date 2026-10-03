import assert from "node:assert/strict";
import test from "node:test";

import { describePathways, summarizeDomain, type SummarizableAssessment } from "./summarize";

function row(
  overrides: Partial<SummarizableAssessment> & Pick<SummarizableAssessment, "mechanismCode" | "aggregationGroup">,
): SummarizableAssessment {
  return {
    mechanismName: overrides.mechanismCode,
    scorePolicy: "SCORABLE",
    effectScore: null,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "HIGH",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H1",
    conflictingEvidence: false,
    quantitativeScoreSupported: overrides.effectScore !== null && overrides.effectScore !== undefined,
    causalPathwayCode: null,
    supportingFindingCount: 0,
    contradictoryFindingCount: 0,
    ...overrides,
  };
}

const domain = {
  domainCode: "SYSTEMIC_METABOLISM",
  shortLabel: "MET",
  contributesToProfile: true,
};

test("insulin signalling chain is not summed", () => {
  const summary = summarizeDomain({
    ...domain,
    assessments: [
      row({
        mechanismCode: "INSULIN_RESISTANCE",
        aggregationGroup: "INSULIN_SIGNALING",
        effectScore: 4,
        humanRelevance: "H4",
        evidenceConfidence: "MODERATE",
        quantitativeScoreSupported: true,
      }),
      row({
        mechanismCode: "IRS1",
        aggregationGroup: "INSULIN_SIGNALING",
        effectScore: 3,
        quantitativeScoreSupported: true,
      }),
      row({
        mechanismCode: "AKT",
        aggregationGroup: "INSULIN_SIGNALING",
        effectScore: 2,
        quantitativeScoreSupported: true,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, 4);
  assert.equal(summary.numberOfCappedObservations, 2);
  assert.equal(summary.humanRelevance, "H4");
  assert.match(summary.summaryText, /not added/i);
});

test("opposing clusters are not averaged, and confidence steps down", () => {
  const summary = summarizeDomain({
    ...domain,
    assessments: [
      row({
        mechanismCode: "INSULIN_RESISTANCE",
        aggregationGroup: "INSULIN_SIGNALING",
        effectScore: 3,
        effectDirection: "DISRUPTIVE",
        quantitativeScoreSupported: true,
      }),
      row({
        mechanismCode: "ADIPONECTIN",
        aggregationGroup: "ADIPOKINES",
        effectScore: -3,
        effectDirection: "PROTECTIVE",
        evidenceConfidence: "LOW",
        quantitativeScoreSupported: true,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, 3);
  assert.equal(summary.dominantDirection, "MIXED");
  assert.equal(summary.confidence, "LOW");
  assert.equal(summary.confidenceAdjusted, true);
});

test("equal magnitudes prefer higher human relevance without increasing the score", () => {
  const summary = summarizeDomain({
    ...domain,
    assessments: [
      row({
        mechanismCode: "PPAR_ALPHA",
        aggregationGroup: "NUCLEAR_RECEPTOR_LIPID",
        effectScore: 3,
        humanRelevance: "H1",
        evidenceConfidence: "HIGH",
        quantitativeScoreSupported: true,
      }),
      row({
        mechanismCode: "INSULIN_RESISTANCE",
        aggregationGroup: "INSULIN_SIGNALING",
        effectScore: 3,
        humanRelevance: "H4",
        evidenceConfidence: "LOW",
        quantitativeScoreSupported: true,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, 3);
  assert.equal(summary.trace[0]?.selectedMechanismCode, "INSULIN_RESISTANCE");
  assert.equal(summary.humanRelevance, "H4");
});

test("research-only reorganization energy cannot set the headline", () => {
  const summary = summarizeDomain({
    domainCode: "MITOCHONDRIAL_BIOENERGETICS",
    shortLabel: "MITO",
    contributesToProfile: true,
    assessments: [
      row({
        mechanismCode: "REORGANIZATION_ENERGY",
        aggregationGroup: "REORGANIZATION_ENERGY",
        scorePolicy: "RESEARCH_ONLY",
        effectScore: 4,
        quantitativeScoreSupported: true,
      }),
      row({
        mechanismCode: "ETC_COMPLEX_II",
        aggregationGroup: "ETC_COMPLEX_II",
        effectScore: 4,
        humanRelevance: "H1",
        quantitativeScoreSupported: true,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, 4);
  assert.equal(summary.trace[0]?.selectedMechanismCode, "ETC_COMPLEX_II");
  assert.match(summary.summaryText, /REORGANIZATION_ENERGY/);
});

test("physiological melatonin activity is not a +4 disruption score", () => {
  const summary = summarizeDomain({
    domainCode: "NEUROENDOCRINE_HPA_CIRCADIAN",
    shortLabel: "NEUROENDO",
    contributesToProfile: true,
    assessments: [
      row({
        mechanismCode: "MELATONIN_MT1",
        aggregationGroup: "MELATONIN_RECEPTOR",
        effectScore: null,
        effectDirection: "PHYSIOLOGICAL",
        activityMagnitude: "VERY_HIGH",
        evidenceConfidence: "HIGH",
        humanRelevance: "H4",
        quantitativeScoreSupported: false,
      }),
      row({
        mechanismCode: "MELATONIN_MT2",
        aggregationGroup: "MELATONIN_RECEPTOR",
        effectScore: null,
        effectDirection: "PHYSIOLOGICAL",
        activityMagnitude: "VERY_HIGH",
        quantitativeScoreSupported: false,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, null);
  assert.equal(summary.dominantDirection, "PHYSIOLOGICAL");
  assert.equal(summary.physiologicalMagnitude, "VERY_HIGH");
});

test("exposure domain does not produce a profile score", () => {
  const summary = summarizeDomain({
    domainCode: "EXPOSURE_DEVELOPMENTAL_MODIFIERS",
    shortLabel: "EXPOSURE",
    contributesToProfile: false,
    assessments: [
      row({
        mechanismCode: "CO_FORMULANT_CONTEXT",
        aggregationGroup: "EXPOSURE_CONTEXT",
        effectScore: 4,
        quantitativeScoreSupported: true,
      }),
    ],
  });

  assert.equal(summary.maximumEvidenceSupportedEffect, null);
  assert.match(summary.summaryText, /does not contribute a profile score/);
});

test("a cross-domain pathway is described and not treated as one total", () => {
  const notes = describePathways([
    {
      pathwayCode: "PARAQUAT_REDOX_CYCLE",
      pathwayName: "Paraquat redox cycling",
      domainShortLabel: "MITO",
      effectScore: 4,
    },
    {
      pathwayCode: "PARAQUAT_REDOX_CYCLE",
      pathwayName: "Paraquat redox cycling",
      domainShortLabel: "REDOX",
      effectScore: 4,
    },
  ]);

  assert.equal(notes.length, 1);
  assert.match(notes[0] ?? "", /not added together/);
});
