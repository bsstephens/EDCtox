import assert from "node:assert/strict";
import test from "node:test";

import { MESH_DOMAIN, MESH_NOT_A_DOMAIN, MESH_OUTCOME } from "../../data/seeds/meshCrosswalk";
import { domains } from "../../data/seeds/domains";
import { outcomeSeeds } from "../../data/seeds/outcomes";
import { EMPTY_PROVIDER_METADATA } from "./dedup";
import { providerFacts } from "./providerFacts";
import {
  OUTCOME_CATEGORY_DOMAIN,
  buildOntologyIndex,
  matchCompound,
  routeProfile,
  type CompoundRecord,
} from "./routing";

const compounds: CompoundRecord[] = [
  { slug: "bpa", displayName: "BPA", canonicalName: "Bisphenol A", casNumber: "80-05-7", aliases: ["Bisphenol A"] },
  { slug: "bps", displayName: "BPS", canonicalName: "Bisphenol S", casNumber: "80-09-1", aliases: ["Bisphenol S"] },
  { slug: "dehp", displayName: "DEHP", canonicalName: "Bis(2-ethylhexyl) phthalate", casNumber: "117-81-7", aliases: ["DEHP"] },
];

const ontology = buildOntologyIndex({
  outcomes: outcomeSeeds.map((row) => ({ name: row.name, category: row.category })),
  mechanisms: [{ name: "Insulin resistance", domainShortLabel: "MET" }],
  outcomeCategoryToDomain: OUTCOME_CATEGORY_DOMAIN,
});

function facts(descriptors: string[], substances: string[] = []) {
  return providerFacts({
    publicationTypes: ["journal article"],
    meshDescriptors: descriptors,
    meshSubstances: substances,
    indexedAt: "2025-01-01",
  });
}

test("a compound matches on an exact name, an alias or a registry number", () => {
  assert.equal(matchCompound("Bisphenol A", compounds)?.slug, "bpa");
  assert.equal(matchCompound("bisphenol a (BPA)", compounds)?.slug, "bpa");
  assert.equal(matchCompound("Bisphenol A Compounds", compounds)?.slug, "bpa");
  assert.equal(matchCompound("80-05-7", compounds)?.slug, "bpa");
  assert.equal(matchCompound("DEHP", compounds)?.slug, "dehp");
});

test("matching never slides from one bisphenol to another", () => {
  // A substring rule would match bisphenol S against bisphenol A, which is the single mistake
  // the keyword screener made most often.
  assert.equal(matchCompound("Bisphenol S", compounds)?.slug, "bps");
  assert.equal(matchCompound("bisphenol F", compounds), null);
  assert.equal(matchCompound("bisphenol", compounds), null);
  assert.equal(matchCompound("tetrabromobisphenol A", compounds), null);
});

test("an unmatched compound is reported, never forced onto the nearest record", () => {
  const result = routeProfile({
    profile: { compoundsStudied: ["bisphenol A", "triclosan"], outcomesReported: ["sperm count"], measuresOutcome: true },
    facts: facts(["Spermatozoa", "Humans"]),
    compounds,
    ontology,
  });
  assert.deepEqual(result.unmatchedCompounds, ["triclosan"]);
  assert.deepEqual([...new Set(result.contexts.map((c) => c.compoundSlug))], ["bpa"]);
});

test("routing emits one context per matched compound and domain, with its reason", () => {
  const result = routeProfile({
    profile: {
      compoundsStudied: ["bisphenol A", "DEHP"],
      outcomesReported: ["sperm count"],
      measuresOutcome: true,
    },
    facts: facts(["Spermatozoa", "Oxidative Stress", "Humans", "Male"]),
    compounds,
    ontology,
  });
  const pairs = result.contexts.map((c) => `${c.compoundSlug}:${c.domain}`).sort();
  assert.deepEqual(pairs, ["bpa:REDOX", "bpa:REP", "dehp:REDOX", "dehp:REP"]);
  const rep = result.contexts.find((c) => c.compoundSlug === "bpa" && c.domain === "REP");
  assert.ok(rep?.evidence.some((why) => why.includes("Spermatozoa")));
});

test("an exposure-only paper routes nowhere, however many compounds it names", () => {
  const result = routeProfile({
    profile: { compoundsStudied: ["bisphenol A", "DEHP"], outcomesReported: [], measuresOutcome: false },
    facts: facts(["Food Packaging", "Humans"]),
    compounds,
    ontology,
  });
  assert.equal(result.exposureOnly, true);
  assert.deepEqual(result.contexts, []);
});

test("an unindexed paper routes on its own words alone", () => {
  const result = routeProfile({
    profile: { compoundsStudied: ["bisphenol A"], outcomesReported: ["Insulin resistance"], measuresOutcome: true },
    facts: providerFacts(EMPTY_PROVIDER_METADATA),
    compounds,
    ontology,
  });
  assert.deepEqual(result.contexts.map((c) => c.domain), ["MET"]);
  assert.deepEqual(result.unmappedTerms, []);
});

