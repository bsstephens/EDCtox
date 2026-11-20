import assert from "node:assert/strict";
import test from "node:test";

import {
  arrangeRows,
  cellStateFor,
  parseArrangement,
  parseColouring,
  type CoverageRow,
} from "./coverageMap";

function compound(overrides: Partial<CoverageRow> & Pick<CoverageRow, "slug" | "displayName">): CoverageRow {
  return {
    compoundType: "INDUSTRIAL_CHEMICAL",
    primaryCategory: "",
    recordKind: "SPECIFIC_COMPOUND",
    cells: {},
    assessedDomains: 0,
    assessmentCount: 0,
    claimCount: 0,
    unmappedClaimCount: 0,
    regulatoryCount: 0,
    strongestAbsoluteScore: null,
    ...overrides,
  };
}

test("a domain nobody has assessed is not the same cell as one assessed and left unscored", () => {
  const neverLooked = cellStateFor({ score: null, assessmentCount: 0, unscoredReason: null, claimCount: 0 });
  const assessedNoNumber = cellStateFor({
    score: null,
    assessmentCount: 2,
    unscoredReason: "NO_NUMBER_JUSTIFIED",
    claimCount: 0,
  });
  assert.equal(neverLooked, "EMPTY");
  assert.equal(assessedNoNumber, "UNSCORED");
  assert.notEqual(neverLooked, assessedNoNumber);
});

test("a zero headline is a result, not a blank", () => {
  assert.equal(cellStateFor({ score: 0, assessmentCount: 1, unscoredReason: null, claimCount: 0 }), "NO_EFFECT");
  assert.equal(cellStateFor({ score: 3, assessmentCount: 1, unscoredReason: null, claimCount: 0 }), "SCORED");
  assert.equal(cellStateFor({ score: -2, assessmentCount: 1, unscoredReason: null, claimCount: 0 }), "SCORED");
});

test("research-only rows keep their own state rather than looking unassessed", () => {
  assert.equal(
    cellStateFor({ score: null, assessmentCount: 1, unscoredReason: "OUTSIDE_HEADLINE", claimCount: 0 }),
    "OUTSIDE_HEADLINE",
  );
});

test("extracted claims only fill a cell that holds no assessment", () => {
  assert.equal(cellStateFor({ score: null, assessmentCount: 0, unscoredReason: null, claimCount: 4 }), "CLAIMS_ONLY");
  assert.equal(
    cellStateFor({ score: null, assessmentCount: 1, unscoredReason: "NO_NUMBER_JUSTIFIED", claimCount: 4 }),
    "UNSCORED",
  );
});

test("arrangements fall back to the compound name so the order is never arbitrary", () => {
  const rows = [
    compound({ slug: "b", displayName: "Beta", assessedDomains: 2, assessmentCount: 2 }),
    compound({ slug: "a", displayName: "Alpha", assessedDomains: 2, assessmentCount: 2 }),
    compound({ slug: "c", displayName: "Gamma", assessedDomains: 5, assessmentCount: 9 }),
  ];
  assert.deepEqual(
    arrangeRows(rows, "work").map((row) => row.slug),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    arrangeRows(rows, "name").map((row) => row.slug),
    ["a", "b", "c"],
  );
});

test("arranging never mutates the rows it was given", () => {
  const rows = [
    compound({ slug: "b", displayName: "Beta" }),
    compound({ slug: "a", displayName: "Alpha" }),
  ];
  arrangeRows(rows, "name");
  assert.deepEqual(
    rows.map((row) => row.slug),
    ["b", "a"],
  );
});

test("compounds with no score sort last by magnitude, not first", () => {
  const rows = [
    compound({ slug: "none", displayName: "None" }),
    compound({ slug: "weak", displayName: "Weak", strongestAbsoluteScore: 1 }),
    compound({ slug: "strong", displayName: "Strong", strongestAbsoluteScore: 4 }),
  ];
  assert.deepEqual(
    arrangeRows(rows, "score").map((row) => row.slug),
    ["strong", "weak", "none"],
  );
});

test("an unknown control value falls back to the neutral default", () => {
  assert.equal(parseArrangement("not-a-thing"), "name");
  assert.equal(parseArrangement(undefined), "name");
  assert.equal(parseArrangement("work"), "work");
  assert.equal(parseColouring("not-a-thing"), "fill");
  assert.equal(parseColouring("score"), "score");
});
