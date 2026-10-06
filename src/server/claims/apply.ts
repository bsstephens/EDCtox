import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { CLAIM_DOMAIN, CLAIM_MODEL, CLAIM_PROMPT_VERSION, CLAIM_PROVIDER, CLAIM_TASK } from "./constants";
import { catalogFromRows, claimStableKey, extractMechanisticClaims, type ClaimDraft, type MechanismCatalog } from "./extract";

type Store = PrismaClient | Prisma.TransactionClient;

export type ClaimPaper = {
  evidenceSourceId: string;
  title: string;
  abstractText: string | null;
};

export type ClaimExtractor = (paper: ClaimPaper, catalog: MechanismCatalog) => ClaimDraft[];

function defaultExtractor(paper: ClaimPaper, catalog: MechanismCatalog): ClaimDraft[] {
  return extractMechanisticClaims({ title: paper.title, abstractText: paper.abstractText, catalog });
}

export async function applyMachineClaims(
  store: Store,
  input: {
    compoundId: string;
    papers: readonly ClaimPaper[];
    extract?: ClaimExtractor;
  },
): Promise<{ runId: string; written: number; papers: number }> {
  const rows = await store.mechanism.findMany({ select: { id: true, code: true, scorePolicy: true } });
  const catalog = catalogFromRows(rows);
  const extract = input.extract ?? defaultExtractor;
  const extracted = input.papers.flatMap((paper) =>
    extract(paper, catalog).map((draft) => ({
      paper,
      draft,
      stableKey: claimStableKey(paper.evidenceSourceId, draft.subjectText, draft.relation, draft.objectText),
    })),
  );
  if (extracted.length === 0) return { runId: "", written: 0, papers: 0 };

  const run = await store.curationAgentRun.create({
    data: {
      taskType: CLAIM_TASK,
      provider: CLAIM_PROVIDER,
      model: CLAIM_MODEL,
      promptVersion: CLAIM_PROMPT_VERSION,
      status: "SUCCEEDED",
      inputRefs: {
        compoundId: input.compoundId,
        domainCode: CLAIM_DOMAIN,
        evidenceSourceIds: input.papers.map((paper) => paper.evidenceSourceId),
      },
      outputRefs: {
        claims: extracted.map((item) => ({
          evidenceSourceId: item.paper.evidenceSourceId,
          stableKey: item.stableKey,
          relation: item.draft.relation,
          subjectText: item.draft.subjectText,
          objectText: item.draft.objectText,
          directness: item.draft.machineDirectness,
          mappingState: item.draft.machineMappingState,
        })),
      },
    },
  });

  for (const item of extracted) {
    const machineMechanismId = item.draft.mechanismId;
    const machine = {
      domainCode: CLAIM_DOMAIN,
      subjectType: item.draft.subjectType,
      subjectText: item.draft.subjectText,
      relation: item.draft.relation,
      objectType: item.draft.objectType,
      objectText: item.draft.objectText,
      machineDirectness: item.draft.machineDirectness,
      machineConfidence: item.draft.machineConfidence,
      machineRationale: item.draft.machineRationale,
      machineMappingState: item.draft.machineMappingState,
      machineMechanismId,
      speciesText: item.draft.speciesText,
      tissueText: item.draft.tissueText,
      cellTypeText: item.draft.cellTypeText,
      doseText: item.draft.doseText,
      measureType: item.draft.measureType,
      measureValue: item.draft.measureValue,
      measureUnit: item.draft.measureUnit,
      textOrigin: item.draft.textOrigin,
      sourceSection: item.draft.sourceSection,
      quotedSupport: item.draft.quotedSupport,
      reviewPriority: item.draft.reviewPriority,
      reviewDerived: item.draft.reviewDerived,
      provider: CLAIM_PROVIDER,
      modelName: CLAIM_MODEL,
      promptVersion: CLAIM_PROMPT_VERSION,
      agentRunId: run.id,
    };
    const existing = await store.mechanisticClaim.findUnique({
      where: { stableKey: item.stableKey },
      select: { curatorVerified: true, curatorMappingState: true },
    });
    if (!existing) {
      await store.mechanisticClaim.create({
        data: {
          stableKey: item.stableKey,
          evidenceSourceId: item.paper.evidenceSourceId,
          compoundId: input.compoundId,
          mechanismId: machineMechanismId,
          ...machine,
        },
      });
      continue;
    }
    const curatorLocked = existing.curatorVerified || existing.curatorMappingState !== null;
    await store.mechanisticClaim.update({
      where: { stableKey: item.stableKey },
      data: curatorLocked ? machine : { ...machine, mechanismId: machineMechanismId },
    });
  }

  return {
    runId: run.id,
    written: extracted.length,
    papers: new Set(extracted.map((item) => item.paper.evidenceSourceId)).size,
  };
}
