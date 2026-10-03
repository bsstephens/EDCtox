import { normalizeTitle, type IncomingPaper } from "./dedup";

const DOMAIN_PHRASES = [
  "reproductive hormone",
  "male fertility",
  "female fertility",
  "reproduction",
  "reproductive",
  "fertility",
  "infertility",
  "ovarian",
  "ovary",
  "sperm",
  "semen",
  "testosterone",
  "estradiol",
  "steroidogenesis",
] as const;

export type RelevanceSkip = "relevance-compound" | "relevance-domain" | "relevance-acronym";

export type RelevanceDecision = {
  pass: boolean;
  skipReason: RelevanceSkip | null;
  detail: string;
};

function haystack(paper: IncomingPaper): string {
  return ` ${normalizeTitle(`${paper.title} ${paper.abstractText ?? ""}`)} `;
}

function hasPhrase(text: string, phrase: string): boolean {
  return text.includes(` ${phrase} `);
}

export function assessReproductiveRelevance(paper: IncomingPaper): RelevanceDecision {
  const text = haystack(paper);
  const spelledName = hasPhrase(text, "bisphenol a");
  const cas = hasPhrase(text, "80 05 7");
  const acronym = hasPhrase(text, "bpa");
  const domain = DOMAIN_PHRASES.some((phrase) => hasPhrase(text, phrase));

  if (!spelledName && !cas && !acronym) {
    return {
      pass: false,
      skipReason: "relevance-compound",
      detail: "Relevance gate: no Bisphenol A, CAS 80-05-7, or BPA token in the title or abstract.",
    };
  }
  if (!spelledName && !cas && acronym && !hasPhrase(text, "bisphenol")) {
    return {
      pass: false,
      skipReason: "relevance-acronym",
      detail: "Relevance gate: BPA acronym without Bisphenol A or CAS 80-05-7.",
    };
  }
  if (!domain) {
    return {
      pass: false,
      skipReason: "relevance-domain",
      detail: "Relevance gate: no reproductive term in the title or abstract.",
    };
  }
  return { pass: true, skipReason: null, detail: "" };
}

const SIGNAL_PHRASES: Array<{ label: string; phrases: string[] }> = [
  { label: "review", phrases: ["systematic review", "meta analysis", "narrative review", "scoping review"] },
  { label: "in-vitro", phrases: ["in vitro", "cell line", "hepg2", "granulosa cells"] },
  { label: "animal", phrases: ["rat", "rats", "mouse", "mice", "hamster", "zebrafish", "murine"] },
  { label: "human-clinical-likely", phrases: ["randomized", "randomised", "clinical trial"] },
  { label: "human-observational-likely", phrases: ["cohort", "cross sectional", "pregnant", "nhanes"] },
];

/** A label for screening. It is not a study-type adjudication and it does not create a finding. */
export function studySignal(paper: IncomingPaper): string {
  const text = haystack(paper);
  const matched = SIGNAL_PHRASES.filter((signal) => signal.phrases.some((phrase) => hasPhrase(text, phrase))).map(
    (signal) => signal.label,
  );
  if (matched.length === 1) return matched[0] ?? "mixed-or-unclear";
  return "mixed-or-unclear";
}
