import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { externalAccessPolicy } from "../../data/seeds/externalDatasets";
import { applyIdentityPlans, type IdentityWriteClient } from "./applyIdentity";
import { parseCidList, parsePubChemProperties, parseRegistryNumbers } from "./adapters/pubchem";
import { parseCompToxChemicals } from "./adapters/comptox";
import { fetchJson, redactSecrets } from "./http";
import {
  isCacheStale,
  judgeCompTox,
  judgePubChem,
  skippedCompToxPlan,
  type LocalCompoundIdentity,
  type ProviderPlan,
} from "./identity";

const bpa: LocalCompoundIdentity = {
  slug: "bpa",
  canonicalName: "Bisphenol A",
  casNumber: "80-05-7",
  molecularFormula: "C15H16O2",
  inchi: null,
  inchiKey: null,
  canonicalSmiles: null,
  pubChemCid: null,
  molarMass: null,
};

const bpaCandidate = {
  cid: 6623,
  title: "Bisphenol A",
  iupacName: "4-[2-(4-hydroxyphenyl)propan-2-yl]phenol",
  inchi: "InChI=1S/C15H16O2",
  inchiKey: "IISBACLAFKSPIT-UHFFFAOYSA-N",
  smiles: "CC(C)(C1=CC=C(C=C1)O)C2=CC=C(C=C2)O",
  molecularFormula: "C15H16O2",
  molecularWeight: "228.29",
};

test("PubChem identity response parsing", () => {
  assert.deepEqual(parseCidList({ IdentifierList: { CID: [6623] } }), [6623]);
  assert.deepEqual(parseCidList({ Fault: { Code: "PUGREST.NotFound" } }), []);
  const parsed = parsePubChemProperties({
    PropertyTable: {
      Properties: [
        {
          CID: 6623,
          Title: "Bisphenol A",
          InChIKey: "IISBACLAFKSPIT-UHFFFAOYSA-N",
          MolecularFormula: "C15H16O2",
          MolecularWeight: "228.29",
          SMILES: "CC(C)(C1=CC=C(C=C1)O)C2=CC=C(C=C2)O",
        },
      ],
    },
  });
  assert.equal(parsed?.cid, 6623);
  assert.equal(parsed?.smiles?.startsWith("CC(C)"), true);
  assert.deepEqual(parseRegistryNumbers({ InformationList: { Information: [{ RN: ["80-05-7"] }] } }), ["80-05-7"]);
  assert.deepEqual(parseCompToxChemicals([{ dtxsid: "DTXSID0000000", casrn: "80-05-7", preferredName: "Bisphenol A" }]), [
    { dtxsid: "DTXSID0000000", casrn: "80-05-7", preferredName: "Bisphenol A" },
  ]);
});

test("a single matching PubChem record can be verified and can fill empty structure fields", () => {
  const plan = judgePubChem(bpa, {
    queryCas: "80-05-7",
    candidates: [bpaCandidate],
    registryNumbers: ["80-05-7"],
  });
  assert.equal(plan.status, "VERIFIED");
  assert.equal(plan.selectedExternalId, "6623");
  assert.equal(plan.identifiers.some((identifier) => identifier.namespace === "PUBCHEM_CID"), true);
  assert.equal(plan.fieldDecisions.find((decision) => decision.field === "inchiKey")?.action, "fill");
  assert.equal(plan.fieldDecisions.find((decision) => decision.field === "molecularFormula")?.action, "keep");
});

test("several PubChem CIDs for one CAS stay unresolved", () => {
  const plan = judgePubChem(
    {
      ...bpa,
      slug: "dehp",
      canonicalName: "Bis(2-ethylhexyl) phthalate",
      casNumber: "117-81-7",
      molecularFormula: "C24H38O4",
    },
    {
      queryCas: "117-81-7",
      registryNumbers: [],
      candidates: [
        { ...bpaCandidate, cid: 8343, title: "Di(2-ethylhexyl) phthalate", molecularFormula: "C24H38O4" },
        { ...bpaCandidate, cid: 8346, title: "di-N-Octyl Phthalate", molecularFormula: "C24H38O4", inchiKey: "MQIUGAXCHLFZKX-UHFFFAOYSA-N" },
      ],
    },
  );
  assert.equal(plan.status, "AMBIGUOUS");
  assert.equal(plan.selectedExternalId, null);
  assert.deepEqual(plan.candidateIds, ["8343", "8346"]);
  assert.equal(plan.identifiers.length, 0);
});

test("a salt or differently named substance is not accepted as the local compound", () => {
  const plan = judgePubChem(
    {
      ...bpa,
      slug: "pfos",
      canonicalName: "Perfluorooctane sulfonic acid",
      casNumber: "1763-23-1",
      molecularFormula: "C8HF17O3S",
    },
    {
      queryCas: "1763-23-1",
      registryNumbers: ["1763-23-1"],
      candidates: [{ ...bpaCandidate, cid: 74483, title: "Perfluorooctanesulfonic acid potassium salt", molecularFormula: "C8HF17O3S" }],
    },
  );
  assert.equal(plan.status, "MANUAL_REVIEW_REQUIRED");
  assert.equal(plan.identifiers.length, 0);
});