test("an indexed term that is neither mapped nor excluded is an ontology gap", () => {
  const result = routeProfile({
    profile: { compoundsStudied: ["bisphenol A"], outcomesReported: [], measuresOutcome: true },
    facts: facts(["Spermatozoa", "Humans", "Hearing Loss, Noise-Induced"]),
    compounds,
    ontology,
  });
  // The known ones are silent; the unknown one surfaces.
  assert.deepEqual(result.unmappedTerms, ["Hearing Loss, Noise-Induced"]);
});

test("an endpoint routes to a domain and never invents a direction", () => {
  // MeSH "Sperm Count" names the endpoint. The EDCtox outcome names a direction, "Reduced sperm
  // count". Mapping one to the other would assert something the paper may never have said.
  assert.equal(MESH_DOMAIN["Sperm Count"], "REP");
  assert.equal(MESH_OUTCOME["Sperm Count"], undefined);
  assert.equal(MESH_OUTCOME["Polycystic Ovary Syndrome"], "PCOS");
  const directional = outcomeSeeds.filter((row) => /^(Reduced|Increased|Delayed|Early|Impaired|Altered)/.test(row.name));
  const codes = new Set(Object.values(MESH_OUTCOME));
  for (const outcome of directional) {
    assert.ok(!codes.has(outcome.code), `${outcome.code} names a direction and must not be routed to`);
  }
});

test("the crosswalk points only at domains and outcomes that exist", () => {
  const shortLabels = new Set(domains.map((row) => row.shortLabel as string));
  for (const [descriptor, domain] of Object.entries(MESH_DOMAIN)) {
    assert.ok(shortLabels.has(domain), `${descriptor} points at unknown domain ${domain}`);
  }
  const outcomeCodes = new Set(outcomeSeeds.map((row) => row.code));
  for (const [descriptor, code] of Object.entries(MESH_OUTCOME)) {
    assert.ok(outcomeCodes.has(code), `${descriptor} points at unknown outcome ${code}`);
  }
  // A descriptor cannot be both mapped and declared irrelevant.
  for (const descriptor of Object.keys(MESH_DOMAIN)) {
    assert.ok(!MESH_NOT_A_DOMAIN.has(descriptor), `${descriptor} is both mapped and excluded`);
  }
});

test("cancer outcomes route through a mechanism domain, never a cancer column", () => {
  // The ontology decision was outcomes only, no cancer domain. Routing must not invent one.
  // The domain type makes a "CANCER" column unrepresentable, so the runtime check is on the
  // seed: no domain exists for cancer, and the cancer outcome category maps to no column.
  assert.equal(OUTCOME_CATEGORY_DOMAIN.CANCER, undefined);
  assert.equal(
    domains.some((row) => row.shortLabel.includes("CAN") || row.code.includes("CANCER")),
    false,
  );
  const cancerDescriptors = Object.entries(MESH_OUTCOME).filter(([, code]) => code.endsWith("_CANCER"));
  assert.ok(cancerDescriptors.length > 0);
  for (const [descriptor, code] of cancerDescriptors) {
    // A cancer descriptor may carry a domain, and that domain is a mechanism domain such as REP.
    // It is a place to look for the biology, never a score column for the cancer itself.
    const domain = MESH_DOMAIN[descriptor];
    assert.ok(
      domain === undefined || domains.some((row) => row.shortLabel === domain),
      `${code} routes through ${domain ?? "no domain"}, which must be a real mechanism domain`,
    );
  }
});

test("a chemical descriptor is identity, not a missing domain concept", () => {
  // MeSH lists a chemical in both the descriptor list and the substance list. The first real run
  // produced a gap report whose top entries were all compound names, which buried the genuine
  // gaps. Identity is matched separately, so a descriptor that is also a substance is silent.
  const result = routeProfile({
    profile: { compoundsStudied: ["bisphenol A"], outcomesReported: [], measuresOutcome: true },
    facts: facts(
      ["Bisphenol A Compounds", "Phenols", "Spermatozoa", "Humans", "TOR Serine-Threonine Kinases"],
      ["Bisphenol A Compounds", "Phenols"],
    ),
    compounds,
    ontology,
  });
  // The chemicals are silent, and the genuinely missing concept still surfaces. mTOR is indexed
  // on stored papers and the ontology has no mechanism for it, so it is a real gap.
  assert.deepEqual(result.unmappedTerms, ["TOR Serine-Threonine Kinases"]);
});

test("every outcome mapping has a domain to route through", () => {
  // A descriptor with an outcome but no domain fell through to the gap list and its outcome was
  // never used, which is how the first real run reported "Breast Neoplasms" as a missing concept
  // while an outcome for it already existed.
  for (const descriptor of Object.keys(MESH_OUTCOME)) {
    assert.ok(
      MESH_DOMAIN[descriptor],
      `${descriptor} maps to an outcome but to no domain, so routing would drop it`,
    );
  }
});
