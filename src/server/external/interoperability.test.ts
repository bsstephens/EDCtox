import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { externalDatasets } from "../../data/seeds/externalDatasets";
import { importProvider } from "./providers";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const providers = readFileSync(new URL("./providers.ts", import.meta.url), "utf8");

const REQUIRED_CODES = [
  "EPA_COMPTOX",
  "EPA_TOXCAST",
  "EPA_TOXREFDB",
  "EPA_TOXVALDB",
  "EPA_EDSP",
  "EU_EASIS",
  "ECHA_CHEM",
  "EFSA_OPENFOODTOX",
  "NIEHS_CEBS",
  "OECD_ECHEMPORTAL",
  "OECD_OHT_IUCLID",
  "OECD_AOP_WIKI",
  "AICIS",
  "APVMA_PUBCRIS",
  "PUBCHEM",
];

test("provider metadata covers the planned sources and does not invent records", () => {
  assert.deepEqual(
    externalDatasets.map((dataset) => dataset.code),
    REQUIRED_CODES,
  );
  for (const dataset of externalDatasets) {
    assert.equal(dataset.licence.includes("does not clear"), true);
    assert.match(dataset.notes, /No records have been imported/);
    assert.equal(dataset.roles.length > 0, true);
  }
  const aicis = externalDatasets.find((dataset) => dataset.code === "AICIS");
  assert.match(aicis?.description ?? "", /not a toxicity assessment/);
  assert.match(aicis?.description ?? "", /not a statement of safety/);
  const oht = externalDatasets.find((dataset) => dataset.code === "OECD_OHT_IUCLID");
  assert.match(oht?.description ?? "", /not a substance inventory/);
  const toxcast = externalDatasets.find((dataset) => dataset.code === "EPA_TOXCAST");
  assert.match(toxcast?.description ?? "", /not an adverse outcome/);
  const echa = externalDatasets.find((dataset) => dataset.code === "ECHA_CHEM");
  assert.match(echa?.description ?? "", /different statement from endocrine activity/);
});

test("assay observations cannot carry an effect score or write an assessment", () => {
  const assay = schema.slice(schema.indexOf("model AssayObservation"), schema.indexOf("enum GlpStatus"));
  assert.equal(assay.includes("effectScore"), false);
  assert.equal(assay.includes("MechanismAssessment"), false);
  assert.equal(assay.includes("CompoundOutcomeAssessment"), false);
  assert.match(assay, /hitCall\s+Boolean\?/);
  assert.match(schema, /A hit is not an adverse effect/);
});

test("compound identifiers are not publication or AOP keys", () => {
  const namespace = schema.slice(
    schema.indexOf("enum ExternalIdentifierNamespace"),
    schema.indexOf("model ExternalIdentifier"),
  );
  assert.equal(namespace.includes("DOI"), false);
  assert.equal(namespace.includes("PMID"), false);
  assert.equal(namespace.includes("AOP_ID"), false);
  assert.match(schema, /@@unique\(\[namespace, value, compoundId\]\)/);
  assert.match(schema, /disputed\s+Boolean\s+@default\(false\)/);
});

test("Klimisch reliability stays separate from study quality", () => {
  assert.match(schema, /enum KlimischReliability/);
  assert.match(schema, /enum StudyQuality/);
  assert.match(schema, /They are not copied into StudyQuality/);
  const finding = schema.slice(schema.indexOf("model EvidenceFinding"), schema.indexOf("model EvidenceMeasurement"));
  assert.match(finding, /studyQuality\s+StudyQuality/);
  assert.equal(finding.includes("klimisch"), false);
});

test("regulatory conclusions can be stored without a mechanism score", () => {
  assert.match(schema, /enum RegulatoryConclusionKind/);
  assert.match(schema, /INVENTORY_LISTING/);
  assert.match(schema, /ED_CONCLUSION/);
  assert.match(schema, /ED_ACTIVITY_ONLY/);
  assert.match(schema, /enum ReferenceDoseKind/);
  const regulatory = schema.slice(
    schema.indexOf("model RegulatoryAssessment"),
    schema.indexOf("model AssessmentRevision"),
  );
  assert.equal(regulatory.includes("effectScore"), false);
  assert.match(regulatory, /externalRecordId/);
});

test("ontology mappings require a local target and are not assessments", () => {
  const mapping = schema.slice(
    schema.indexOf("model ExternalOntologyMapping"),
    schema.indexOf("model AssayObservation"),
  );
  assert.equal(mapping.includes("effectScore"), false);
  assert.match(schema, /ExternalOntologyMapping_one_target/);
});

test("the provider stub does not call the network", () => {
  assert.equal(providers.includes("fetch("), false);
  assert.equal(providers.includes("http"), false);
  assert.throws(() => importProvider("EPA_TOXCAST"), /does not call external networks/);
  assert.throws(() => importProvider("not-a-source"), /not a registered/);
});