test("a conflicting InChIKey does not propose an overwrite", () => {
  const plan = judgePubChem(
    { ...bpa, inchiKey: "CONFLICTING-KEY-UHFFFAOYSA-N" },
    { queryCas: "80-05-7", candidates: [bpaCandidate], registryNumbers: ["80-05-7"] },
  );
  assert.equal(plan.status, "CONFLICT");
  assert.equal(plan.identifiers.length, 0);
  assert.equal(plan.fieldDecisions.find((decision) => decision.field === "inchiKey")?.action, "conflict");
});

test("a missing EPA key skips CompTox without inventing a DTXSID", () => {
  const plan = skippedCompToxPlan("80-05-7");
  assert.equal(plan.skipped, true);
  assert.equal(plan.identifiers.length, 0);
  assert.match(plan.reason, /EPA_CTX_API_KEY/);
  assert.equal(plan.reason.includes("DTXSID7020182"), false);
});

test("CompTox agreement can verify a DTXSID returned by the provider", () => {
  const plan = judgeCompTox(bpa, "80-05-7", [{ dtxsid: "DTXSID0000000", casrn: "80-05-7", preferredName: "Bisphenol A" }]);
  assert.equal(plan.status, "VERIFIED");
  assert.equal(plan.selectedExternalId, "DTXSID0000000");
  assert.equal(plan.canonicalUrl, "https://comptox.epa.gov/dashboard/chemical/details/DTXSID0000000");
});

test("cached identity is stale only after its expiry", () => {
  const retrieved = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(isCacheStale(new Date("2026-02-01T00:00:00.000Z"), retrieved), false);
  assert.equal(isCacheStale(new Date("2025-12-01T00:00:00.000Z"), retrieved), true);
});

test("applying a resolution writes identifiers and does not touch mechanism scores", async () => {
  const source = readFileSync(new URL("./applyIdentity.ts", import.meta.url), "utf8");
  assert.equal(source.includes("mechanismAssessment"), false);
  const calls: string[] = [];
  const db: IdentityWriteClient = {
    externalDataset: {
      async findUnique() {
        return { id: "dataset" };
      },
    },
    externalImportRun: {
      async create() {
        calls.push("run");
        return { id: "run" };
      },
      async update(args) {
        calls.push(`status:${String(args.data.status)}`);
      },
    },
    identityResolutionAttempt: {
      async create() {
        calls.push("attempt");
      },
    },
    externalIdentifier: {
      async findUnique() {
        return null;
      },
      async upsert() {
        calls.push("identifier");
      },
    },
    externalRecord: {
      async upsert() {
        calls.push("record");
      },
    },
    compound: {
      async update(args) {
        calls.push(`compound:${String(args.data.inchiKey)}`);
      },
    },
  };
  const verified = judgePubChem(bpa, { queryCas: "80-05-7", candidates: [bpaCandidate], registryNumbers: ["80-05-7"] });
  const ambiguous: ProviderPlan = {
    ...verified,
    providerCode: "EPA_COMPTOX",
    status: "AMBIGUOUS",
    identifiers: [],
    fieldDecisions: [],
    cache: null,
    selectedExternalId: null,
  };
  const result = await applyIdentityPlans(db, { id: "compound", slug: "bpa" }, [verified, ambiguous]);
  assert.equal(result.identifiersWritten, verified.identifiers.length);
  assert.equal(calls.includes("identifier"), true);
  assert.equal(calls.includes("compound:IISBACLAFKSPIT-UHFFFAOYSA-N"), true);
  assert.equal(calls.filter((call) => call.startsWith("status:")).includes("status:PARTIAL"), true);
  assert.equal(calls.some((call) => call.toLowerCase().includes("score")), false);
});

test("provider errors redact secrets and retry a transient status", async () => {
  assert.equal(redactSecrets("key sk_test failed", ["sk_test"]), "key [redacted] failed");
  let attempts = 0;
  const body = await fetchJson("https://pubchem.example/compound", {
    retries: 1,
    sleep: async () => undefined,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(body, { ok: true });
});

test("the compound page and provider registry do not fetch during render", () => {
  const page = readFileSync(new URL("../../app/compounds/[slug]/page.tsx", import.meta.url), "utf8");
  const providers = readFileSync(new URL("./providers.ts", import.meta.url), "utf8");
  assert.equal(page.includes("lookupPubChemByCas"), false);
  assert.equal(page.includes("lookupCompToxByCas"), false);
  assert.equal(page.includes("fetch("), false);
  assert.equal(providers.includes("fetch("), false);
  assert.equal(externalAccessPolicy.PUBCHEM.accessMode, "LIVE_API");
  assert.equal(externalAccessPolicy.PUBCHEM.requiresApiKey, false);
  assert.equal(externalAccessPolicy.EPA_COMPTOX.requiresApiKey, true);
  assert.equal(externalAccessPolicy.ECHA_CHEM.accessMode, "LINK_ONLY");
  assert.equal(externalAccessPolicy.AICIS.accessMode, "BULK_REFERENCE");
});

test("regulatory and assay records still have no effect score", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const assay = schema.slice(schema.indexOf("model AssayObservation"), schema.indexOf("enum GlpStatus"));
  const regulatory = schema.slice(schema.indexOf("model RegulatoryAssessment"), schema.indexOf("model AssessmentRevision"));
  assert.equal(assay.includes("effectScore"), false);
  assert.equal(regulatory.includes("effectScore"), false);
  assert.match(schema, /model IdentityResolutionAttempt/);
  assert.equal(schema.includes("isStale"), false);
});
