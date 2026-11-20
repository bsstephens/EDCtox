import assert from "node:assert/strict";
import test from "node:test";

import { CLASS_TERM_PLACEHOLDER, MESH_DOMAIN, MESH_NOT_A_DOMAIN, MESH_OUTCOME } from "../../data/seeds/meshCrosswalk";
import { domains } from "../../data/seeds/domains";
import { outcomeSeeds } from "../../data/seeds/outcomes";
import { EMPTY_PROVIDER_METADATA } from "./dedup";
import { providerFacts } from "./providerFacts";
import {
  OUTCOME_CATEGORY_DOMAIN,
  routedOnModelAlone,
  buildOntologyIndex,
  matchCompound,
  routeProfile,
  type CompoundRecord,
} from "./routing";

const compounds: CompoundRecord[] = [
  { slug: "bpa", displayName: "BPA", canonicalName: "Bisphenol A", casNumber: "80-05-7", aliases: ["Bisphenol A"], recordKind: "SPECIFIC_COMPOUND" },
  { slug: "bps", displayName: "BPS", canonicalName: "Bisphenol S", casNumber: "80-09-1", aliases: ["Bisphenol S"], recordKind: "SPECIFIC_COMPOUND" },
  { slug: "dehp", displayName: "DEHP", canonicalName: "Bis(2-ethylhexyl) phthalate", casNumber: "117-81-7", aliases: ["DEHP"], recordKind: "SPECIFIC_COMPOUND" },
];


function slugOf(match: ReturnType<typeof matchCompound>): string | null {
  return match.kind === "specific" || match.kind === "class" ? match.record.slug : null;
}

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
  assert.equal(slugOf(matchCompound("Bisphenol A", compounds)), "bpa");
  assert.equal(slugOf(matchCompound("bisphenol a (BPA)", compounds)), "bpa");
  assert.equal(slugOf(matchCompound("Bisphenol A Compounds", compounds)), "bpa");
  assert.equal(slugOf(matchCompound("80-05-7", compounds)), "bpa");
  assert.equal(slugOf(matchCompound("DEHP", compounds)), "dehp");
});

test("matching never slides from one bisphenol to another", () => {
  // A substring rule would match bisphenol S against bisphenol A, which is the single mistake
  // the keyword screener made most often.
  assert.equal(slugOf(matchCompound("Bisphenol S", compounds)), "bps");
  assert.equal(slugOf(matchCompound("bisphenol F", compounds)), null);
  assert.equal(slugOf(matchCompound("bisphenol", compounds)), null);
  assert.equal(slugOf(matchCompound("tetrabromobisphenol A", compounds)), null);
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

test("a class term can only ever reach a placeholder", () => {
  const withClass: CompoundRecord[] = [
    ...compounds,
    { slug: "parabens", displayName: "Parabens", canonicalName: "Parabens", casNumber: null, aliases: [], recordKind: "CLASS_PLACEHOLDER" },
    { slug: "butylparaben", displayName: "Butylparaben", canonicalName: "Butyl 4-hydroxybenzoate", casNumber: "94-26-8", aliases: ["Butylparaben"], recordKind: "SPECIFIC_COMPOUND" },
  ];
  // The class reaches the placeholder and stops. It must not pull in the member, because a paper
  // about parabens as a class is not a paper about butylparaben.
  const asClass = matchCompound("parabens", withClass);
  assert.equal(asClass.kind, "class");
  assert.equal(asClass.kind === "class" ? asClass.record.slug : null, "parabens");
  // The member is still reachable by its own name.
  assert.equal(slugOf(matchCompound("Butylparaben", withClass)), "butylparaben");
});

test("a class with no placeholder is a distinct kind of gap", () => {
  // "phthalates" is a recognised class and EDCtox has no record for it. That is a different
  // problem from an unrecognised chemical name, and it must not quietly match DEHP.
  const result = routeProfile({
    profile: { compoundsStudied: ["phthalates", "bisphenol A", "wibblium"], outcomesReported: [], measuresOutcome: true },
    facts: facts(["Spermatozoa", "Humans"]),
    compounds,
    ontology,
  });
  assert.deepEqual(result.unmatchedClasses, ["phthalates"]);
  assert.deepEqual(result.unmatchedCompounds, ["wibblium"]);
  assert.deepEqual([...new Set(result.contexts.map((c) => c.compoundSlug))], ["bpa"]);
});

test("no class term is also a specific compound name", () => {
  // A term in both tables would make matching depend on which check ran first.
  const specific = new Set(
    compounds.filter((row) => row.recordKind === "SPECIFIC_COMPOUND").flatMap((row) => [
      row.displayName.toLowerCase(),
      row.canonicalName.toLowerCase(),
    ]),
  );
  for (const term of Object.keys(CLASS_TERM_PLACEHOLDER)) {
    assert.ok(!specific.has(term), `${term} is both a class term and a specific compound name`);
  }
});

test("the model's domains are used only when the provider gives none", () => {
  // Indexed: the provider decides and the model's tags are not consulted, because an indexer's
  // controlled vocabulary is the firmer basis.
  const indexed = routeProfile({
    profile: {
      compoundsStudied: ["bisphenol A"],
      outcomesReported: [],
      measuresOutcome: true,
      domainsBorneOn: ["MET", "MITO"],
    },
    facts: facts(["Spermatozoa", "Humans"]),
    compounds,
    ontology,
  });
  assert.deepEqual(indexed.contexts.map((c) => c.domain).sort(), ["REP"]);

  // Not indexed: the model is the only source, so it is used, and the reason says so.
  const unindexed = routeProfile({
    profile: {
      compoundsStudied: ["bisphenol A"],
      outcomesReported: [],
      measuresOutcome: true,
      domainsBorneOn: ["MET", "MITO"],
    },
    facts: providerFacts(EMPTY_PROVIDER_METADATA),
    compounds,
    ontology,
  });
  assert.deepEqual(unindexed.contexts.map((c) => c.domain).sort(), ["MET", "MITO"]);
  assert.ok(unindexed.contexts.every((c) => c.evidence.some((why) => why.includes("not indexed"))));
  assert.equal(routedOnModelAlone(unindexed.contexts), true);
  assert.equal(routedOnModelAlone(indexed.contexts), false);
});
