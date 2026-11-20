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
export const CLAUDE_CLAIM_PROMPT_VERSION = "claim-abstract-claude-v4";

export class ClaudeClaimError extends Error {}

export const CLAUDE_CLAIM_SYSTEM_PROMPT = `You read one scientific abstract and record the mechanistic claims it states, as a list of subject-relation-object triples. The subject is always the compound named to you. You are building a candidate list for a curator to check, not deciding what is true.

Rules:
- Record only what the abstract states. Do not add a claim because it is well known, because the compound is associated with it elsewhere, or because the title implies it. If the abstract does not say it, it is not there.
- One claim per distinct stated relationship. Do not split one finding into several claims, and do not merge two findings into one.
- objectText is the thing affected, in the abstract's own words: a receptor, an enzyme, a gene, a hormone, a cell type, a process, or an outcome. Do not translate it into a standard vocabulary and do not expand an abbreviation the abstract did not expand.
- objectHead names the same thing with every qualifier removed, so that two abstracts describing one entity give the same objectHead. Drop where it was measured, in which sex or group, by what assay, in what medium, and at what dose. Keep the entity and nothing else. Still the abstract's own words, still no translation and no expanded abbreviation.
    objectText "ERα immunoreactive neurons in the BST, Arc, VMH and MeA of female mice" -> objectHead "ERα"
    objectText "estradiol concentration in the culture medium" -> objectHead "estradiol"
    objectText "cellular viability and counts" -> objectHead "cell viability"
    objectText "CYP19A1 expression" -> objectHead "CYP19A1"
  When objectText is already the bare entity, repeat it unchanged.
- relation is what the abstract says happened. NO_EFFECT is a real and useful answer when the abstract reports that nothing changed; record it rather than dropping the finding.
- Several relations can describe one finding, so choose by what the abstract measured, not by how it is phrased. Take the first of these that applies:
    an amount of a transcript or a protein -> INCREASES_EXPRESSION / DECREASES_EXPRESSION
    an amount of anything else: a hormone, a metabolite, a cell count, a concentration -> INCREASES_LEVEL / DECREASES_LEVEL
    a functional assay: enzyme activity, viability, motility, fertility, a behavioural measure -> ENHANCES_FUNCTION / IMPAIRS_FUNCTION
    a receptor or pathway switched on or off -> ACTIVATES / INHIBITS, or AGONIZES / ANTAGONIZES where the abstract says the compound acts at the receptor itself
    a measured affinity or binding -> BINDS
    a disease, lesion or phenotype the abstract says the exposure helps bring about -> CONTRIBUTES_TO
    a statistical association in a population, with no mechanism measured -> ASSOCIATED_WITH
  Use OTHER only when none of these fits. Do not reach for CONTRIBUTES_TO because a finding sounds important, and do not reach for a functional relation because the entity has a function: a measured amount is a level or an expression change even when the authors discuss what it means for function.
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
        objectText: z.string().min(1),
        // The entity with its qualifiers stripped. Mapping is attempted on this, because the
        // verbose form drifts between runs ("ERa immunoreactive neurons in the BST, Arc, VMH and
        // MeA" one run, "ERa immunoreactive neurons" the next) and never matches the ontology.
        objectHead: z.string().min(1),
        directness: z.enum(DIRECTNESS),
        confidence: z.enum(["LOW", "MODERATE", "HIGH"]),
        quotedSupport: z.string().min(1),
        rationale: z.string().min(1),
        // No length limit on any field here, deliberately. Every one of these columns is
        // Postgres text, so the limits this schema used to carry corresponded to nothing in the
        // database, and each one could discard a whole paper: the response is a single
        // structured object, so one overlong field fails the parse and the other fourteen good
        // claims go with it. That happened twice in the pilot, on a paper whose finding spans
        // four brain regions. Labels are trimmed for hygiene in parseClaims; a long quotation
        // is left alone, because it is checked against the abstract anyway.
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

/**
 * These are labels, not prose, and the columns behind them are unlimited. The cap is hygiene:
 * a label this long means the model wrote a sentence where a term belongs, and that is worth
 * seeing in the data rather than silently storing a paragraph. It is generous enough that no
 * real answer reaches it.
 */
const LABEL_LIMIT = 240;

const label = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length <= LABEL_LIMIT ? trimmed : `${trimmed.slice(0, LABEL_LIMIT - 1).trimEnd()}\u2026`;
};

/** Null for a field the abstract did not give, a trimmed label otherwise. */
const empty = (value: string): string | null => (value.trim() ? label(value) : null);

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
    /** Tried only when the mechanism ontology holds nothing: a claim points at one or the other. */
    outcomeCodeFor?: (objectText: string, relation: string) => string | null;
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
    // Keyed on the head, not the verbose text: one run returned the same gene seven times from
    // a single panel, and two phrasings of one relationship are still one relationship.
    const identity = `${claim.relation}|${claim.objectHead.trim().toLowerCase()}`;
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
    // The head first, then the verbatim text: a paper that writes the bare entity gives the
    // same answer either way, and one that writes a qualified phrase only resolves on the head.
    const proposed = input.mechanismCodeFor(claim.objectHead) ?? input.mechanismCodeFor(claim.objectText);
    const mapping = resolveMechanismCode(proposed, claim.objectText, input.catalog);
    // Only when no mechanism holds it. A third of what a model reads from a reproductive
    // abstract is an outcome -- sperm count, cryptorchidism, PCOS -- and those claims had
    // nowhere to point, so they were indistinguishable from a gap in the mechanism ontology.
    const outcomeCode = mapping.mechanismCode
      ? null
      : (input.outcomeCodeFor?.(claim.objectHead, claim.relation) ??
        input.outcomeCodeFor?.(claim.objectText, claim.relation) ??
        null);
    const mechanismCode = mapping.mechanismCode;
    drafts.push({
      objectHead: claim.objectHead.trim(),
      subjectType: "CHEMICAL",
      subjectText: input.compoundName,
      relation: claim.relation,
      objectType: claim.objectType,
      objectText: label(claim.objectText),
      machineDirectness: directness,
      machineConfidence: claim.confidence,
      machineRationale: claim.rationale.trim(),
      machineMappingState: outcomeCode ? "CANDIDATE" : mapping.mappingState,
      outcomeCode,
      mechanismCode,
      mechanismId: mapping.mechanismId,
      speciesText: empty(claim.speciesText),
      tissueText: empty(claim.tissueText),
      cellTypeText: empty(claim.cellTypeText),
      doseText: empty(claim.doseText),
      measureType: null,
      measureValue: null,
      measureUnit: null,
      textOrigin: "ABSTRACT",
      sourceSection: "Abstract",
      quotedSupport: quote,
      // Every machine claim is a candidate. A low review priority means the edge is explicit and
      // cheap to check, never that it has been accepted.
      reviewPriority: mechanismCode || outcomeCode ? "REVIEW_RECOMMENDED" : "REVIEW_REQUIRED",
      reviewDerived: directness === "INFERRED" || directness === "HYPOTHESIZED",
    });
  }
  return { drafts, dropped };
}

/** `pass` is zero for a single-pass run, and identifies the repeat otherwise. */
export type ClaimCompletion = (request: ClaimRequest, pass: number) => Promise<unknown>;

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

/** A pass has its own recorded answer; `#0` falls back to the bare id for older transcripts. */
export function transcriptKey(evidenceSourceId: string, pass: number): string {
  return pass === 0 ? evidenceSourceId : `${evidenceSourceId}#${pass}`;
}

