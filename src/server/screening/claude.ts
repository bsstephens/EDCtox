import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import type { SuggestionCandidate, SuggestionProvenance } from "./applySuggestions";
import { governingPurpose, REPRODUCTIVE_ENDPOINTS, type MachineSuggestion } from "./deterministic";
import {
  SCREENING_CONFIDENCE,
  SCREENING_DECISIONS,
  SCREENING_REASONS,
  reasonAllowed,
  reasonsForDecision,
  type ScreeningPurposeName,
} from "./reasons";

/**
 * Claude-backed screening provider (phase 4A, design section 4.3).
 *
 * The model sees the title, abstract and search purposes of one publication and answers in the
 * existing enum vocabularies through structured output. The prompt version changes with the
 * prompt text. The provider never writes to the database; `applyMachineSuggestions` does, and
 * phase 4A runs it in dry-run only.
 */
export const CLAUDE_SCREENING_PROVIDER = "claude";
export const CLAUDE_SCREENING_MODEL = "claude-haiku-5-5";
export const CLAUDE_SCREENING_PROMPT_VERSION = "bpa-reproductive-claude-v1";

export const CLAUDE_SCREENING_PROVENANCE: SuggestionProvenance = {
  provider: CLAUDE_SCREENING_PROVIDER,
  model: CLAUDE_SCREENING_MODEL,
  promptVersion: CLAUDE_SCREENING_PROMPT_VERSION,
};

export class ClaudeScreeningError extends Error {}

const REASON_GLOSSARY: Record<string, string> = {
  DIRECT_HUMAN_EVIDENCE: "a primary study in people (cohort, case-control, clinical, IVF) on bisphenol A and a reproductive endpoint",
  DIRECT_EXPERIMENTAL_EVIDENCE: "a primary animal or experimental study on bisphenol A and a reproductive endpoint",
  SYSTEMATIC_REVIEW: "a systematic review on bisphenol A and a reproductive endpoint",
  META_ANALYSIS: "a meta-analysis on bisphenol A and a reproductive endpoint",
  REGULATORY_REVIEW: "an agency or regulatory assessment",
  MECHANISTIC_RELEVANCE: "mechanistic evidence (receptor, enzyme, signalling) that bears on reproduction",
  DEVELOPMENTAL_RELEVANCE: "prenatal or early-life exposure with a reproductive outcome later",
  REPRODUCTIVE_RELEVANCE: "bisphenol A and a reproductive endpoint when no more specific include reason fits; the only include reason for the contradictory-or-null queue",
  WRONG_COMPOUND: "the paper is not about bisphenol A",
  WRONG_BISPHENOL: "the paper is about bisphenol S, F, AF or B and names bisphenol A only in passing",
  WRONG_DOMAIN: "bisphenol A, but no reproductive endpoint (plants, metabolism, neurobehaviour, cancer without a reproductive measure)",
  EXPOSURE_ONLY: "exposure, migration, biomonitoring or analytical chemistry with no reproductive outcome",
  ANIMAL_ONLY: "animal evidence only, on a queue that asks for human evidence",
  IN_VITRO_ONLY: "cell or tissue evidence only, on a queue that asks for human evidence",
  MIXED_OR_UNCLEAR: "the text does not let you tell",
  COMMENTARY_OR_EDITORIAL: "commentary, letter, editorial, erratum or conference abstract",
  NARRATIVE_REVIEW_ONLY: "a narrative review with no systematic method, on a queue that asks for primary human evidence",
  METHOD_ONLY: "methods, assay development, in silico or docking work with no biological result",
  NON_RELEVANT_OUTCOME: "a measured outcome that is not reproductive",
  NON_ANIMAL_MODEL:
    "the only organisms studied are plants, fungi or microbes, which have none of the receptors or axes in question; a study of both a plant and an animal is an animal study",
  IRRELEVANT_KEYWORD_MATCH: "a keyword hit with no bisphenol A content",
  DUPLICATE_PUBLICATION: "a duplicate of a publication already in the set",
  RETRACTED: "the publication is retracted",
  FULL_TEXT_NEEDED: "the abstract is missing or too thin to decide",
  OTHER: "none of the above fits",
};

