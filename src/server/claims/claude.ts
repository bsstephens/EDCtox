import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import { type ClaimPaper } from "./apply";
import { type ClaimDraft, type MechanismCatalog, resolveMechanismCode } from "./extract";

/**
 * Model-backed mechanistic claim extraction. Slice 4B of docs/AGENT_PIPELINE_DESIGN.md.
 *
 * Replaces 400 lines of pattern matching that could only read bisphenol A and could only find
 * the relations someone had written a rule for. The seam is unchanged: this produces the same
 * ClaimDraft the rule-based extractor produces, and the same apply path stores it.
 *
 * A claim is a candidate reading of one sentence. It is not evidence, it is not a finding, and
 * nothing here may change a score. The curator columns are untouched, every claim lands
 * unverified, and a mechanism is only ever attached when the ontology already holds that code.
 */

export const CLAUDE_CLAIM_PROVIDER = "claude";
/**
 * Haiku rather than Opus, which is a change from decision 3 of docs/AGENT_PIPELINE_DESIGN.md.
 *
 * Opus 5.5 refuses this task. Run against the five pilot abstracts on 20 Nov 2026 it returned
 * stop_reason "refusal" with category "bio" on all five, cutting the answer off mid-string after
 * emitting valid JSON; Haiku 5.5 completed all five. The content is ordinary published
 * toxicology, the same abstracts Haiku had already read 90 of while profiling, so this looks
 * like a false positive on the subject matter rather than anything about the request.
 *
 * No attempt is made to reword the prompt around it. The documented remedy is a fallback model,
 * and Haiku is that fallback until the behaviour changes or Scott raises it with Anthropic.
 */
export const CLAUDE_CLAIM_MODEL = "claude-haiku-5-5";
export const CLAUDE_CLAIM_PROMPT_VERSION = "claim-abstract-claude-v2";

export class ClaudeClaimError extends Error {}

export const CLAUDE_CLAIM_SYSTEM_PROMPT = `You read one scientific abstract and record the mechanistic claims it states, as a list of subject-relation-object triples. The subject is always the compound named to you. You are building a candidate list for a curator to check, not deciding what is true.

Rules:
- Record only what the abstract states. Do not add a claim because it is well known, because the compound is associated with it elsewhere, or because the title implies it. If the abstract does not say it, it is not there.
- One claim per distinct stated relationship. Do not split one finding into several claims, and do not merge two findings into one.
- objectText is the thing affected, in the abstract's own words: a receptor, an enzyme, a gene, a hormone, a cell type, a process, or an outcome. Do not translate it into a standard vocabulary and do not expand an abbreviation the abstract did not expand.
- relation is what the abstract says happened. NO_EFFECT is a real and useful answer when the abstract reports that nothing changed; record it rather than dropping the finding.
- machineDirectness says how firmly this abstract supports this claim. Grade the sentence you quoted, not the quality of the journal, not how plausible the claim is, and not how confident the authors sound. Most sentences in most abstracts do not reach the top of this list. Work down it and stop at the first level that fits:
  - DIRECTLY_DEMONSTRATED: not available from an abstract. Do not use it.
  - STRONGLY_SUPPORTED: the quoted sentence reports a measurement these authors made, on this compound, with a direction, and carries a number, a named assay, or a stated comparison against a control. "BPA reduced aromatase mRNA by 40% at 10 nM in granulosa cells."
  - CONSISTENT_WITH: the quoted sentence reports a real observation that fits the claim without isolating it. A correlation or an association; a change in a downstream marker offered as evidence of an upstream mechanism; a result in one tissue or species read across to another; or a measured change with no direction, no comparison and no control stated. "Exposed animals showed altered expression of steroidogenic genes."
  - INFERRED: the quoted sentence states the relationship, but this paper did not measure it. The authors are restating earlier work, as a review or an introduction does, or drawing the relationship out of their own results rather than testing it. "These findings indicate disruption of ovarian steroidogenesis."
  - HYPOTHESIZED: the quoted sentence proposes, suggests or speculates the relationship, or leaves it to future work. "We propose that this contributes to impaired steroidogenesis", "may play a role", "warrants further investigation".
  Two things override the list. If a sentence fits two levels, take the lower one. If this paper is a review, then any sentence that is not a result these authors measured themselves is INFERRED at best, however firmly it is worded.
- quotedSupport is the sentence from the abstract that carries the claim, copied exactly and not paraphrased. If you cannot quote a sentence, you do not have a claim.
- species, tissue, cell type and dose are recorded only when the abstract gives them for this claim. Leave them empty otherwise rather than carrying them over from another sentence.
- machineRationale is one sentence on why this reading is right. No reasoning steps.
- Return an empty list when the abstract states no mechanistic relationship at all. That is a correct answer and a common one for an epidemiological summary with no mechanism in it.`;

