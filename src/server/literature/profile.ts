import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import { type ProviderFacts, substancesSupport } from "./providerFacts";

/**
 * Layer 1 of docs/SCREENING_REDESIGN.md: read a paper once, record what it is about.
 *
 * The question asked here is deliberately not "does this belong in the BPA reproductive queue".
 * That question has to be asked once per compound and domain, which is what made screening need
 * a curator. This asks only what the paper studies and reports, which is a property of the paper,
 * and layer 2 derives every context from the answer without a second model call.
 *
 * Nothing here decides anything. No score, no inclusion, no evidence. A profile is a reading.
 */

export const PROFILE_PROVIDER = "claude";
export const PROFILE_MODEL = "claude-haiku-5-5";
export const PROFILE_PROMPT_VERSION = "paper-profile-v2";

export class PaperProfileError extends Error {}

export const PROFILE_SYSTEM_PROMPT = `You read one scientific publication at a time for EDCtox, a research database of chemicals and the biological mechanisms they act on. You are given a title and an abstract, and sometimes the indexing a bibliographic database has already assigned.

Record what the publication is about. Do not decide whether it is good, whether it should be included anywhere, or whether any chemical is harmful. Those are other people's jobs and later steps.

Rules:
- Report only what the title and abstract support. If the abstract does not say, leave the field empty rather than inferring from the title, the journal, or what is usually true.
- Name compounds as the publication names them. Do not translate a specific chemical into its class, and do not translate a class into an example. Two chemicals whose names differ by a letter or a number are different chemicals and must not be merged. If the publication studies a mixture or a class without naming members, say so in those words.
- Report outcomes and endpoints in the publication's own words, not in any standard vocabulary.
- measuresOutcome is false when the publication measures exposure, concentrations, or a method and reports no biological outcome at all. A chemical found in a product with no health endpoint is false. If an outcome is reported, however briefly, it is true.
- notAbout is for the case where a title or a keyword search would mislead: the abstract is mostly about something else, the named chemical is a comparator rather than the subject, or the publication is about a different field entirely. Leave it empty when the title is a fair description.
- evidenceSynthesis says what kind of document this is, by what the publication says it did, never by what it cites. A publication that states it searched databases systematically, screened against criteria, or pooled results is SYSTEMATIC_REVIEW, or META_ANALYSIS when it pooled estimates statistically. A publication that surveys a field without a stated method is NARRATIVE_REVIEW, even when the evidence it discusses includes meta-analyses. A publication reporting its own experiments or its own cohort is NOT_A_REVIEW.
- The rationale is one short paragraph saying what the publication did. No reasoning steps, no recommendations.

You are reading an abstract, which is a summary. Abstracts omit things. Saying less is correct when the abstract says less.`;

// The caps are a guard against runaway output, not a way of shaping the answer. Five reviews
// in the first full run listed more endpoints, or summarised at more length, than the original
// limits allowed and were refused outright. Widening only relaxes what validates, so profiles
// already stored under the tighter bounds remain valid and are not re-read.
export const PaperProfileOutput = z.object({
  compoundsStudied: z
    .array(z.string().min(1).max(120))
    .max(40)
    .describe("Chemicals the publication studies, named as the publication names them."),
  outcomesReported: z
    .array(z.string().min(1).max(160))
    .max(40)
    .describe("Outcomes and endpoints reported, in the publication's own words."),
  speciesStudied: z
    .array(z.string().min(1).max(80))
    .max(12)
    .describe("Species or systems studied, as stated. Empty if the abstract does not say."),
  exposureNotes: z.string().max(400).describe("Route, dose framing and life stage where given. Empty otherwise."),
  studyDesign: z.string().max(300).describe("Design beyond the publication type. Empty if the abstract does not say."),
  evidenceSynthesis: z
    .enum(["META_ANALYSIS", "SYSTEMATIC_REVIEW", "NARRATIVE_REVIEW", "NOT_A_REVIEW"])
    .describe("What this publication did, never what it cites."),
  measuresOutcome: z.boolean().describe("False only when no biological outcome is reported at all."),
  notAbout: z.string().max(300).describe("What a reader might wrongly expect. Empty when the title is fair."),
  rationale: z.string().min(1).max(1500).describe("One short paragraph on what the publication did."),
});

