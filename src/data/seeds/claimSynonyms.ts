/**
 * Curated synonyms: a phrase the literature uses, and the ontology node it means.
 *
 * Every entry was accepted by Scott in `docs/CLAIM_SYNONYM_PROPOSALS.md`, one row at a time.
 * That is the point of the file. Deciding that two phrases name the same thing is a scientific
 * judgment, so nothing is inferred from string similarity, edit distance or a shared word: a
 * term reaches a node because someone decided it should.
 *
 * What is absent matters as much as what is here. The proposals document records the row that
 * was rejected -- sperm concentration and total sperm count are different measurements and were
 * not folded into one outcome -- and the ~140 claims that should stay unmapped: assay readouts,
 * species-specific measures, and gene symbols a 280-node mechanism ontology does not hold. A
 * term with no entry stays unmapped, so the gap stays visible.
 */

export type ClaimSynonym = {
  /** The phrase as the literature writes it, matched after the usual normalisation. */
  term: string;
  /** A mechanism code or an outcome code. A claim points at one or the other, never both. */
  code: string;
  kind: "mechanism" | "outcome";
  /**
   * Applies only when the claim runs this way, for a node whose own name asserts a direction.
   * "Reduced sperm motility" is not what a claim about rising motility is about.
   */
  direction?: "up" | "down";
  /**
   * Applies only for these relations, for a node that names an action rather than an entity.
   * Agonising a receptor and changing how much of it there is are different mechanisms, and the
   * ontology holds them as different nodes, so one phrase can reach either depending on what
   * the claim says happened.
   */
  relations?: readonly string[];
  /** Why this is the same thing, where that is not obvious from the two names. */
  note?: string;
};

const LEVEL_RELATIONS = [
  "INCREASES_EXPRESSION",
  "DECREASES_EXPRESSION",
  "INCREASES_LEVEL",
  "DECREASES_LEVEL",
  "NO_EFFECT",
] as const;

const ACTION_RELATIONS = ["AGONIZES", "ACTIVATES"] as const;

