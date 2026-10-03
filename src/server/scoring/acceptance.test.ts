import assert from "node:assert/strict";
import test from "node:test";

import { domains } from "../../data/seeds/domains";
import { mechanismAssessments } from "../../data/seeds/initialAssessments";
import { mechanisms } from "../../data/seeds/mechanisms";
import { summarizeDomain, type SummarizableAssessment } from "./summarize";

function profile(slug: string) {
  const grouped = new Map<string, SummarizableAssessment[]>();
  for (const assessment of mechanismAssessments.filter((row) => row.compoundSlug === slug)) {
    const mechanism = mechanisms.find((row) => row.code === assessment.mechanismCode);
    const domain = domains.find((row) => row.code === mechanism?.domainCode);
    if (!mechanism || !domain) throw new Error(`Missing mechanism ${assessment.mechanismCode}`);
    const list = grouped.get(domain.shortLabel) ?? [];
    list.push({
      mechanismCode: mechanism.code,
      mechanismName: mechanism.name,
      aggregationGroup: mechanism.aggregationGroup,
      scorePolicy: mechanism.scorePolicy,
      effectScore: assessment.effectScore,
      effectDirection: assessment.effectDirection,
      activityMagnitude: assessment.activityMagnitude,
      evidenceConfidence: assessment.evidenceConfidence,
      humanRelevance: assessment.humanRelevance,
      conflictingEvidence: assessment.conflictingEvidence,
      quantitativeScoreSupported: assessment.quantitativeScoreSupported,
      causalPathwayCode: assessment.pathwayCode ?? null,
      supportingFindingCount: 0,
      contradictoryFindingCount: 0,
    });
    grouped.set(domain.shortLabel, list);
  }

  return Object.fromEntries(
    domains.map((domain) => [
      domain.shortLabel,
      summarizeDomain({
        domainCode: domain.code,
        shortLabel: domain.shortLabel,
        contributesToProfile: domain.contributesToProfile,
        assessments: grouped.get(domain.shortLabel) ?? [],
      }),
    ]),
  );
}

test("priority compounds keep separate domain headlines", () => {
  const bpa = profile("bpa");
  assert.equal(bpa.REP?.maximumEvidenceSupportedEffect, 4);
  assert.equal(bpa.DEV?.maximumEvidenceSupportedEffect, 4);
  assert.equal(bpa.IMM?.maximumEvidenceSupportedEffect, 4);
  assert.equal(bpa.MET?.maximumEvidenceSupportedEffect, 4);
  assert.equal(bpa.MET?.numberOfCappedObservations, 2);
  assert.equal(bpa.MITO?.maximumEvidenceSupportedEffect, 3);
  assert.equal(bpa.REDOX?.maximumEvidenceSupportedEffect, 3);

  const dehp = profile("dehp");
  assert.equal(dehp.REP?.maximumEvidenceSupportedEffect, 4);
  assert.equal(dehp.DEV?.maximumEvidenceSupportedEffect, 4);
  assert.equal(dehp.MET?.maximumEvidenceSupportedEffect, 3);

  const pfos = profile("pfos");
  assert.equal(pfos.REP?.maximumEvidenceSupportedEffect, 3);
  assert.equal(pfos.DEV?.maximumEvidenceSupportedEffect, 4);
  assert.equal(pfos.IMM?.maximumEvidenceSupportedEffect, 4);
  assert.equal(pfos.MET?.maximumEvidenceSupportedEffect, 4);

  const olanzapine = profile("olanzapine");
  const risperidone = profile("risperidone");
  assert.equal(olanzapine.MET?.maximumEvidenceSupportedEffect, 4);
  assert.equal(olanzapine.MET?.humanRelevance, "H4");
  assert.equal(risperidone.REP?.maximumEvidenceSupportedEffect, 4);
  assert.equal(risperidone.MET?.maximumEvidenceSupportedEffect, 3);
  assert.ok((risperidone.MET?.maximumEvidenceSupportedEffect ?? 0) < (olanzapine.MET?.maximumEvidenceSupportedEffect ?? 0));

  const paraquat = profile("paraquat");
  assert.equal(paraquat.MITO?.maximumEvidenceSupportedEffect, 4);
  assert.equal(paraquat.REDOX?.maximumEvidenceSupportedEffect, 4);
  assert.equal(paraquat.REP?.maximumEvidenceSupportedEffect, null);

  const melatonin = profile("melatonin");
  assert.equal(melatonin.NEUROENDO?.maximumEvidenceSupportedEffect, null);
  assert.equal(melatonin.NEUROENDO?.dominantDirection, "PHYSIOLOGICAL");
  assert.equal(melatonin.REP?.maximumEvidenceSupportedEffect, 1);
  assert.equal(melatonin.DEV?.maximumEvidenceSupportedEffect, 1);
  assert.equal(melatonin.MITO?.maximumEvidenceSupportedEffect, -3);
  assert.equal(melatonin.REDOX?.maximumEvidenceSupportedEffect, -4);

  const boscalid = profile("boscalid");
  assert.equal(boscalid.MITO?.maximumEvidenceSupportedEffect, 4);
  assert.equal(boscalid.MITO?.humanRelevance, "H1");
  assert.equal(boscalid.MITO?.trace[0]?.selectedMechanismCode, "ETC_COMPLEX_II");

  const tfa = profile("tfa");
  assert.equal(tfa.NEUROENDO?.maximumEvidenceSupportedEffect, 4);
  assert.equal(tfa.DEV?.maximumEvidenceSupportedEffect, 3);
  assert.equal(tfa.REP?.maximumEvidenceSupportedEffect, null);
  assert.equal(tfa.NEUROENDO?.humanRelevance, "H2");

  const fluoxetine = profile("fluoxetine");
  assert.equal(fluoxetine.REP?.dominantDirection, "CONTEXT_DEPENDENT");
  assert.equal(fluoxetine.REP?.maximumEvidenceSupportedEffect, 3);

  const methylphenidate = profile("methylphenidate");
  assert.equal(methylphenidate.DEV?.maximumEvidenceSupportedEffect, 2);
  assert.equal(methylphenidate.NEUROENDO?.humanRelevance, "H4");
  assert.equal(methylphenidate.MITO?.humanRelevance, "H1");
  assert.equal(methylphenidate.MITO?.maximumEvidenceSupportedEffect, 2);
});
