import assert from "node:assert/strict";
import test from "node:test";

import { buildMechanismLookup } from "./mechanismLookup";

const rows = [
  { code: "AROMATASE_CYP19A1", name: "Aromatase (CYP19A1)" },
  { code: "HSD3B", name: "3β-HSD" },
  { code: "HSD17B", name: "17β-HSD" },
  { code: "FOXO1", name: "FOXO1" },
  { code: "GLP1_SIGNALING", name: "GLP-1 signalling" },
  { code: "ESTRADIOL", name: "Estradiol" },
  { code: "IRS1", name: "IRS1" },
];

test("a node answers to its code, its name and its parenthetical", () => {
  const lookup = buildMechanismLookup(rows);
  assert.equal(lookup.find("Aromatase (CYP19A1)"), "AROMATASE_CYP19A1");
  assert.equal(lookup.find("aromatase"), "AROMATASE_CYP19A1");
  // A paper writes the gene symbol where the ontology writes the enzyme name.
  assert.equal(lookup.find("CYP19A1"), "AROMATASE_CYP19A1");
  assert.equal(lookup.find("estradiol"), "ESTRADIOL");
  assert.equal(lookup.find("FOXO1"), "FOXO1");
});

test("an isoform resolves to the family the ontology holds, and is reported", () => {
  const lookup = buildMechanismLookup(rows);
  assert.equal(lookup.find("HSD3B1"), "HSD3B");
  assert.equal(lookup.find("HSD3B2"), "HSD3B");
  assert.deepEqual([...lookup.isoformMatches().entries()], [["HSD3B1", "HSD3B"], ["HSD3B2", "HSD3B"]]);
  // A node whose own code ends in a digit is matched directly and is not an isoform match.
  const fresh = buildMechanismLookup(rows);
  assert.equal(fresh.find("IRS1"), "IRS1");
  assert.equal(fresh.isoformMatches().size, 0);
});

test("a term the ontology does not hold stays unmapped", () => {
  const lookup = buildMechanismLookup(rows);
  // These are real gene symbols from the first extraction run. None is in the ontology, and
  // guessing a neighbour would hide a genuine gap.
  for (const term of ["TRIM25", "UGT2B15", "CASP3", "RPS6KA3", "NR6A1", "PPID", "IKBKG", "SF1"]) {
    assert.equal(lookup.find(term), null, `${term} should stay unmapped`);
  }
  assert.equal(lookup.find(""), null);
  assert.equal(lookup.find("cellular viability and counts"), null);
});

test("dropping a digit cannot invent a node", () => {
  const lookup = buildMechanismLookup(rows);
  // GLP1 would become GLP, which the ontology does not hold, so it stays unmapped rather than
  // sliding onto something that merely starts the same way.
  assert.equal(lookup.find("GLP2"), null);
  assert.equal(lookup.find("X1"), null);
});