export const CLAUDE_SCREENING_SYSTEM_PROMPT = `You screen one scientific publication at a time for EDCtox, a research database that compares compounds across biological mechanisms. Decide whether the publication belongs in the evidence set for the compound bisphenol A in the reproductive domain, using only the title and abstract you are given.

Compound. Bisphenol A (BPA), CAS 80-05-7, also written 2,2-bis(4-hydroxyphenyl)propane or 4,4'-isopropylidenediphenol. Bisphenol S, bisphenol F, bisphenol AF and bisphenol B are different compounds. A paper on another bisphenol that mentions BPA only as context is WRONG_BISPHENOL. A mixture or multi-chemical paper counts for BPA only when BPA has a result of its own.

Reproductive domain. Endpoints include: ${REPRODUCTIVE_ENDPOINTS.join(", ")}. Steroid hormone levels, gamete quality, gonad histology, fertility, implantation, puberty timing, endometriosis and polycystic ovary syndrome all count. Pregnancy outcomes count when they are reproductive (fecundity, miscarriage, time to pregnancy); birth weight alone does not.

Search purposes. Each publication arrived through one or more searches. The governing purpose sets the bar:
- SYSTEMATIC_REVIEWS: include systematic reviews (SYSTEMATIC_REVIEW) and meta-analyses (META_ANALYSIS) on BPA and a reproductive endpoint. A primary study that this search returned is still included, as DIRECT_HUMAN_EVIDENCE or DIRECT_EXPERIMENTAL_EVIDENCE. Narrative reviews on this queue are UNCERTAIN MIXED_OR_UNCLEAR unless they clearly carry no reproductive content.
- HUMAN_REPRODUCTIVE: include only human evidence (DIRECT_HUMAN_EVIDENCE, or SYSTEMATIC_REVIEW / META_ANALYSIS of human studies). Animal-only papers are EXCLUDE ANIMAL_ONLY, cell-only papers EXCLUDE IN_VITRO_ONLY, in silico papers EXCLUDE METHOD_ONLY, narrative reviews EXCLUDE NARRATIVE_REVIEW_ONLY.
- CONTRADICTORY_OR_NULL: include papers that report a null, protective or contradictory result for BPA on a reproductive endpoint, as REPRODUCTIVE_RELEVANCE. Including such a paper does not confirm its null finding; it keeps it for the curator.

Decisions are INCLUDE, EXCLUDE or UNCERTAIN. The reason code must come from the list offered for the publication; each code means:
${SCREENING_REASONS.map((code) => `- ${code}: ${REASON_GLOSSARY[code] ?? ""}`).join("\n")}

Confidence is HIGH when the title and abstract settle the call, MODERATE when the abstract supports it but the study design or BPA-specific result is not confirmed, LOW when the stored text is thin.

Rules. Judge only the text given; do not assume what the full paper contains. If no abstract is stored, answer UNCERTAIN FULL_TEXT_NEEDED unless the title alone shows a wrong compound or a retraction. A publication marked retracted is EXCLUDE RETRACTED. Write the rationale as one plain paragraph of at most 400 characters that states what the text shows and why that fits the decision. Do not describe your reasoning steps and do not quote the abstract at length.`;

export type ClaudeScreeningRequest = {
  evidenceSourceId: string;
  title: string;
  system: string;
  user: string;
  promptSha256: string;
};

const PURPOSE_LABEL: Record<ScreeningPurposeName, string> = {
  SYSTEMATIC_REVIEWS: "SYSTEMATIC_REVIEWS",
  HUMAN_REPRODUCTIVE: "HUMAN_REPRODUCTIVE",
  CONTRADICTORY_OR_NULL: "CONTRADICTORY_OR_NULL",
};

export function buildClaudeScreeningRequest(candidate: SuggestionCandidate): ClaudeScreeningRequest {
  const purpose = governingPurpose(candidate.purposes);
  const purposes = [...new Set(candidate.purposes)].map((item) => PURPOSE_LABEL[item]).join(", ") || "none recorded";
  const allowed = SCREENING_DECISIONS.map(
    (decision) => `${decision}: ${reasonsForDecision(decision, purpose).join(", ")}`,
  ).join("\n");
  const abstract = candidate.abstractText?.trim() ? candidate.abstractText.trim() : "(no abstract stored)";
  const user = [
    `Governing purpose: ${purpose ?? "none"}`,
    `All search purposes: ${purposes}`,
    `Marked retracted by the provider: ${candidate.retracted ? "yes" : "no"}`,
    "",
    "Reason codes offered for this publication, by decision:",
    allowed,
    "",
    `Title: ${candidate.title}`,
    "",
    `Abstract: ${abstract}`,
  ].join("\n");
  const system = CLAUDE_SCREENING_SYSTEM_PROMPT;
  return {
    evidenceSourceId: candidate.evidenceSourceId,
    title: candidate.title,
    system,
    user,
    promptSha256: createHash("sha256").update(`${CLAUDE_SCREENING_PROMPT_VERSION}\n${system}\n${user}`).digest("hex"),
  };
}

export const ClaudeScreeningOutput = z.object({
  decision: z.enum(SCREENING_DECISIONS),
  reasonCode: z.enum(SCREENING_REASONS),
  confidence: z.enum(SCREENING_CONFIDENCE),
  rationale: z.string(),
});

export type ClaudeScreeningOutput = z.infer<typeof ClaudeScreeningOutput>;

