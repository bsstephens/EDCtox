import { z } from "zod";

import { governingPurpose, type MachineSuggestion, type ScreeningText } from "./deterministic";
import {
  SCREENING_CONFIDENCE,
  SCREENING_DECISIONS,
  SCREENING_PURPOSES,
  SCREENING_REASONS,
  reasonAllowed,
  reasonsForDecision,
  type ScreeningPurposeName,
} from "./reasons";

/// Changes with the prompt text below. Bump it when a word of the prompt changes.
export const CLAUDE_SCREENING_PROMPT_VERSION = "bpa-reproductive-claude-v1";

export const RATIONALE_LIMIT = 400;

export class ScreeningProviderError extends Error {}

/// The structured output the model must return. The enums are the vocabularies in reasons.ts,
/// so the model cannot invent a decision, a reason code or a confidence. The governing purpose is
/// computed in code from the search hits, not asked of the model.
export const SCREENING_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: [...SCREENING_DECISIONS] },
    reasonCode: { type: "string", enum: [...SCREENING_REASONS] },
    confidence: { type: "string", enum: [...SCREENING_CONFIDENCE] },
    rationale: {
      type: "string",
      description: "One short paragraph, at most 400 characters, naming what in the title or abstract drove the call.",
    },
  },
  required: ["decision", "reasonCode", "confidence", "rationale"],
  additionalProperties: false,
} as const;

const outputSchema = z.object({
  decision: z.enum(SCREENING_DECISIONS),
  reasonCode: z.enum(SCREENING_REASONS),
  confidence: z.enum(SCREENING_CONFIDENCE),
  rationale: z.string(),
});

const PURPOSE_RULES: Record<ScreeningPurposeName, string> = {
  SYSTEMATIC_REVIEWS:
    "SYSTEMATIC_REVIEWS. This queue wants systematic reviews (SYSTEMATIC_REVIEW), meta-analyses (META_ANALYSIS) and regulatory assessments (REGULATORY_REVIEW) of bisphenol A and a reproductive endpoint. A primary study that landed here is still judged on its merits: a human study is DIRECT_HUMAN_EVIDENCE, an animal or cell study is DIRECT_EXPERIMENTAL_EVIDENCE. A narrative, scoping or bibliometric review is EXCLUDE NARRATIVE_REVIEW_ONLY.",
  HUMAN_REPRODUCTIVE:
    "HUMAN_REPRODUCTIVE. This queue wants studies in people: cohort, case-control, cross-sectional, IVF clinic, pregnancy and biomonitoring-with-outcome studies (DIRECT_HUMAN_EVIDENCE). Animal-only work is EXCLUDE ANIMAL_ONLY, cell-only work is EXCLUDE IN_VITRO_ONLY, in silico or docking work is EXCLUDE METHOD_ONLY, and a narrative review is EXCLUDE NARRATIVE_REVIEW_ONLY, however good the work is, because this queue exists to find human evidence. A systematic review or meta-analysis of human studies may be included under its own reason.",
  CONTRADICTORY_OR_NULL:
    "CONTRADICTORY_OR_NULL. This queue wants any study of bisphenol A and a reproductive endpoint, of any design, including those that report no association or no effect. Use REPRODUCTIVE_RELEVANCE for a reproductive study of any design, MECHANISTIC_RELEVANCE when the paper is about a mechanism such as steroidogenesis or receptor signalling, DEVELOPMENTAL_RELEVANCE for gestational or pubertal exposure windows, and DIRECT_HUMAN_EVIDENCE or DIRECT_EXPERIMENTAL_EVIDENCE when the design is plain. The search phrase such as 'no effect' may have matched text unrelated to bisphenol A; a hit here is still a bisphenol A reproductive paper first.",
};

function list(items: readonly string[]): string {
  return items.join(", ");
}

