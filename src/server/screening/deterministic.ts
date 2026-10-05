import { normalizeTitle } from "../literature/dedup";
import {
  SCREENING_PROMPT_VERSION,
  type ScreeningConfidenceName,
  type ScreeningDecisionName,
  type ScreeningPurposeName,
  type ScreeningReasonName,
} from "./reasons";

export { SCREENING_PROMPT_VERSION };

const PURPOSE_RANK: Record<ScreeningPurposeName, number> = {
  SYSTEMATIC_REVIEWS: 0,
  HUMAN_REPRODUCTIVE: 1,
  CONTRADICTORY_OR_NULL: 2,
};

const ENDPOINTS = [
  "reproductive hormone",
  "male fertility",
  "female fertility",
  "semen quality",
  "steroidogenesis",
  "endometriosis",
  "reproduction",
  "reproductive",
  "fertility",
  "infertility",
  "ovarian",
  "ovary",
  "oocyte",
  "follicle",
  "sperm",
  "semen",
  "testosterone",
  "estradiol",
  "estrogen",
  "granulosa",
  "leydig",
  "testis",
  "testes",
  "testicular",
  "uterus",
  "uterine",
  "implantation",
  "fecund",
  "puberty",
];

const HUMAN = ["pregnant", "pregnancy", "cohort", "patients", "clinical", "ivf", "women", "men", "girls", "boys"];
const ANIMAL = ["copepod", "daphnia", "zebrafish", "hamster", "murine", "mouse", "mice", "quail", "rats", "rat"];
const NON_MAMMAL = ["copepod", "daphnia", "zebrafish", "quail"];

export type ScreeningText = {
  title: string;
  abstractText: string | null;
  retracted: boolean;
  purposes: readonly ScreeningPurposeName[];
};

export type MachineSuggestion = {
  decision: ScreeningDecisionName;
  reasonCode: ScreeningReasonName;
  confidence: ScreeningConfidenceName;
  rationale: string;
  searchPurpose: ScreeningPurposeName | null;
};

export function governingPurpose(purposes: readonly ScreeningPurposeName[]): ScreeningPurposeName | null {
  const unique = [...new Set(purposes)].sort((left, right) => PURPOSE_RANK[left] - PURPOSE_RANK[right]);
  return unique[0] ?? null;
}

function haystack(input: ScreeningText): string {
  return ` ${normalizeTitle(`${input.title} ${input.abstractText ?? ""}`)} `;
}

function has(text: string, phrase: string): boolean {
  return text.includes(` ${normalizeTitle(phrase)} `);
}

function any(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => has(text, phrase));
}

function suggestion(
  input: ScreeningText,
  decision: ScreeningDecisionName,
  reasonCode: ScreeningReasonName,
  confidence: ScreeningConfidenceName,
  rationale: string,
): MachineSuggestion {
  return {
    decision,
    reasonCode,
    confidence,
    rationale: rationale.slice(0, 400),
    searchPurpose: governingPurpose(input.purposes),
  };
}