/** Turns a raw model answer into a MachineSuggestion, refusing anything outside the vocabulary. */
export function parseClaudeSuggestion(raw: unknown, candidate: Pick<SuggestionCandidate, "purposes">): MachineSuggestion {
  const parsed = ClaudeScreeningOutput.safeParse(raw);
  if (!parsed.success) {
    throw new ClaudeScreeningError(`The model answer is not in the screening vocabulary: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const purpose = governingPurpose(candidate.purposes);
  const { decision, reasonCode, confidence, rationale } = parsed.data;
  if (!reasonAllowed(decision, reasonCode, purpose)) {
    throw new ClaudeScreeningError(`The model paired ${decision} with ${reasonCode}, which is not offered for that decision on the ${purpose ?? "unknown"} queue.`);
  }
  const text = rationale.replace(/\s+/g, " ").trim();
  if (!text) throw new ClaudeScreeningError("The model returned an empty rationale.");
  return { decision, reasonCode, confidence, rationale: text.slice(0, 400), searchPurpose: purpose };
}

/** One answer, as raw JSON, for one request. The API, a transcript and a test fixture all fit this shape. */
export type ClaudeScreeningCompletion = (request: ClaudeScreeningRequest) => Promise<unknown>;

export type ScreeningTranscriptEntry = {
  title: string;
  promptSha256: string;
  model: string;
  response: unknown;
  usage?: { inputTokens: number; outputTokens: number };
  recordedAt?: string;
};

export type ScreeningTranscript = {
  promptVersion: string;
  entries: Record<string, ScreeningTranscriptEntry>;
};

export function readScreeningTranscript(path: string): ScreeningTranscript {
  if (!existsSync(path)) return { promptVersion: CLAUDE_SCREENING_PROMPT_VERSION, entries: {} };
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("entries" in parsed)) {
    throw new ClaudeScreeningError(`${path} is not a screening transcript.`);
  }
  const transcript = parsed as ScreeningTranscript;
  if (transcript.promptVersion !== CLAUDE_SCREENING_PROMPT_VERSION) {
    throw new ClaudeScreeningError(
      `${path} was recorded with prompt ${transcript.promptVersion}, not ${CLAUDE_SCREENING_PROMPT_VERSION}.`,
    );
  }
  return transcript;
}

export function writeScreeningTranscript(path: string, transcript: ScreeningTranscript): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(transcript, null, 2)}\n`);
}

/** Replays recorded answers. A request with no entry, or a changed prompt, is an error, never a guess. */
export function transcriptCompletion(transcript: ScreeningTranscript): ClaudeScreeningCompletion {
  return (request) => {
    const entry = transcript.entries[request.evidenceSourceId];
    if (!entry) {
      return Promise.reject(new ClaudeScreeningError(`No recorded answer for ${request.evidenceSourceId} (${request.title}).`));
    }
    if (entry.promptSha256 !== request.promptSha256) {
      return Promise.reject(new ClaudeScreeningError(`The recorded answer for ${request.title} was made for a different prompt.`));
    }
    return Promise.resolve(entry.response);
  };
}

/** Calls the Claude API with structured output. Only this function touches the network. */
export function apiCompletion(client: Anthropic): ClaudeScreeningCompletion {
  return async (request) => {
    const response = await client.messages.parse({
      model: CLAUDE_SCREENING_MODEL,
      max_tokens: 4096,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      output_config: { effort: "medium", format: zodOutputFormat(ClaudeScreeningOutput) },
    });
    if (response.stop_reason === "refusal") {
      throw new ClaudeScreeningError(`The model declined to screen ${request.title}: ${response.stop_details?.explanation ?? "no explanation"}.`);
    }
    if (response.stop_reason === "max_tokens") {
      throw new ClaudeScreeningError(`The model ran out of output tokens on ${request.title}.`);
    }
    if (!response.parsed_output) throw new ClaudeScreeningError(`The model answer for ${request.title} did not parse.`);
    return response.parsed_output;
  };
}

export function createClaudeClient(apiKey: string | undefined): Anthropic {
  if (!apiKey) {
    throw new ClaudeScreeningError(
      "ANTHROPIC_API_KEY is not set. Put it in .env (server-only, never NEXT_PUBLIC_) or replay a --transcript.",
    );
  }
  return new Anthropic({ apiKey, maxRetries: 3 });
}

export type ClaudeScreeningProviderOptions = {
  completion: ClaudeScreeningCompletion;
  /** Called after every answer, for example to record it into a transcript. */
  onAnswer?: (request: ClaudeScreeningRequest, raw: unknown) => void;
};

/** The SuggestionProvider. Deterministic given a completion; the completion decides the transport. */
export function createClaudeSuggestionProvider(
  options: ClaudeScreeningProviderOptions,
): (candidate: SuggestionCandidate) => Promise<MachineSuggestion> {
  return async (candidate) => {
    const request = buildClaudeScreeningRequest(candidate);
    const raw = await options.completion(request);
    const suggestion = parseClaudeSuggestion(raw, candidate);
    options.onAnswer?.(request, raw);
    return suggestion;
  };
}
