import assert from "node:assert/strict";
import test from "node:test";

import { compounds } from "../../data/seeds/compounds";
import { euIdentifiedCas, euIdentifiedEdcs } from "../../data/seeds/euIdentifiedEdcs";

test("every row on the European Union list has a well-formed registry number", () => {
  const cas = /^\d{2,7}-\d{2}-\d$/;
  for (const row of euIdentifiedEdcs) {
    assert.match(row.cas, cas, `${row.name} has a malformed registry number`);
    assert.ok(row.name.length > 2);
  }
  assert.ok(euIdentifiedEdcs.length > 100);
});

test("a compound is matched to the list by registry number and nothing else", () => {
  // Matching on a name would merge isomers, salts, and ethoxylate variants that the list keeps
  // apart. The registry number is the only key.
  const matched = compounds
    .filter((row) => row.casNumber && euIdentifiedCas.has(row.casNumber))
    .map((row) => row.slug)
    .sort();
  assert.deepEqual(matched, [
    "4-mbc",
    "4-nonylphenol",
    "4-tert-octylphenol",
    "bbp",
    "bpa",
    "bpb",
    "bps",
    "butylparaben",
    "dbp",
    "dehp",
    "dibp",
    "mancozeb",
    "propiconazole",
    "tphp",
  ]);
});

test("absence from the list is not a clearance, and no seed says otherwise", () => {
  // The 2026 assessment is explicit that most registered chemicals have never been evaluated.
  // An unlisted compound must not carry seed text implying it was assessed and found clear.
  const unlisted = compounds.filter((row) => !row.casNumber || !euIdentifiedCas.has(row.casNumber));
  assert.ok(unlisted.length > 100);
  const claimsClearance = /not an endocrine disruptor|cleared by|found safe|assessed as safe/i;
  for (const row of unlisted) {
    assert.doesNotMatch(row.description, claimsClearance, `${row.slug} implies a clearance`);
    assert.doesNotMatch(row.notes ?? "", claimsClearance, `${row.slug} implies a clearance`);
  }
});

test("4-MBC carries the registry number the list uses", () => {
  // Stereochemistry gives this substance several numbers. PubChem returns a different one first,
  // and matching on that would have missed the listing entirely.
  const mbc = compounds.find((row) => row.slug === "4-mbc");
  assert.equal(mbc?.casNumber, "36861-47-9");
  assert.ok(euIdentifiedCas.has("36861-47-9"));
});
