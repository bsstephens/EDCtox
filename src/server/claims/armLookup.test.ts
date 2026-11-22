import assert from "node:assert/strict";
import test from "node:test";

import { buildArmLookup } from "./armLookup";

// The real candidate set for a glyphosate run: itself, the formulation it is an active
// ingredient of, and its metabolite.
const candidates = [
  { compoundId: "c-gly", slug: "glyphosate", canonicalName: "Glyphosate", displayName: "Glyphosate", recordKind: "SPECIFIC_COMPOUND", aliases: ["N-(phosphonomethyl)glycine"] },
  {
    compoundId: "c-gbh",
    slug: "glyphosate-based-herbicide",
    canonicalName: "Glyphosate-based herbicide formulation",
    displayName: "Glyphosate-based herbicide",
    recordKind: "FORMULATION",
    aliases: ["glyphosate-based herbicide", "glyphosate-based herbicides", "GBH", "GBHs"],
  },
  { compoundId: "c-ampa", slug: "ampa", canonicalName: "Aminomethylphosphonic acid", displayName: "AMPA", recordKind: "SPECIFIC_COMPOUND", aliases: ["aminomethylphosphonic acid"] },
];

const arms = buildArmLookup(candidates);

test("a formulation arm resolves to the formulation, not the active ingredient", () => {
  // The whole point. A 2017 paper found glyphosate alone had no effect on bovine granulosa cell
  // estradiol while the Roundup formulation dramatically decreased it, and both were filed
  // against glyphosate because a claim could not say which arm it came from.
  assert.equal(arms.find("glyphosate-based herbicide"), "c-gbh");
  assert.equal(arms.find("GBH"), "c-gbh");
  assert.equal(arms.find("the glyphosate-based herbicide formulation"), "c-gbh");
  assert.equal(arms.find("glyphosate"), "c-gly");
  assert.equal(arms.find("glyphosate alone"), "c-gly");
});

test("the longest matching name wins, or every formulation would read as its ingredient", () => {
  // "glyphosate-based herbicide" contains "glyphosate". Shortest-first would send every
  // formulation arm to the active ingredient, which is the error this exists to prevent.
  assert.equal(arms.find("glyphosate-based herbicides (GBHs)"), "c-gbh");
});

test("a metabolite arm resolves to the metabolite", () => {
  assert.equal(arms.find("aminomethylphosphonic acid"), "c-ampa");
  // AMPA has no "AMPA" alias on purpose, because in neuroscience that abbreviation is a
  // glutamate receptor agonist. Inside the arms of a glyphosate study there is no such
  // ambiguity, and the closed candidate set is what makes matching the display name safe here.
  assert.equal(arms.find("AMPA"), "c-ampa");
});

test("a phrase naming nothing in the set is reported, not guessed at", () => {
  assert.equal(arms.find("polyethoxylated tallow amine"), null);
  assert.equal(arms.find("glufosinate"), null);
  assert.equal(arms.find(""), null);
  const unresolved = arms.unresolved();
  assert.equal(unresolved.get("polyethoxylated tallow amine"), 1);
  assert.equal(unresolved.get("glufosinate"), 1);
  // An empty phrase is the common, correct answer and is not reported as a failure.
  assert.equal(unresolved.has(""), false);
});

test("a brand name is read as a formulation, not matched as an identity", () => {
  // The failure this rule came from: the model read the 2017 paper's arms perfectly, as
  // "glyphosate alone" and "glyphosate-Roundup", and both resolved to glyphosate because
  // "glyphosate-Roundup" contains the key "glyphosate". A formulation arm filed as the active
  // ingredient is the exact error per-arm claims exist to prevent.
  assert.equal(arms.find("glyphosate-Roundup"), "c-gbh");
  assert.equal(arms.find("Roundup"), "c-gbh");
  assert.equal(arms.find("Roundup®"), "c-gbh");
  assert.equal(arms.find("Glyfonova"), "c-gbh");
  assert.equal(arms.find("commercial formulations"), "c-gbh");
  assert.equal(arms.find("the pesticide mixture"), "c-gbh");

  // "Roundup" is still not an alias of that record, deliberately. The NIEHS review notes that
  // formulation composition is confidential, varies by region and has changed over time,
  // sometimes with chemically different products under one brand, so the brand is not a
  // chemical identity. It is evidence the arm was a formulation, and machineArmText keeps what
  // the paper actually named.
  assert.equal(
    candidates.find((row) => row.slug === "glyphosate-based-herbicide")?.aliases.includes("Roundup"),
    false,
  );

  // The pure substance still resolves to the pure record.
  assert.equal(arms.find("glyphosate alone"), "c-gly");
  assert.equal(arms.find("glyphosate"), "c-gly");
});

test("a formulation phrase with no shell in the set stays unresolved", () => {
  // Without a formulation record there is nothing to file a product arm against, and inventing
  // one would be worse than reporting it.
  const noShell = buildArmLookup([
    { compoundId: "c-bpa", slug: "bpa", canonicalName: "Bisphenol A", displayName: "BPA", recordKind: "SPECIFIC_COMPOUND", aliases: [] },
  ]);
  assert.equal(noShell.find("the commercial product"), null);
  assert.equal(noShell.unresolved().get("the commercial product"), 1);
});
