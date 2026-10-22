import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { suggestDeterministic, type MachineSuggestion, type ScreeningText } from "./deterministic";
import { SCREENING_DOMAIN, SCREENING_MODEL, SCREENING_PROMPT_VERSION, SCREENING_PROVIDER } from "./reasons";

type Store = PrismaClient | Prisma.TransactionClient;

export type SuggestionCandidate = ScreeningText & {
  evidenceSourceId: string;
  publicationStatus: string | null;
};

/// A provider reads one candidate and returns one suggestion. It is async so a model-backed
/// provider and the deterministic rules share one interface. The deterministic rules are the
/// test fixture; a provider never sees or writes a curator column.
export type SuggestionProvider = (candidate: SuggestionCandidate) => Promise<MachineSuggestion>;

export const deterministicProvider: SuggestionProvider = async (candidate) => suggestDeterministic(candidate);

export function fixtureSuggestion(suggestion: MachineSuggestion): SuggestionProvider {
  return async () => suggestion;
}

export async function applyMachineSuggestions(
  store: Store,
  input: {
    compoundId: string;
    candidates: readonly SuggestionCandidate[];
    provider?: SuggestionProvider;
    providerName?: string;
    model?: string;
    promptVersion?: string;
  },
): Promise<{ runId: string; written: number }> {
  const provider = input.provider ?? deterministicProvider;
  const eligible = input.candidates.filter((candidate) => candidate.publicationStatus !== "DUPLICATE");
  if (eligible.length === 0) return { runId: "", written: 0 };
  const suggestions: Array<{ candidate: SuggestionCandidate; suggestion: MachineSuggestion }> = [];
  for (const candidate of eligible) {
    suggestions.push({ candidate, suggestion: await provider(candidate) });
  }
  const run = await store.curationAgentRun.create({
    data: {
      taskType: "literature-screening",
      provider: input.providerName ?? SCREENING_PROVIDER,
      model: input.model ?? SCREENING_MODEL,
      promptVersion: input.promptVersion ?? SCREENING_PROMPT_VERSION,
      status: "SUCCEEDED",
      inputRefs: {
        compoundId: input.compoundId,
        domainCode: SCREENING_DOMAIN,
        evidenceSourceIds: suggestions.map((item) => item.candidate.evidenceSourceId),
      },
      outputRefs: {
        suggestions: suggestions.map((item) => ({
          evidenceSourceId: item.candidate.evidenceSourceId,
          decision: item.suggestion.decision,
          reasonCode: item.suggestion.reasonCode,
          confidence: item.suggestion.confidence,
        })),
      },
    },
  });

  for (const item of suggestions) {
    const machine = {
      searchPurpose: item.suggestion.searchPurpose,
      machineDecision: item.suggestion.decision,
      machineReason: item.suggestion.reasonCode,
      machineConfidence: item.suggestion.confidence,
      machineRationale: item.suggestion.rationale,
      agentRunId: run.id,
    };
    await store.literatureScreeningDecision.upsert({
      where: {
        evidenceSourceId_compoundId_domainCode: {
          evidenceSourceId: item.candidate.evidenceSourceId,
          compoundId: input.compoundId,
          domainCode: SCREENING_DOMAIN,
        },
      },
      create: {
        evidenceSourceId: item.candidate.evidenceSourceId,
        compoundId: input.compoundId,
        domainCode: SCREENING_DOMAIN,
        ...machine,
      },
      update: machine,
    });
  }

  return { runId: run.id, written: suggestions.length };
}