export function buildScreeningSystemPrompt(input: { seedKnowledge: string; endpointVocabulary: readonly string[] }): string {
  return [
    "You screen candidate publications for EDCtox, a curated database of endocrine-disrupting chemicals. The compound is bisphenol A and the domain is reproductive. You read one title and, when stored, one abstract, and you return a structured screening suggestion. A curator reads every suggestion and makes the decision; your suggestion is never a decision.",
    "",
    "Return exactly one decision, one reason code, one confidence and one rationale.",
    `Decisions: ${list(SCREENING_DECISIONS)}.`,
    `Reason codes for INCLUDE: ${list(reasonsForDecision("INCLUDE", null))}.`,
    `Reason codes for EXCLUDE: ${list(reasonsForDecision("EXCLUDE", "HUMAN_REPRODUCTIVE"))}. ANIMAL_ONLY and IN_VITRO_ONLY are only valid when the governing purpose is HUMAN_REPRODUCTIVE.`,
    `Reason codes for UNCERTAIN: ${list(reasonsForDecision("UNCERTAIN", null))}.`,
    `Confidence: ${list(SCREENING_CONFIDENCE)}. HIGH when the stored text states the design and endpoint plainly; MODERATE when you inferred either; LOW when the title alone or an ambiguous abstract is all you have.`,
    "",
    "Rules, in order:",
    "1. A retracted publication is EXCLUDE RETRACTED whatever it says.",
    "2. When no abstract is stored, do not include. Exclude only when the title alone is decisive, for example it names another bisphenol and not bisphenol A, or it is plainly outside the domain. Otherwise answer UNCERTAIN FULL_TEXT_NEEDED.",
    "3. The paper must concern bisphenol A itself (BPA, CAS 80-05-7). A paper about bisphenol S, F, AF, B or another analogue that mentions BPA only as background is EXCLUDE WRONG_BISPHENOL. A paper about another chemical class that mentions BPA in passing is EXCLUDE WRONG_COMPOUND. A mixture study counts when BPA is an analysed exposure.",
    "4. The paper must measure or review a reproductive endpoint or reproductive endocrine endpoint. Exposure, migration, packaging or biomonitoring with no reproductive measurement is EXCLUDE EXPOSURE_ONLY. Another organ system is EXCLUDE WRONG_DOMAIN. A search hit on a word with no reproductive meaning in context is EXCLUDE IRRELEVANT_KEYWORD_MATCH. A commentary, letter or editorial is EXCLUDE COMMENTARY_OR_EDITORIAL. A methods or assay paper with no biological result is EXCLUDE METHOD_ONLY.",
    "5. Apply the rule for the governing purpose given in the message.",
    "6. When the stored text genuinely cannot settle include or exclude, answer UNCERTAIN MIXED_OR_UNCLEAR rather than guessing.",
    "",
    "Purpose rules:",
    ...SCREENING_PURPOSES.map((purpose) => `- ${PURPOSE_RULES[purpose]}`),
    "",
    `Reproductive endpoint vocabulary the queue was built from: ${list(input.endpointVocabulary)}.`,
    "",
    "The rationale is one paragraph of at most 400 characters. Name the words in the title or abstract that drove the call and the design you read. Do not write steps, numbered reasoning or a chain of thought. Do not quote more than a short phrase of the abstract.",
    "",
    "Compound knowledge from the curator:",
    input.seedKnowledge.trim(),
  ].join("\n");
}

export function buildScreeningUserPrompt(candidate: ScreeningText): string {
  const purpose = governingPurpose(candidate.purposes);
  return [
    `Search purposes that returned this paper: ${candidate.purposes.length > 0 ? list(candidate.purposes) : "none recorded"}.`,
    `Governing purpose: ${purpose ?? "none"}.`,
    `Retracted: ${candidate.retracted ? "yes" : "no"}.`,
    `Title: ${candidate.title}`,
    candidate.abstractText?.trim() ? `Abstract: ${candidate.abstractText.trim()}` : "Abstract: none is stored.",
  ].join("\n");
}

function tidyRationale(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, RATIONALE_LIMIT);
}

/// Checks a raw model output against the vocabularies and the decision-to-reason rules the
/// curator desk enforces. Anything outside them is an error, never a coerced suggestion.
export function parseScreeningOutput(raw: unknown, purposes: readonly ScreeningPurposeName[]): MachineSuggestion {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScreeningProviderError(`The model output is not a screening suggestion: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const purpose = governingPurpose(purposes);
  const { decision, reasonCode, confidence } = parsed.data;
  if (!reasonAllowed(decision, reasonCode, purpose)) {
    throw new ScreeningProviderError(`Reason ${reasonCode} is not available for ${decision} on the ${purpose ?? "unknown"} queue.`);
  }
  const rationale = tidyRationale(parsed.data.rationale);
  if (rationale.length === 0) throw new ScreeningProviderError("The model returned an empty rationale.");
  return { decision, reasonCode, confidence, rationale, searchPurpose: purpose };
}