export type PaperProfileOutput = z.infer<typeof PaperProfileOutput>;

export type ProfileCandidate = {
  evidenceSourceId: string;
  title: string;
  abstractText: string | null;
  year: number | null;
  journal: string | null;
  /** Provider facts, when the record is indexed. Given to the model as context, never as an answer. */
  facts: ProviderFacts;
};

export type ProfileRequest = {
  evidenceSourceId: string;
  title: string;
  system: string;
  user: string;
  promptSha256: string;
};

export function buildProfileRequest(candidate: ProfileCandidate): ProfileRequest {
  if (!candidate.abstractText?.trim()) {
    throw new PaperProfileError(`${candidate.title} has no abstract stored, so it cannot be profiled.`);
  }
  const indexing = candidate.facts.indexed
    ? [
        `Publication type: ${candidate.facts.evidenceSynthesis ?? (candidate.facts.narrativeReview ? "review" : "research article")}.`,
        candidate.facts.humans !== null
          ? `Indexed species: ${[candidate.facts.humans ? "humans" : null, candidate.facts.animals ? "animals" : null].filter(Boolean).join(" and ") || "neither humans nor animals"}.`
          : null,
        candidate.facts.substances.length > 0
          ? `Indexed substances: ${candidate.facts.substances.join("; ")}.`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "This record has not been indexed, so no external indexing is available.";

  const user = [
    `Title: ${candidate.title}`,
    candidate.journal ? `Journal: ${candidate.journal}` : null,
    candidate.year ? `Year: ${candidate.year}` : null,
    "",
    "External indexing, for context only. It is not the answer and it can be incomplete or wrong:",
    indexing,
    "",
    "Abstract:",
    candidate.abstractText.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    evidenceSourceId: candidate.evidenceSourceId,
    title: candidate.title,
    system: PROFILE_SYSTEM_PROMPT,
    user,
    promptSha256: createHash("sha256")
      .update(`${PROFILE_PROMPT_VERSION}\n${PROFILE_SYSTEM_PROMPT}\n${user}`)
      .digest("hex"),
  };
}

export function parseProfile(raw: unknown): PaperProfileOutput {
  const parsed = PaperProfileOutput.safeParse(raw);
  if (!parsed.success) {
    throw new PaperProfileError(
      `The model answer is not a paper profile: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const value = parsed.data;
  if (value.compoundsStudied.length === 0 && value.measuresOutcome) {
    // A paper that reports an outcome must say what was given. An empty list here means the
    // read failed rather than that the paper studied nothing.
    throw new PaperProfileError("The model reported an outcome but named no compound.");
  }
  return value;
}

/**
 * Where the model's reading and the provider's indexing disagree.
 *
 * This is the continuous quality signal that replaces a curator gold set for the facts PubMed
 * indexes. It covers every indexed paper rather than a sample and costs nothing. An unindexed
 * paper produces no flags, which is correct: silence is not agreement.
 */
export type ProfileDisagreement = { field: string; model: string; provider: string };

export function profileDisagreements(
  profile: PaperProfileOutput,
  facts: ProviderFacts,
): ProfileDisagreement[] {
  const flags: ProfileDisagreement[] = [];
  if (!facts.indexed) return flags;

  const saysHuman = profile.speciesStudied.some((value) => /human|patient|men\b|women\b|child/i.test(value));
  const saysAnimal = profile.speciesStudied.some((value) =>
    /rat\b|rats\b|mice|mouse|zebrafish|rabbit|animal|in vivo rodent|porcine|bovine/i.test(value),
  );
  if (saysHuman && facts.humans === false) {
    flags.push({ field: "species", model: "names a human population", provider: "not indexed for humans" });
  }
  if (saysAnimal && facts.animals === false) {
    flags.push({ field: "species", model: "names an animal model", provider: "not indexed for animals" });
  }

  const supported = substancesSupport(facts, profile.compoundsStudied);
  if (supported === false) {
    flags.push({
      field: "compounds",
      model: profile.compoundsStudied.join("; ") || "none",
      provider: facts.substances.join("; "),
    });
  }
  return flags;
}

/** One answer, as raw JSON. The API, a transcript and a test fixture all fit this shape. */
export type ProfileCompletion = (request: ProfileRequest) => Promise<unknown>;

export type ProfileTranscriptEntry = {
  title: string;
  promptSha256: string;
  model: string;
  response: unknown;
  usage?: { inputTokens: number; outputTokens: number };
  recordedAt?: string;
};

export type ProfileTranscript = { promptVersion: string; entries: Record<string, ProfileTranscriptEntry> };

export function readProfileTranscript(path: string): ProfileTranscript {
  if (!existsSync(path)) return { promptVersion: PROFILE_PROMPT_VERSION, entries: {} };
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("entries" in parsed)) {
    throw new PaperProfileError(`${path} is not a profile transcript.`);
  }
  const transcript = parsed as ProfileTranscript;
  if (transcript.promptVersion !== PROFILE_PROMPT_VERSION) {
    throw new PaperProfileError(
      `${path} was recorded with prompt ${transcript.promptVersion}, not ${PROFILE_PROMPT_VERSION}.`,
    );
  }
  return transcript;
}

export function writeProfileTranscript(path: string, transcript: ProfileTranscript): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(transcript, null, 2)}\n`);
}

/** Replays recorded answers. A missing entry, or a changed prompt, is an error and never a guess. */
export function transcriptCompletion(transcript: ProfileTranscript): ProfileCompletion {
  return (request) => {
    const entry = transcript.entries[request.evidenceSourceId];
    if (!entry) {
      return Promise.reject(new PaperProfileError(`No recorded answer for ${request.title}.`));
    }
    if (entry.promptSha256 !== request.promptSha256) {
      return Promise.reject(
        new PaperProfileError(`The recorded answer for ${request.title} was made for a different prompt.`),
      );
    }
    return Promise.resolve(entry.response);
  };
}

/** Calls the API with structured output. Only this function touches the network. */
export function apiCompletion(client: Anthropic): ProfileCompletion {
  return async (request) => {
    const response = await client.messages.parse({
      model: PROFILE_MODEL,
      max_tokens: 2048,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      output_config: { effort: "low", format: zodOutputFormat(PaperProfileOutput) },
    });
    if (response.stop_reason === "refusal") {
      throw new PaperProfileError(
        `The model declined to read ${request.title}: ${response.stop_details?.explanation ?? "no explanation"}.`,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new PaperProfileError(`The model ran out of output tokens on ${request.title}.`);
    }
    if (!response.parsed_output) throw new PaperProfileError(`The model answer for ${request.title} did not parse.`);
    return response.parsed_output;
  };
}

export function createProfileClient(apiKey: string | undefined): Anthropic {
  if (!apiKey) {
    throw new PaperProfileError(
      "ANTHROPIC_API_KEY is not set. Put it in .env (server-only, never NEXT_PUBLIC_) or replay a transcript.",
    );
  }
  return new Anthropic({ apiKey, maxRetries: 3 });
}

export function createProfiler(options: {
  completion: ProfileCompletion;
  onAnswer?: (request: ProfileRequest, raw: unknown) => void;
}): (candidate: ProfileCandidate) => Promise<PaperProfileOutput> {
  return async (candidate) => {
    const request = buildProfileRequest(candidate);
    const raw = await options.completion(request);
    const profile = parseProfile(raw);
    options.onAnswer?.(request, raw);
    return profile;
  };
}
