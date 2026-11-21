import assert from "node:assert/strict";
import test from "node:test";

import { domains } from "../../data/seeds/domains";
import { mechanismAssessments, pathways } from "../../data/seeds/initialAssessments";
import { mechanisms } from "../../data/seeds/mechanisms";
import { outcomeSeeds } from "../../data/seeds/outcomes";
import { PROFILE_LABELS } from "../../lib/labels";

const mechanismByCode = new Map(mechanisms.map((row) => [row.code, row]));
const outcomeByCode = new Map(outcomeSeeds.map((row) => [row.code, row]));

test("thyroid is a domain of its own and keeps the assessments it already had", () => {
  const thyroid = mechanisms.filter((row) => row.domainCode === "THYROID");
  for (const code of ["NEU_THYROID", "TSH", "THYROID_HORMONE", "THYROID_RECEPTOR"]) {
    assert.ok(
      thyroid.some((row) => row.code === code),
      `${code} should sit in the thyroid domain`,
    );
  }
  // The codes and the aggregation group are unchanged, so an existing assessment moves column
  // without its score, direction, confidence, or human relevance being touched.
  for (const code of ["TSH", "THYROID_HORMONE", "THYROID_RECEPTOR"]) {
    assert.equal(mechanismByCode.get(code)?.aggregationGroup, "THYROID_AXIS");
  }
  // Thyroid-dependent brain development is a developmental outcome driven by thyroid. Moving it
  // would blank the developmental column for the one compound that has it.
  assert.equal(
    mechanismByCode.get("THYROID_DEPENDENT_BRAIN_DEVELOPMENT")?.domainCode,
    "DEVELOPMENTAL_ENDOCRINOLOGY",
  );
});

test("cancer is recorded as outcomes only", () => {
  const cancers = outcomeSeeds.filter((row) => row.category === "CANCER").map((row) => row.code);
  // The list grows as routing finds cancers indexed on stored papers with nowhere to go. Ovarian
  // was added that way in November 2026. What must not change is that they are outcomes only.
  assert.deepEqual(cancers.sort(), [
    "BREAST_CANCER",
    "ENDOMETRIAL_CANCER",
    "OVARIAN_CANCER",
    "PROSTATE_CANCER",
    "THYROID_CANCER",
  ]);
  // No cancer domain, no cancer column, and nothing in the profile that a receptor result could
  // be read as a tumour finding through.
  assert.equal(
    domains.some((row) => row.code.includes("CANCER") || row.shortLabel.includes("CAN")),
    false,
  );
  assert.equal(PROFILE_LABELS.includes("CANCER" as never), false);
  assert.equal(
    mechanisms.some((row) => row.code.includes("CANCER") || row.code.includes("CARCINO")),
    false,
  );
});

test("a pathway step is a reading route and never a score", () => {
  for (const pathway of pathways) {
    if (pathway.outcomeCode) {
      assert.ok(outcomeByCode.has(pathway.outcomeCode), `${pathway.code} names a real outcome`);
    }
    for (const step of pathway.steps ?? []) {
      const mechanism = mechanismByCode.get(step.mechanismCode);
      assert.ok(mechanism, `${pathway.code} step ${step.mechanismCode} is a real mechanism`);
      // A grouping parent is a display node. It cannot carry a score, so it cannot be a step
      // that a reader would follow to evidence.
      assert.notEqual(mechanism?.scorePolicy, "GROUPING_ONLY");
    }
  }
  // Steps carry no compound and no score of their own: the seeded pathway with an outcome has no
  // assessment attached to it.
  const withOutcome = pathways.filter((row) => row.outcomeCode).map((row) => row.code);
  for (const code of withOutcome) {
    assert.equal(
      mechanismAssessments.some((row) => row.pathwayCode === code),
      false,
      `${code} should have no seeded assessment`,
    );
  }
});

test("the mechanisms added for the cancer route are unscored", () => {
  const added = [
    "HORMONE_DEPENDENT_PROLIFERATION",
    "DNA_DAMAGE_REPAIR",
    "MAMMARY_GLAND_DEVELOPMENT",
    "THYROID_HORMONE_SYNTHESIS",
    "THYROID_HORMONE_TRANSPORT",
    "THYROID_HORMONE_METABOLISM",
  ];
  for (const code of added) {
    assert.ok(mechanismByCode.has(code), `${code} is seeded`);
    assert.equal(
      mechanismAssessments.some((row) => row.mechanismCode === code),
      false,
      `${code} carries no seeded assessment`,
    );
  }
});

test("a key characteristic is a tag, not a count", () => {
  const valid = new Set([
    "KC1_RECEPTOR_AGONIST",
    "KC2_RECEPTOR_ANTAGONIST",
    "KC3_RECEPTOR_EXPRESSION",
    "KC4_SIGNAL_TRANSDUCTION",
    "KC5_EPIGENETIC",
    "KC6_HORMONE_SYNTHESIS",
    "KC7_HORMONE_TRANSPORT",
    "KC8_HORMONE_DISTRIBUTION",
    "KC9_HORMONE_METABOLISM",
    "KC10_CELL_FATE",
  ]);
  for (const mechanism of mechanisms) {
    if (mechanism.keyCharacteristic) assert.ok(valid.has(mechanism.keyCharacteristic));
    // A grouping parent organises display. It is not a molecular initiating event.
    if (mechanism.scorePolicy === "GROUPING_ONLY") {
      assert.equal(mechanism.keyCharacteristic, undefined, `${mechanism.code} should carry no tag`);
    }
  }
  // Most mechanisms are deliberately untagged. The report says the key characteristics are not a
  // checklist, so an untagged mechanism means "not assigned", never "not endocrine".
  const tagged = mechanisms.filter((row) => row.keyCharacteristic).length;
  assert.ok(tagged > 0 && tagged < mechanisms.length / 2);
});

test("an outcome whose name asserts a direction keeps its mirror where both are adverse", () => {
  // Twenty-four outcome concepts carry a direction in their name and, until the glyphosate
  // literature prompted an audit, only puberty held both. For most the single direction is the
  // adverse one and its opposite would be noise: nobody records rising sperm motility as a
  // finding. These are the concepts where both directions are adverse and documented, so losing
  // half a pair would silently make one of them unrecordable again.
  const codes = new Set(outcomeSeeds.map((row) => row.code));
  const pairs: ReadonlyArray<[string, string, string]> = [
    ["anogenital distance", "REDUCED_ANOGENITAL_DISTANCE", "INCREASED_ANOGENITAL_DISTANCE"],
    ["testosterone", "REDUCED_TESTOSTERONE", "ELEVATED_TESTOSTERONE"],
    ["menarche", "DELAYED_MENARCHE", "EARLY_MENARCHE"],
    ["puberty", "DELAYED_PUBERTY", "EARLY_PUBERTY"],
  ];
  for (const [concept, down, up] of pairs) {
    assert.ok(codes.has(down), `${concept} lost its ${down} direction`);
    assert.ok(codes.has(up), `${concept} lost its ${up} direction`);
  }

  // Both directions stay separate rows rather than one neutral "altered" row, because the
  // direction is the scientific content: a longer anogenital distance is androgenic and a
  // shorter one anti-androgenic, which are opposite mechanisms, not one finding.
  for (const [, down, up] of pairs) {
    const left = outcomeSeeds.find((row) => row.code === down);
    const right = outcomeSeeds.find((row) => row.code === up);
    assert.notEqual(left?.name, right?.name);
    assert.equal(left?.category, right?.category);
  }
});