export const claimSynonyms: readonly ClaimSynonym[] = [
  // --- Section 1: synonyms of nodes that already existed ---

  // Hormones and enzymes the ontology holds under their short name.
  { term: "testosterone (t)", code: "TESTOSTERONE", kind: "mechanism" },
  { term: "testosterone level", code: "TESTOSTERONE", kind: "mechanism" },
  { term: "testosterone levels", code: "TESTOSTERONE", kind: "mechanism" },
  { term: "testosterone concentrations", code: "TESTOSTERONE", kind: "mechanism" },
  { term: "superoxide dismutase (sod)", code: "SOD", kind: "mechanism" },
  { term: "follicle-stimulating hormone (fsh)", code: "FSH", kind: "mechanism" },
  {
    term: "day-3 follicle stimulating hormone levels (fsh)",
    code: "FSH",
    kind: "mechanism",
    note: "Day 3 is a timing convention for the measurement, not a different analyte.",
  },
  { term: "luteinizing hormone", code: "LH", kind: "mechanism" },

  // Fertility as a function, which the ontology holds without a sex qualifier.
  { term: "male fertility", code: "FERTILITY", kind: "mechanism" },
  { term: "female fertility", code: "FERTILITY", kind: "mechanism" },

  {
    term: "testicular germ cell apoptosis",
    code: "APOPTOSIS",
    kind: "mechanism",
    note: "The tissue and cell type are recorded on the claim's own columns, not in the node.",
  },

  // Ovarian reserve, which the literature measures half a dozen ways.
  { term: "ovarian reserve markers", code: "OVARIAN_FOLLICLE_RESERVE", kind: "mechanism" },
  { term: "ovarian reserve parameters in women", code: "OVARIAN_FOLLICLE_RESERVE", kind: "mechanism" },
  { term: "impaired ovarian reserve", code: "OVARIAN_FOLLICLE_RESERVE", kind: "mechanism" },
  { term: "reduce ovarian reserve", code: "OVARIAN_FOLLICLE_RESERVE", kind: "mechanism" },
  {
    term: "antral follicle count (afc)",
    code: "OVARIAN_FOLLICLE_RESERVE",
    kind: "mechanism",
    note: "The standard ultrasound measure of the reserve.",
  },
  { term: "reduced antral follicle counts or oocyte yield", code: "OVARIAN_FOLLICLE_RESERVE", kind: "mechanism" },

  // Outcomes, with a direction where the outcome's own name asserts one.
  {
    term: "progressive motility",
    code: "REDUCED_SPERM_MOTILITY",
    kind: "outcome",
    direction: "down",
    note: "The clinically reported fraction of the motility measure.",
  },
  {
    term: "endometriosis-like lesions",
    code: "ENDOMETRIOSIS",
    kind: "outcome",
    note: "The rodent model's lesions stand for the human condition the outcome names.",
  },
  {
    term: "epithelial ovarian cancer (eoc)/epithelial borderline ovarian tumors (ebots)",
    code: "OVARIAN_CANCER",
    kind: "outcome",
  },
  {
    term: "mitochondrial impairment",
    code: "MITOCHONDRIAL_DYSFUNCTION",
    kind: "outcome",
    note: "Impairment and dysfunction are the same claim in different words.",
  },

  // --- Section 3: terms for nodes added with these decisions ---

  { term: "anti-müllerian hormone (amh)", code: "AMH", kind: "mechanism" },
  { term: "antimullerian hormone (amh)", code: "AMH", kind: "mechanism" },
  { term: "serum amh levels", code: "AMH", kind: "mechanism" },
  { term: "serum anti-müllerian hormone", code: "AMH", kind: "mechanism" },

  /**
   * Estrogen receptor alpha reaches two different nodes depending on the claim, because the
   * ontology holds acting at the receptor and the amount of receptor as separate mechanisms.
   * A claim that the compound binds ERa is deliberately absent from both: binding is neither
   * agonism nor abundance, and which of the two it supports is exactly what a curator should
   * decide. (ER_STRESS in this ontology is endoplasmic reticulum stress, not a receptor.)
   */
  { term: "estrogen receptor alpha (er alpha)", code: "ER_ALPHA_AGONISM", kind: "mechanism", relations: ACTION_RELATIONS },
  { term: "er alpha", code: "ER_ALPHA_AGONISM", kind: "mechanism", relations: ACTION_RELATIONS },
  { term: "estrogen receptor alpha (er alpha)", code: "ER_ALPHA_EXPRESSION", kind: "mechanism", relations: LEVEL_RELATIONS },
  { term: "er alpha", code: "ER_ALPHA_EXPRESSION", kind: "mechanism", relations: LEVEL_RELATIONS },
  {
    term: "er alpha immunoreactive neurons",
    code: "ER_ALPHA_EXPRESSION",
    kind: "mechanism",
    relations: LEVEL_RELATIONS,
    note: "Immunoreactive neuron counts are a measure of how much receptor is present.",
  },

  { term: "abnormal sperm morphology", code: "ABNORMAL_SPERM_MORPHOLOGY", kind: "outcome", direction: "up" },
  {
    term: "sperm normal morphology rate",
    code: "ABNORMAL_SPERM_MORPHOLOGY",
    kind: "outcome",
    direction: "down",
    note: "A falling share of normal forms is a rising share of abnormal ones, which is why the direction is inverted here.",
  },
  { term: "semen volume", code: "REDUCED_SEMEN_VOLUME", kind: "outcome", direction: "down" },

  // Natural conception, kept apart from the clinic measures below.
  { term: "time to pregnancy (ttp)", code: "REDUCED_FECUNDABILITY", kind: "outcome" },
  { term: "subfertility", code: "REDUCED_FECUNDABILITY", kind: "outcome" },

  // Assisted reproduction, where the measures are the clinic's rather than the couple's.
  { term: "clinical pregnancy rates", code: "REDUCED_ART_SUCCESS", kind: "outcome", direction: "down" },
  { term: "clinical pregnancy rates (cpr)", code: "REDUCED_ART_SUCCESS", kind: "outcome", direction: "down" },
  { term: "fertilization rates", code: "REDUCED_ART_SUCCESS", kind: "outcome", direction: "down" },
  { term: "normal fertilization rates", code: "REDUCED_ART_SUCCESS", kind: "outcome", direction: "down" },

  { term: "cardiovascular disease (cvd)", code: "CARDIOVASCULAR_DISEASE", kind: "outcome" },
];