const RELATIONS = [
  "BINDS",
  "AGONIZES",
  "ANTAGONIZES",
  "INHIBITS",
  "ACTIVATES",
  "INCREASES_EXPRESSION",
  "DECREASES_EXPRESSION",
  "INCREASES_LEVEL",
  "DECREASES_LEVEL",
  "IMPAIRS_FUNCTION",
  "ENHANCES_FUNCTION",
  "CONTRIBUTES_TO",
  "ASSOCIATED_WITH",
  "NO_EFFECT",
  "OTHER",
] as const;

const OBJECT_TYPES = [
  "CHEMICAL",
  "RECEPTOR",
  "ENZYME",
  "GENE",
  "PROTEIN",
  "BIOMARKER",
  "CELL",
  "TISSUE",
  "ORGAN",
  "PHYSIOLOGICAL_PROCESS",
  "CELLULAR_PROCESS",
  "PHENOTYPE",
  "OUTCOME",
  "OTHER",
] as const;

const DIRECTNESS = [
  "DIRECTLY_DEMONSTRATED",
  "STRONGLY_SUPPORTED",
  "CONSISTENT_WITH",
  "INFERRED",
  "HYPOTHESIZED",
  "UNKNOWN",
] as const;

export const ClaudeClaimOutput = z.object({
  claims: z
    .array(
      z.object({
        relation: z.enum(RELATIONS),
        objectType: z.enum(OBJECT_TYPES),
        objectText: z.string().min(1).max(160),
        directness: z.enum(DIRECTNESS),
        confidence: z.enum(["LOW", "MODERATE", "HIGH"]),
        quotedSupport: z.string().min(1).max(600),
        rationale: z.string().min(1).max(400),
        // No length limit on the four context fields. A verbose answer here is not a wrong
        // answer, and the whole response is one structured object: the first pilot run lost a
        // paper's 15 good claims because one tissueText ran to 130 characters. They are
        // truncated to the column width in parseClaims instead.
        speciesText: z.string(),
        tissueText: z.string(),
        cellTypeText: z.string(),
        doseText: z.string(),
      }),
    )
    .max(40),
});

export type ClaudeClaimOutput = z.infer<typeof ClaudeClaimOutput>;

export type ClaimRequest = {
  evidenceSourceId: string;
  title: string;
  system: string;
  user: string;
  promptSha256: string;
};

export function buildClaimRequest(paper: ClaimPaper, compoundName: string): ClaimRequest {
  if (!paper.abstractText?.trim()) {
    throw new ClaudeClaimError(`${paper.title} has no abstract stored, so no claim can be read from it.`);
  }
  const user = [
    `Compound: ${compoundName}`,
    `Title: ${paper.title}`,
    "",
    "Abstract:",
    paper.abstractText.trim(),
  ].join("\n");
  return {
    evidenceSourceId: paper.evidenceSourceId,
    title: paper.title,
    system: CLAUDE_CLAIM_SYSTEM_PROMPT,
    user,
    promptSha256: createHash("sha256")
      .update(`${CLAUDE_CLAIM_PROMPT_VERSION}\n${CLAUDE_CLAIM_SYSTEM_PROMPT}\n${user}`)
      .digest("hex"),
  };
}

