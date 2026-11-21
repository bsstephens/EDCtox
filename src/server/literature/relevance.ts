import { normalizeTitle, type IncomingPaper } from "./dedup";
import { BPA_REPRODUCTIVE_SCOPE, type SearchScope } from "./queries";

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

/**
 * A provider query can only be so precise, so this is the second gate: does the paper that came
 * back actually name the compound and the domain?
 *
 * It was written for one compound with its tokens inlined, which meant every glyphosate paper
 * failed as irrelevant to bisphenol A. The compound half now comes from the scope and the domain
 * half stays shared, because the reproductive literature is the same literature whichever
 * compound is being looked for.
 *
 * The acronym rule is compound-specific and kept: "BPA" alone is ambiguous, so it only counts
 * when the stem "bisphenol" appears too. A scope with no abbreviation, like glyphosate's, has no
 * such ambiguity to guard against.
 */
export function assessReproductiveRelevance(
  paper: IncomingPaper,
  scope: SearchScope = BPA_REPRODUCTIVE_SCOPE,
): RelevanceDecision {
  const text = haystack(paper);
  const named = (phrase: string | null | undefined) => Boolean(phrase) && hasPhrase(text, normalizeTitle(phrase ?? ""));

  // Everything that names the compound except a bare, ambiguous abbreviation.
  const unambiguous =
    named(scope.canonicalName) ||
    named(scope.casNumber) ||
    named(scope.iupacName) ||
    (scope.searchAlsoFor ?? []).some((term) => named(term));
  const abbreviation = named(scope.abbreviation);
  const stem = scope.canonicalName.split(" ")[0] ?? scope.canonicalName;
  const domain = DOMAIN_PHRASES.some((phrase) => hasPhrase(text, phrase));

  const names = [scope.canonicalName, scope.casNumber ? `CAS ${scope.casNumber}` : null, scope.abbreviation]
    .filter(Boolean)
    .join(", ");

  if (!unambiguous && !abbreviation) {
    return {
      pass: false,
      skipReason: "relevance-compound",
      detail: `Relevance gate: no ${names} token in the title or abstract.`,
    };
  }
  if (!unambiguous && abbreviation && !hasPhrase(text, normalizeTitle(stem))) {
    return {
      pass: false,
      skipReason: "relevance-acronym",
      detail: `Relevance gate: ${scope.abbreviation ?? ""} acronym without ${scope.canonicalName} or CAS ${scope.casNumber ?? "-"}.`,
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
