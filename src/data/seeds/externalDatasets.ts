const LICENCE = "See the provider's terms. This seed does not clear the data for redistribution.";
const NOT_SYNCED = "Registry metadata only. No records have been imported. Confirm the access path and licence before any download.";

export type ExternalDatasetSeed = {
  code: string;
  name: string;
  organisation: string;
  jurisdiction: string;
  description: string;
  baseUrl: string;
  documentationUrl?: string;
  apiUrl?: string;
  accessType: "API" | "BULK_DOWNLOAD" | "WEB_ONLY" | "FEDERATED_PORTAL" | "MANUAL_CURATED" | "UNKNOWN";
  roles: Array<
    | "IDENTITY"
    | "STRUCTURE"
    | "ASSAY"
    | "IN_VIVO"
    | "REGULATORY"
    | "EXPOSURE"
    | "ENDOCRINE"
    | "FEDERATED"
    | "STUDY_FORMAT"
    | "ONTOLOGY"
  >;
  licence: string;
  notes: string;
};

export const externalDatasets: ExternalDatasetSeed[] = [
  {
    code: "EPA_COMPTOX",
    name: "EPA CompTox Chemicals Dashboard",
    organisation: "US Environmental Protection Agency",
    jurisdiction: "United States",
    description:
      "Chemical identity and structure (DSSTox), with links into assay, in vivo, and exposure collections. A CompTox record is a crosswalk and a data source. It is not an EDCtox domain score.",
    baseUrl: "https://comptox.epa.gov/dashboard",
    documentationUrl: "https://www.epa.gov/comptox-tools/comptox-chemicals-dashboard",
    accessType: "API",
    roles: ["IDENTITY", "STRUCTURE", "ASSAY", "EXPOSURE"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Bulk files are also published. DTXSID is the preferred substance anchor from this source.`,
  },
  {
    code: "EPA_TOXCAST",
    name: "EPA ToxCast / Tox21",
    organisation: "US Environmental Protection Agency",
    jurisdiction: "United States",
    description:
      "High-throughput assay bioactivity. A hit call is evidence that an assay responded. It is not an adverse outcome and it is not a human endocrine-disruption score.",
    baseUrl: "https://www.epa.gov/chemical-research/toxicity-forecaster-toxcasttm-data",
    documentationUrl: "https://www.epa.gov/chemical-research/exploring-toxcast-data",
    accessType: "BULK_DOWNLOAD",
    roles: ["ASSAY"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Cytotoxicity and other QC flags stay on the assay observation.`,
  },
  {
    code: "EPA_TOXREFDB",
    name: "EPA ToxRefDB",
    organisation: "US Environmental Protection Agency",
    jurisdiction: "United States",
    description:
      "In vivo animal toxicity studies and treatment-related effects. A ToxRefDB endpoint can later become an evidence finding. It does not arrive as a curated EDCtox assessment.",
    baseUrl: "https://www.epa.gov/chemical-research/toxrefdb-database",
    accessType: "BULK_DOWNLOAD",
    roles: ["IN_VIVO"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "EPA_TOXVALDB",
    name: "EPA ToxValDB",
    organisation: "US Environmental Protection Agency",
    jurisdiction: "United States",
    description:
      "Curated toxicity values and points of departure drawn from many study types. A ToxVal number is a source value with its own critical effect. It is not an EDCtox effect score.",
    baseUrl: "https://www.epa.gov/chemical-research/toxicity-values-database-toxvaldb",
    accessType: "BULK_DOWNLOAD",
    roles: ["IN_VIVO", "REGULATORY"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "EPA_EDSP",
    name: "EPA EDSP endocrine models",
    organisation: "US Environmental Protection Agency",
    jurisdiction: "United States",
    description:
      "Endocrine pathway models, including estrogen, androgen, and thyroid models, plus CERAPP and CoMPARA consensus predictions. A model output is stored as a model-derived assay observation. It is not a measured result unless the source says so.",
    baseUrl: "https://www.epa.gov/endocrine-disruption",
    documentationUrl: "https://comptox.epa.gov/dashboard",
    accessType: "WEB_ONLY",
    roles: ["ENDOCRINE", "ASSAY"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Model name stays on the observation. There is no separate yes/no column per model.`,
  },
  {
    code: "EU_EASIS",
    name: "EU EASIS",
    organisation: "European Commission Joint Research Centre",
    jurisdiction: "European Union",
    description:
      "Endocrine-active substance information and study entries used as external evidence. An EASIS study entry is not, by itself, an EDCtox mechanism score.",
    baseUrl: "https://easis.jrc.ec.europa.eu/",
    accessType: "WEB_ONLY",
    roles: ["ENDOCRINE", "REGULATORY"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "ECHA_CHEM",
    name: "ECHA CHEM",
    organisation: "European Chemicals Agency",
    jurisdiction: "European Union",
    description:
      "Substance identity and regulatory assessments, including endocrine-disruptor conclusions. An authority conclusion that a substance is an endocrine disruptor is a regulatory result. It is a different statement from endocrine activity in an assay.",
    baseUrl: "https://chem.echa.europa.eu/",
    documentationUrl: "https://echa.europa.eu/information-on-chemicals",
    accessType: "WEB_ONLY",
    roles: ["IDENTITY", "REGULATORY", "ENDOCRINE"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Store the conclusion kind explicitly. Do not fold endocrine activity and an ED conclusion into one status.`,
  },
  {
    code: "EFSA_OPENFOODTOX",
    name: "EFSA OpenFoodTox",
    organisation: "European Food Safety Authority",
    jurisdiction: "European Union",
    description:
      "Structured hazard and risk values such as ADI, TDI, and ARfD, with the critical endpoint and population basis when the source gives them. These values belong on the regulatory row, with provenance.",
    baseUrl: "https://www.efsa.europa.eu/en/data/chemical-hazards-database",
    accessType: "BULK_DOWNLOAD",
    roles: ["REGULATORY"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "NIEHS_CEBS",
    name: "NIEHS CEBS",
    organisation: "National Institute of Environmental Health Sciences",
    jurisdiction: "United States",
    description:
      "Chemical Effects in Biological Systems. Detailed experimental study data. A CEBS accession identifies a study record, not a compound structure key.",
    baseUrl: "https://cebs.niehs.nih.gov/",
    accessType: "WEB_ONLY",
    roles: ["IN_VIVO", "ASSAY"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Study accessions stay on the external record. They are not compound identifiers.`,
  },
  {
    code: "OECD_ECHEMPORTAL",
    name: "OECD eChemPortal",
    organisation: "Organisation for Economic Co-operation and Development",
    jurisdiction: "International",
    description:
      "Federated discovery portal across participating chemical databases. A portal hit is a pointer to a source. It is not itself the study.",
    baseUrl: "https://www.echemportal.org/",
    accessType: "FEDERATED_PORTAL",
    roles: ["FEDERATED"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "OECD_OHT_IUCLID",
    name: "OECD Harmonised Templates / IUCLID",
    organisation: "Organisation for Economic Co-operation and Development",
    jurisdiction: "International",
    description:
      "A study-reporting format, not a substance inventory. EDCtox keeps the high-value template fields (guideline, GLP, Klimisch reliability, purpose, strain, assay system, comparator) and leaves species, sex, dose, tissue, and statistics on the existing finding tables.",
    baseUrl: "https://www.oecd.org/en/topics/sub-issues/assessment-of-chemicals/harmonised-templates.html",
    documentationUrl: "https://iuclid6.echa.europa.eu/",
    accessType: "MANUAL_CURATED",
    roles: ["STUDY_FORMAT"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Klimisch reliability is stored separately from EDCtox study quality.`,
  },
  {
    code: "OECD_AOP_WIKI",
    name: "OECD AOP-Wiki",
    organisation: "Organisation for Economic Co-operation and Development",
    jurisdiction: "International",
    description:
      "Adverse outcome pathways, molecular initiating events, key events, and adverse outcomes. A mapping from an EDCtox mechanism or pathway is a crosswalk. It does not mean every linked chemical causes the adverse outcome.",
    baseUrl: "https://aopwiki.org/",
    accessType: "WEB_ONLY",
    roles: ["ONTOLOGY"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} No AOP mappings are seeded in this phase.`,
  },
  {
    code: "AICIS",
    name: "AICIS industrial chemicals inventory",
    organisation: "Australian Industrial Chemicals Introduction Scheme",
    jurisdiction: "Australia",
    description:
      "Australian industrial-chemical identity and inventory status. Listing means the chemical is available for industrial introduction under AICIS. It is not a toxicity assessment and it is not a statement of safety.",
    baseUrl: "https://www.industrialchemicals.gov.au/",
    documentationUrl: "https://www.industrialchemicals.gov.au/search-inventory",
    accessType: "WEB_ONLY",
    roles: ["IDENTITY", "REGULATORY"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} Inventory presence is stored as an inventory listing, not as a hazard value.`,
  },
  {
    code: "APVMA_PUBCRIS",
    name: "APVMA PubCRIS",
    organisation: "Australian Pesticides and Veterinary Medicines Authority",
    jurisdiction: "Australia",
    description:
      "Approved active constituents and registered products. The active ingredient and the formulated product remain separate EDCtox records. Registration status is not a mechanism score.",
    baseUrl: "https://portal.apvma.gov.au/pubcris",
    accessType: "WEB_ONLY",
    roles: ["REGULATORY"],
    licence: LICENCE,
    notes: NOT_SYNCED,
  },
  {
    code: "PUBCHEM",
    name: "PubChem",
    organisation: "National Center for Biotechnology Information",
    jurisdiction: "United States",
    description:
      "Structure identity, CID, InChI, InChIKey, SMILES, synonyms, and cross-references. Aggregated PubChem toxicity text is not an EDCtox finding unless the original source is recorded.",
    baseUrl: "https://pubchem.ncbi.nlm.nih.gov/",
    documentationUrl: "https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest",
    apiUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
    accessType: "API",
    roles: ["IDENTITY", "STRUCTURE"],
    licence: LICENCE,
    notes: `${NOT_SYNCED} The API address is recorded for a later adapter. This application does not call it.`,
  },
];

export const IDENTITY_PRECEDENCE = [
  "Exact structure or InChIKey, where a single structure is meaningful.",
  "DTXSID or another DSSTox curated identity.",
  "PubChem CID, checked against structure.",
  "EC number or ECHA substance identity.",
  "CAS Registry Number, as a useful and non-exclusive identifier.",
  "Name matching only as a manual review.",
] as const;