/** Null for a field the abstract did not give, trimmed to the column width otherwise. */
const empty = (value: string, limit: number): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1).trimEnd()}\u2026`;
};

/**
 * Turns the model's answer into claim drafts.
 *
 * Two rules are enforced here rather than asked for. A claim whose quoted sentence is not in the
 * abstract is dropped, because a quotation that cannot be found is the clearest signal that a
 * reading was invented. And an abstract can only ever support so much: a directness of
 * DIRECTLY_DEMONSTRATED is capped to STRONGLY_SUPPORTED, since full text is where a
 * demonstration can actually be checked and this stage never sees it.
 */
export function parseClaims(
  raw: unknown,
  input: {
    paper: ClaimPaper;
    compoundName: string;
    catalog: MechanismCatalog;
    /**
     * Proposes a mechanism code for the thing the claim is about, by exact name, the same
     * deterministic way routing matches a compound. The model is never shown the 280 ontology
     * codes: that would cost a fortune per paper and invite it to reach for a near miss.
     * Whatever this proposes is then validated by resolveMechanismCode, which refuses a
     * grouping-only parent and refuses to read a bare ATP change as electron transport.
     */
    mechanismCodeFor: (objectText: string) => string | null;
  },
): { drafts: ClaimDraft[]; dropped: Array<{ objectText: string; why: string }> } {
  const parsed = ClaudeClaimOutput.safeParse(raw);
  if (!parsed.success) {
    throw new ClaudeClaimError(
      `The model answer is not a claim list: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const haystack = (input.paper.abstractText ?? "").replace(/\s+/g, " ").toLowerCase();
  const drafts: ClaimDraft[] = [];
  const dropped: Array<{ objectText: string; why: string }> = [];
  // One claim per distinct relationship. The prompt asks for this and the first real run still
  // returned the same gene seven times over from one expression panel, so it is enforced here.
  const seen = new Set<string>();

  for (const claim of parsed.data.claims) {
    const identity = `${claim.relation}|${claim.objectText.trim().toLowerCase()}`;
    if (seen.has(identity)) {
      dropped.push({ objectText: claim.objectText, why: "the same relation and object was already read" });
      continue;
    }
    seen.add(identity);
    const quote = claim.quotedSupport.replace(/\s+/g, " ").trim();
    if (!haystack.includes(quote.toLowerCase())) {
      dropped.push({ objectText: claim.objectText, why: "the quoted sentence is not in the abstract" });
      continue;
    }
    const directness = claim.directness === "DIRECTLY_DEMONSTRATED" ? "STRONGLY_SUPPORTED" : claim.directness;
    const proposed = input.mechanismCodeFor(claim.objectText);
    const mapping = resolveMechanismCode(proposed, claim.objectText, input.catalog);
    const mechanismCode = mapping.mechanismCode;
    drafts.push({
      subjectType: "CHEMICAL",
      subjectText: input.compoundName,
      relation: claim.relation,
      objectType: claim.objectType,
      objectText: claim.objectText.trim(),
      machineDirectness: directness,
      machineConfidence: claim.confidence,
      machineRationale: claim.rationale.trim(),
      machineMappingState: mapping.mappingState,
      mechanismCode,
      mechanismId: mapping.mechanismId,
      speciesText: empty(claim.speciesText, 120),
      tissueText: empty(claim.tissueText, 120),
      cellTypeText: empty(claim.cellTypeText, 120),
      doseText: empty(claim.doseText, 160),
      measureType: null,
      measureValue: null,
      measureUnit: null,
      textOrigin: "ABSTRACT",
      sourceSection: "Abstract",
      quotedSupport: quote,
      // Every machine claim is a candidate. A low review priority means the edge is explicit and
      // cheap to check, never that it has been accepted.
      reviewPriority: mechanismCode ? "REVIEW_RECOMMENDED" : "REVIEW_REQUIRED",
      reviewDerived: directness === "INFERRED" || directness === "HYPOTHESIZED",
    });
  }
  return { drafts, dropped };
}