export function suggestDeterministic(input: ScreeningText): MachineSuggestion {
  const purpose = governingPurpose(input.purposes);
  const text = haystack(input);
  const title = ` ${normalizeTitle(input.title)} `;
  const bisphenolA = has(text, "bisphenol a") || has(text, "80 05 7");
  const otherBisphenol = any(text, ["bisphenol s", "bisphenol f", "bisphenol af", "bisphenol b", "bps", "bpf"]);
  const titleNamesOtherBisphenol = any(title, ["bisphenol s", "bisphenol f", "bisphenol af", "bisphenol b"]);
  const titleNamesBisphenolA = has(title, "bisphenol a") || has(title, "bpa") || has(title, "80 05 7");
  const endpoint = any(text, ENDPOINTS);
  const human = any(text, HUMAN);
  const animal = any(text, ANIMAL);
  const inVitro = any(text, ["in vitro", "cell line"]);
  const inSilico = any(text, ["in silico", "molecular docking"]);
  const exposure = any(text, ["migration", "packaging", "canned food", "urinary concentration", "environmental concentration"]);

  if (input.retracted) {
    return suggestion(input, "EXCLUDE", "RETRACTED", "HIGH", "The provider marks this publication retracted. It stays visible and cannot support a score.");
  }
  if (!input.abstractText?.trim() && bisphenolA) {
    return suggestion(input, "UNCERTAIN", "FULL_TEXT_NEEDED", "LOW", "No abstract is stored, so the title alone is not used to include or exclude this paper.");
  }
  if ((titleNamesOtherBisphenol && !titleNamesBisphenolA) || (otherBisphenol && !bisphenolA)) {
    return suggestion(input, "EXCLUDE", "WRONG_BISPHENOL", "HIGH", "The title names another bisphenol, or the text does not name bisphenol A.");
  }
  if (!bisphenolA && any(text, ["phthalate", "paraben", "triclosan"])) {
    return suggestion(input, "EXCLUDE", "WRONG_COMPOUND", "HIGH", "The text does not name bisphenol A.");
  }
  if (!bisphenolA) {
    return suggestion(input, "UNCERTAIN", "FULL_TEXT_NEEDED", "LOW", "Bisphenol A is not clear in the stored text.");
  }
  if (any(text, ["commentary", "editorial"]) || has(text, "comment on")) {
    return suggestion(input, "EXCLUDE", "COMMENTARY_OR_EDITORIAL", "MODERATE", "The title or abstract reads as commentary rather than a study or systematic review.");
  }
  if (any(text, ["wheat", "arabidopsis", "plant stress"]) && !any(text, ["sperm", "ovary", "fertility", "semen", "testosterone"])) {
    return suggestion(input, "EXCLUDE", "WRONG_DOMAIN", "MODERATE", "The text is about a plant response, not a reproductive outcome.");
  }
  if (any(title, ["migration", "packaging", "canned"]) && !any(title, ["fertility", "sperm", "ovary", "ovarian", "semen", "testosterone", "endometriosis", "follicle", "testis", "testicular", "uterus", "pcos", "steroidogenesis"])) {
    return suggestion(input, "EXCLUDE", "EXPOSURE_ONLY", "MODERATE", "The title is about migration or packaging rather than a reproductive outcome.");
  }
  if (!endpoint && exposure) {
    return suggestion(input, "EXCLUDE", "EXPOSURE_ONLY", "MODERATE", "The text reports exposure or migration and no reproductive outcome.");
  }
  if (!endpoint) {
    return suggestion(input, "EXCLUDE", "WRONG_DOMAIN", "MODERATE", "The stored text does not describe a reproductive outcome.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE" && has(text, "narrative review")) {
    return suggestion(input, "EXCLUDE", "NARRATIVE_REVIEW_ONLY", "MODERATE", "For the human-reproductive queue, a narrative review is not treated as a human study.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE" && inSilico && !human && !animal && !inVitro) {
    return suggestion(input, "EXCLUDE", "METHOD_ONLY", "MODERATE", "For the human-reproductive queue, an in silico paper is not treated as human evidence.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE" && inVitro && !human && !animal) {
    return suggestion(input, "EXCLUDE", "IN_VITRO_ONLY", "MODERATE", "For the human-reproductive queue, an in vitro paper is not treated as human evidence.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE" && animal && !human) {
    return suggestion(input, "EXCLUDE", "ANIMAL_ONLY", "MODERATE", "For the human-reproductive queue, an animal-only paper is not treated as human evidence.");
  }
  if (purpose === "SYSTEMATIC_REVIEWS" && has(text, "meta analysis")) {
    return suggestion(input, "INCLUDE", "META_ANALYSIS", "HIGH", "The paper is a meta-analysis that discusses bisphenol A and a reproductive outcome.");
  }
  if (purpose === "SYSTEMATIC_REVIEWS" && has(text, "systematic review")) {
    return suggestion(input, "INCLUDE", "SYSTEMATIC_REVIEW", "HIGH", "The paper is a systematic review that discusses bisphenol A and a reproductive outcome.");
  }
  if (purpose === "SYSTEMATIC_REVIEWS") {
    return suggestion(input, "INCLUDE", "DIRECT_EXPERIMENTAL_EVIDENCE", "MODERATE", "A systematic-review search hit about bisphenol A and reproduction can include experimental evidence.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE" && human) {
    const confidence = any(text, ["cohort", "ivf", "pregnant"]) ? "HIGH" : "MODERATE";
    return suggestion(input, "INCLUDE", "DIRECT_HUMAN_EVIDENCE", confidence, "The stored text discusses bisphenol A, people, and a reproductive outcome. This is not confirmation of study design.");
  }
  if (purpose === "HUMAN_REPRODUCTIVE") {
    return suggestion(input, "UNCERTAIN", "MIXED_OR_UNCLEAR", "LOW", "The human-reproductive queue cannot tell whether this paper reports human evidence.");
  }
  const confidence = any(text, NON_MAMMAL) ? "LOW" : "MODERATE";
  return suggestion(
    input,
    "INCLUDE",
    "REPRODUCTIVE_RELEVANCE",
    confidence,
    "The paper discusses bisphenol A and a reproductive outcome. A contradictory-search hit is not a confirmed null finding.",
  );
}
