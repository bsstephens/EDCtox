import assert from "node:assert/strict";
import test from "node:test";

import { claimSynonyms } from "../../data/seeds/claimSynonyms";
import { catalogFromRows } from "./extract";
import { buildRemapper } from "./remap";
import { buildSynonymResolver } from "./synonyms";

const mechanisms = [
  { id: "m-testosterone", code: "TESTOSTERONE", name: "Testosterone", scorePolicy: "SCORABLE" as const },
  { id: "m-aromatase", code: "AROMATASE_CYP19A1", name: "Aromatase (CYP19A1)", scorePolicy: "SCORABLE" as const },
  { id: "m-er-agonism", code: "ER_ALPHA_AGONISM", name: "ER-alpha agonism", scorePolicy: "SCORABLE" as const },
  { id: "m-er-expression", code: "ER_ALPHA_EXPRESSION", name: "ER-alpha expression", scorePolicy: "SCORABLE" as const },
  { id: "m-axis", code: "REP_ESTROGEN_RECEPTOR", name: "Estrogen receptor axis", scorePolicy: "GROUPING_ONLY" as const },
];
const outcomes = [
  { code: "REDUCED_SPERM_MOTILITY", name: "Reduced sperm motility" },
  { code: "ENDOMETRIOSIS", name: "Endometriosis" },
];

const remap = buildRemapper({ mechanisms, outcomes, catalog: catalogFromRows(mechanisms) });

const claim = (over: Partial<Parameters<typeof remap>[0]> = {}) => ({
  objectText: "testosterone level",
  objectHead: null,
  relation: "DECREASES_LEVEL",
  mechanismCode: null,
  outcomeCode: null,
  ...over,
});

test("a curated synonym reaches a node the ontology does not spell", () => {
  const result = remap(claim());
  assert.equal(result.mechanismCode, "TESTOSTERONE");
  assert.equal(result.mappingState, "CANDIDATE");
  assert.equal(result.changed, true);
});

test("a remap never clears a mapping it cannot verify", () => {
  // The first run of this would have cleared 15 good mappings. They were made from an object
  // head that rows written before that column existed do not record, so the remap can see
  // nothing to justify them -- and nothing to disprove them either.
  const kept = remap(claim({ objectText: "CYP19A1 expression", mechanismCode: "AROMATASE_CYP19A1" }));
  assert.equal(kept.mechanismCode, "AROMATASE_CYP19A1");
  assert.equal(kept.changed, false);

  // With the head recorded, the same claim resolves on its own merits.
  const resolved = remap(claim({ objectText: "CYP19A1 expression", objectHead: "CYP19A1" }));
  assert.equal(resolved.mechanismCode, "AROMATASE_CYP19A1");

  // An unmapped claim the vocabulary still cannot place stays unmapped rather than guessing.
  const gap = remap(claim({ objectText: "cloacal foam secretion frequency" }));
  assert.equal(gap.mechanismCode, null);
  assert.equal(gap.outcomeCode, null);
  assert.equal(gap.mappingState, "UNMAPPED");
});

test("one phrase reaches different nodes depending on what the claim says happened", () => {
  // Agonising a receptor and changing how much of it is present are different mechanisms.
  const agonism = remap(claim({ objectText: "estrogen receptor α (ERα)", relation: "AGONIZES" }));
  assert.equal(agonism.mechanismCode, "ER_ALPHA_AGONISM");

  const expression = remap(claim({ objectText: "estrogen receptor α (ERα)", relation: "INCREASES_LEVEL" }));
  assert.equal(expression.mechanismCode, "ER_ALPHA_EXPRESSION");

  // Binding is deliberately neither: which of the two it supports is a curator's call.
  const binding = remap(claim({ objectText: "estrogen receptor α (ERα)", relation: "BINDS" }));
  assert.equal(binding.mechanismCode, null);
});

test("a synonym cannot promote a grouping node into a claim target", () => {
  const resolver = buildSynonymResolver([
    { term: "steroidogenic enzymes", code: "REP_ESTROGEN_RECEPTOR", kind: "mechanism" },
  ]);
  assert.deepEqual(resolver.find("steroidogenic enzymes", "DECREASES_EXPRESSION"), {
    code: "REP_ESTROGEN_RECEPTOR",
    kind: "mechanism",
  });
  // The resolver offers it and the mechanism guards refuse it, so no curated entry can smuggle
  // a display node into the claim graph.
  const guarded = buildRemapper({
    mechanisms,
    outcomes,
    catalog: catalogFromRows(mechanisms),
  })(claim({ objectText: "ER-alpha agonism", relation: "AGONIZES" }));
  assert.equal(guarded.mechanismCode, "ER_ALPHA_AGONISM");
  const grouping = remap(claim({ objectText: "Estrogen receptor axis", relation: "AGONIZES" }));
  assert.equal(grouping.mechanismCode, null);
});

test("a directional synonym holds only the way its node runs", () => {
  const down = remap(claim({ objectText: "progressive motility", relation: "IMPAIRS_FUNCTION" }));
  assert.equal(down.outcomeCode, "REDUCED_SPERM_MOTILITY");
  const up = remap(claim({ objectText: "progressive motility", relation: "ENHANCES_FUNCTION" }));
  assert.equal(up.outcomeCode, null);

  // A falling share of normal forms is a rising share of abnormal ones, so that entry inverts.
  const inverted = claimSynonyms.find((entry) => entry.term === "sperm normal morphology rate");
  assert.equal(inverted?.direction, "down");
  assert.equal(inverted?.code, "ABNORMAL_SPERM_MORPHOLOGY");
});

test("every curated synonym names a code the seeds actually hold", async () => {
  // A typo in this table is otherwise silent: the term simply never maps, and the claim looks
  // like a gap in the ontology instead of a mistake in the crosswalk.
  const { mechanisms: mechanismSeeds } = await import("../../data/seeds/mechanisms");
  const { outcomeSeeds } = await import("../../data/seeds/outcomes");
  const mechanismCodes = new Set(mechanismSeeds.map((row) => row.code));
  const outcomeCodes = new Set(outcomeSeeds.map((row) => row.code));
  for (const entry of claimSynonyms) {
    const known = entry.kind === "mechanism" ? mechanismCodes.has(entry.code) : outcomeCodes.has(entry.code);
    assert.ok(known, `${entry.term} points at ${entry.kind} ${entry.code}, which is not seeded`);
  }
  // And the rejected row stays rejected: sperm concentration and total sperm count are
  // different measurements and were deliberately not folded into one outcome.
  for (const term of ["sperm concentration", "total sperm count", "epididymal sperm concentration"]) {
    assert.equal(
      claimSynonyms.some((entry) => entry.term === term),
      false,
      `${term} was rejected in the proposals and must not be in the table`,
    );
  }
});