export type ClaimCompletion = (request: ClaimRequest) => Promise<unknown>;

export type ClaimTranscript = {
  promptVersion: string;
  entries: Record<string, { title: string; promptSha256: string; model: string; response: unknown }>;
};

export function readClaimTranscript(path: string): ClaimTranscript {
  if (!existsSync(path)) return { promptVersion: CLAUDE_CLAIM_PROMPT_VERSION, entries: {} };
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("entries" in parsed)) {
    throw new ClaudeClaimError(`${path} is not a claim transcript.`);
  }
  const transcript = parsed as ClaimTranscript;
  if (transcript.promptVersion !== CLAUDE_CLAIM_PROMPT_VERSION) {
    throw new ClaudeClaimError(
      `${path} was recorded with prompt ${transcript.promptVersion}, not ${CLAUDE_CLAIM_PROMPT_VERSION}.`,
    );
  }
  return transcript;
}

export function writeClaimTranscript(path: string, transcript: ClaimTranscript): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(transcript, null, 2)}\n`);
}

export function transcriptCompletion(transcript: ClaimTranscript): ClaimCompletion {
  return (request) => {
    const entry = transcript.entries[request.evidenceSourceId];
    if (!entry) return Promise.reject(new ClaudeClaimError(`No recorded answer for ${request.title}.`));
    if (entry.promptSha256 !== request.promptSha256) {
      return Promise.reject(
        new ClaudeClaimError(`The recorded answer for ${request.title} was made for a different prompt.`),
      );
    }
    return Promise.resolve(entry.response);
  };
}

export function apiCompletion(client: Anthropic): ClaimCompletion {
  return async (request) => {
    const response = await client.messages.parse({
      model: CLAUDE_CLAIM_MODEL,
      // An abstract yields a handful of claims, but each carries a quoted sentence and a
      // rationale, so the structured answer is long. The first run truncated mid-string at
      // 8192 with high effort, which spends the budget on reasoning this task does not need.
      max_tokens: 16384,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      output_config: { effort: "medium", format: zodOutputFormat(ClaudeClaimOutput) },
    });
    if (response.stop_reason === "refusal") {
      throw new ClaudeClaimError(
        `The model declined to read ${request.title}: ${response.stop_details?.explanation ?? "no explanation"}.`,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new ClaudeClaimError(`The model ran out of output tokens on ${request.title}.`);
    }
    if (!response.parsed_output) throw new ClaudeClaimError(`The model answer for ${request.title} did not parse.`);
    return response.parsed_output;
  };
}

export function createClaimClient(apiKey: string | undefined): Anthropic {
  if (!apiKey) {
    throw new ClaudeClaimError(
      "ANTHROPIC_API_KEY is not set. Put it in .env (server-only, never NEXT_PUBLIC_) or replay a transcript.",
    );
  }
  return new Anthropic({ apiKey, maxRetries: 3 });
}

/** The extractor, in the shape applyMachineClaims already accepts. */
export function createClaudeExtractor(options: {
  completion: ClaimCompletion;
  compoundNameFor: (paper: ClaimPaper) => string;
  mechanismCodeFor: (objectText: string) => string | null;
  onAnswer?: (request: ClaimRequest, raw: unknown) => void;
  onDropped?: (paper: ClaimPaper, dropped: Array<{ objectText: string; why: string }>) => void;
}) {
  return async (paper: ClaimPaper, catalog: MechanismCatalog): Promise<ClaimDraft[]> => {
    const compoundName = options.compoundNameFor(paper);
    const request = buildClaimRequest(paper, compoundName);
    const raw = await options.completion(request);
    const { drafts, dropped } = parseClaims(raw, {
      paper,
      compoundName,
      catalog,
      mechanismCodeFor: options.mechanismCodeFor,
    });
    options.onAnswer?.(request, raw);
    if (dropped.length > 0) options.onDropped?.(paper, dropped);
    return drafts;
  };
}
