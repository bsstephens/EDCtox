import assert from "node:assert/strict";
import test from "node:test";

import { buildOutcomeLookup, claimDirection } from "./outcomeLookup";

// The real shape of the ontology: names carry a direction, and two of them share an entity.
const outcomes = [
  { code: "REDUCED_SPERM_COUNT", name: "Reduced sperm count" },
  { code: "REDUCED_SPERM_MOTILITY", name: "Reduced sperm motility" },
  { code: "REDUCED_TESTOSTERONE", name: "Reduced testosterone" },
  { code: "WEIGHT_GAIN", name: "Weight gain" },
  { code: "PCOS", name: "Polycystic ovary syndrome" },
  { code: "CRYPTORCHIDISM", name: "Cryptorchidism" },
  { code: "DELAYED_PUBERTY", name: "Delayed puberty" },
  { code: "EARLY_PUBERTY", name: "Early puberty" },
];

const lookup = buildOutcomeLookup(outcomes);

test("a directional outcome maps only in the direction it asserts", () => {
  // The ontology holds "Reduced sperm count", not "sperm count", so a claim that sperm count
  // fell is that outcome and a claim that it rose is not.
  assert.equal(lookup.find("sperm count", "down"), "REDUCED_SPERM_COUNT");
  assert.equal(lookup.find("sperm count", "up"), null);
  assert.equal(lookup.find("sperm motility", "down"), "REDUCED_SPERM_MOTILITY");
  // A trailing "gain" reads as an increase in the thing before it.
  assert.equal(lookup.find("weight", "up"), "WEIGHT_GAIN");
  assert.equal(lookup.find("weight", "down"), null);
  // The full name holds whatever the direction, because it states the direction itself.
  assert.equal(lookup.find("reduced sperm count", "up"), "REDUCED_SPERM_COUNT");
});

test("an outcome with no direction in its name maps on the name alone", () => {
  assert.equal(lookup.find("polycystic ovary syndrome", "up"), "PCOS");
  assert.equal(lookup.find("PCOS", "other"), "PCOS");
  assert.equal(lookup.find("cryptorchidism", "up"), "CRYPTORCHIDISM");
});

test("two outcomes sharing an entity lend their bare name to neither", () => {
  // "Delayed puberty" and "Early puberty" are opposite senses of one entity, and a delay is not
  // a decrease. Guessing between them would invent a claim the paper did not make.
  assert.equal(lookup.find("puberty", "down"), null);
  assert.equal(lookup.find("puberty", "up"), null);
  assert.equal(lookup.find("delayed puberty", "other"), "DELAYED_PUBERTY");
  assert.equal(lookup.find("early puberty", "other"), "EARLY_PUBERTY");
});

test("a term the ontology does not hold stays unmapped", () => {
  // These are real heads the model returned, and the ontology is written in clinical diagnoses
  // while abstracts report measurements. They must stay visible as gaps rather than be forced
  // onto the nearest neighbour.
  for (const term of [
    "sperm concentration",
    "semen volume",
    "progressive motility",
    "reproductive success",
    "fertilization rates",
    "oxidative stress",
  ]) {
    assert.equal(lookup.find(term, "down"), null, `${term} must not be forced onto an outcome`);
    assert.equal(lookup.find(term, "up"), null, `${term} must not be forced onto an outcome`);
  }
});

test("a reported absence of effect is never filed as the effect", () => {
  // NO_EFFECT asserts no direction, so it maps only on a full outcome name. Otherwise a claim
  // that BPA did not change sperm count would be stored as reduced sperm count.
  assert.equal(claimDirection("NO_EFFECT"), "other");
  assert.equal(lookup.find("sperm count", claimDirection("NO_EFFECT")), null);
});

test("contributing to an outcome is a claim that the outcome happens", () => {
  // A claim that an exposure contributes to reduced sperm count says the reduction occurs; it
  // is not a claim that sperm count rose.
  assert.equal(claimDirection("CONTRIBUTES_TO"), "up");
  assert.equal(claimDirection("ASSOCIATED_WITH"), "up");
  assert.equal(claimDirection("DECREASES_LEVEL"), "down");
  assert.equal(claimDirection("IMPAIRS_FUNCTION"), "down");
  assert.equal(claimDirection("INCREASES_EXPRESSION"), "up");
  assert.equal(claimDirection("BINDS"), "other");
  assert.equal(lookup.find("cryptorchidism", claimDirection("CONTRIBUTES_TO")), "CRYPTORCHIDISM");
});