export function transcriptCompletion(transcript: ClaimTranscript): ClaimCompletion {
  return (request, pass) => {
    const entry = transcript.entries[transcriptKey(request.evidenceSourceId, pass)];
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
    // The pass index is not sent: each pass is the same request, and the answers differ only
    // because the model is sampled. Nothing here tells the model it is being asked twice.
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

/** The identity of a relationship, independent of how a given pass phrased the object. */
function draftIdentity(draft: ClaimDraft): string {
  return `${draft.relation}|${(draft.objectHead ?? draft.objectText).trim().toLowerCase()}`;
}

const UP = ["INCREASES", "ACTIVATES", "ENHANCES", "AGONIZES"];
const DOWN = ["DECREASES", "INHIBITS", "IMPAIRS", "ANTAGONIZES"];

/** Up, down, or neither. Direction held across every pilot run where the verb did not. */
function direction(relation: ClaimDraft["relation"]): string {
  if (UP.some((word) => relation.includes(word))) return "up";
  if (DOWN.some((word) => relation.includes(word))) return "down";
  return relation;
}

function head(draft: ClaimDraft): string {
  return (draft.objectHead ?? draft.objectText).trim().toLowerCase();
}

/**
 * Whether two drafts from different passes are the same finding read twice.
 *
 * objectHead was meant to settle this, and mostly does, but the model sometimes copies the
 * whole phrase into it rather than stripping the qualifiers — it did exactly that on the one
 * case the prompt teaches by example, so the field cannot be relied on alone.
 *
 * This is the fallback, and it is exact rather than fuzzy. Two drafts match only when they
 * quote the very same sentence, agree on direction, and one entity name contains the other.
 * The quotation is already verified to appear in the abstract, so it is hard evidence that both
 * readings came from one statement. The containment test is what keeps a sentence carrying two
 * findings — "BPA reduced estradiol and progesterone" — as two claims, since neither name
 * contains the other. Nothing here maps a term onto a neighbour or invents a node.
 */
function sameFinding(a: ClaimDraft, b: ClaimDraft): boolean {
  if (a.quotedSupport !== b.quotedSupport) return false;
  if (direction(a.relation) !== direction(b.relation)) return false;
  const [x, y] = [head(a), head(b)];
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Reads one paper more than once and keeps the union.
 *
 * Three runs of the same five papers agreed on only about 70% of the entities they found, and
 * the disagreements were not errors: the claims each run returned were sound, but which of the
 * marginal findings counted as a claim at all moved between runs. A single pass therefore
 * misses roughly a third of the borderline claims it could have found, which is a recall
 * problem rather than a correctness one, so the answer is to ask again and take both.
 *
 * A claim that only some passes found is still a claim worth a curator's time, but it is a
 * weaker one than a claim every pass found, so it goes to the queue as REVIEW_REQUIRED whether
 * or not it mapped. The model's own stated confidence is left alone: it said how sure it was of
 * its reading, and that is a different question from whether a repeat of the same request
 * happened to surface the same finding.
 */
export function unionPasses(perPass: readonly ClaimDraft[][]): {
  drafts: ClaimDraft[];
  agreement: Map<string, number>;
} {
  const passes = perPass.length;
  const first = new Map<string, ClaimDraft>();
  const seen = new Map<string, number>();
  for (const drafts of perPass) {
    // Within one pass the same relationship is already deduplicated, but guard anyway so a
    // repeat inside a single answer cannot look like agreement between passes.
    const here = new Set<string>();
    for (const draft of drafts) {
      // The head, then the same-sentence fallback for a pass that did not strip it.
      let id = draftIdentity(draft);
      if (!first.has(id)) {
        const merged = [...first].find(([, kept]) => sameFinding(kept, draft));
        if (merged) id = merged[0];
      }
      if (!first.has(id)) first.set(id, draft);
      if (!here.has(id)) {
        here.add(id);
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }
    }
  }
  const drafts = [...first].map(([id, draft]) => {
    const found = seen.get(id) ?? 0;
    const counted = { ...draft, machinePassesSeen: found, machinePassesRun: passes };
    return found === passes ? counted : { ...counted, reviewPriority: "REVIEW_REQUIRED" as const };
  });
  return { drafts, agreement: seen };
}

/** The extractor, in the shape applyMachineClaims already accepts. */
export function createClaudeExtractor(options: {
  completion: ClaimCompletion;
  compoundNameFor: (paper: ClaimPaper) => string;
  mechanismCodeFor: (objectText: string) => string | null;
  /** Tried only when the mechanism ontology holds nothing: a claim points at one or the other. */
  outcomeCodeFor?: (objectText: string, relation: string) => string | null;
  /** How many times to read each paper. Defaults to one; two is what the pilot settled on. */
  passes?: number;
  onAnswer?: (request: ClaimRequest, raw: unknown, pass: number) => void;
  onDropped?: (paper: ClaimPaper, dropped: Array<{ objectText: string; why: string }>) => void;
  onAgreement?: (paper: ClaimPaper, agreement: ReadonlyMap<string, number>, passes: number) => void;
  onPassFailed?: (paper: ClaimPaper, pass: number, error: unknown) => void;
}) {
  const passes = Math.max(1, options.passes ?? 1);
  return async (paper: ClaimPaper, catalog: MechanismCatalog): Promise<ClaimDraft[]> => {
    const compoundName = options.compoundNameFor(paper);
    const request = buildClaimRequest(paper, compoundName);
    const perPass: ClaimDraft[][] = [];
    let lastError: unknown;
    for (let pass = 0; pass < passes; pass += 1) {
      try {
        const raw = await options.completion(request, pass);
        const { drafts, dropped } = parseClaims(raw, {
          paper,
          compoundName,
          catalog,
          mechanismCodeFor: options.mechanismCodeFor,
          outcomeCodeFor: options.outcomeCodeFor,
        });
        options.onAnswer?.(request, raw, pass);
        if (dropped.length > 0) options.onDropped?.(paper, dropped);
        perPass.push(drafts);
      } catch (error) {
        // A pass can fail outright: the answer is one structured object, so a single claim
        // carrying a relation outside the vocabulary fails the parse and the other fourteen go
        // with it. That cost this pilot a whole paper in three runs of six. The enum stays in
        // the schema, because it is what steers generation and makes the failure rare; what
        // changes is that one bad pass no longer loses the paper when another pass answered.
        // Only if every pass fails does the paper fail, and then with the real error.
        lastError = error;
        options.onPassFailed?.(paper, pass, error);
      }
    }
    if (perPass.length === 0) {
      if (lastError instanceof Error) throw lastError;
      throw new ClaudeClaimError(`No pass answered for ${paper.title}.`);
    }
    if (perPass.length === 1) return perPass[0] ?? [];
    const { drafts, agreement } = unionPasses(perPass);
    // The denominator is the passes that answered, not the passes asked for, so a claim is not
    // marked as disputed merely because the pass that would have confirmed it never returned.
    options.onAgreement?.(paper, agreement, perPass.length);
    return drafts;
  };
}
