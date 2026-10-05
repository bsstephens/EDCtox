import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { governingPurpose } from "./deterministic";
import {
  SCREENING_DECISIONS,
  SCREENING_DOMAIN,
  SCREENING_QUERY_VERSION,
  SCREENING_REASONS,
  reasonAllowed,
  type ScreeningDecisionName,
  type ScreeningPurposeName,
  type ScreeningReasonName,
} from "./reasons";

type Store = PrismaClient | Prisma.TransactionClient;

export class ScreeningError extends Error {}

export type CuratorCommand = {
  evidenceSourceId: string;
  decision: ScreeningDecisionName | "RESET";
  reasonCode: string | null;
  notes: string | null;
};

function isDecision(value: string): value is ScreeningDecisionName {
  return (SCREENING_DECISIONS as readonly string[]).includes(value);
}

function isReason(value: string): value is ScreeningReasonName {
  return (SCREENING_REASONS as readonly string[]).includes(value);
}

export function assertCuratorCommand(input: {
  decision: ScreeningDecisionName | "RESET";
  reasonCode: string | null;
  publicationStatus: string | null;
  retracted: boolean;
  purpose: ScreeningPurposeName | null;
}): { curatorDecision: ScreeningDecisionName | null; curatorReasonCode: ScreeningReasonName | null } {
  if (input.publicationStatus === "DUPLICATE") {
    throw new ScreeningError("Duplicate publications are already collapsed and are not screened separately.");
  }
  if (input.decision === "RESET") return { curatorDecision: null, curatorReasonCode: null };
  if (input.decision === "INCLUDE" && (input.retracted || input.publicationStatus === "RETRACTED")) {
    throw new ScreeningError("A retracted publication cannot be included.");
  }
  if (input.decision === "EXCLUDE" && !input.reasonCode) {
    throw new ScreeningError("Exclude requires a reason code.");
  }
  if (!input.reasonCode) return { curatorDecision: input.decision, curatorReasonCode: null };
  if (!isReason(input.reasonCode) || !reasonAllowed(input.decision, input.reasonCode, input.purpose)) {
    throw new ScreeningError("That reason is not available for this decision.");
  }
  return { curatorDecision: input.decision, curatorReasonCode: input.reasonCode };
}

export async function applyCuratorDecision(store: Store, command: CuratorCommand): Promise<void> {
  if (command.decision !== "RESET" && !isDecision(command.decision)) {
    throw new ScreeningError("Unknown screening decision.");
  }
  const source = await store.evidenceSource.findUnique({
    where: { id: command.evidenceSourceId },
    select: {
      publicationStatus: true,
      retracted: true,
      searchHits: {
        select: {
          searchRun: {
            select: {
              purpose: true,
              queryVersion: true,
              compound: { select: { id: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!source) throw new ScreeningError("Publication not found.");
  const hits = source.searchHits.filter(
    (hit) => hit.searchRun.compound.slug === "bpa" && hit.searchRun.queryVersion === SCREENING_QUERY_VERSION,
  );
  const compoundId = hits[0]?.searchRun.compound.id;
  if (!compoundId) throw new ScreeningError("This publication is not in the BPA reproductive queue.");
  const purpose = governingPurpose(hits.map((hit) => hit.searchRun.purpose));
  const checked = assertCuratorCommand({
    decision: command.decision,
    reasonCode: command.reasonCode,
    publicationStatus: source.publicationStatus,
    retracted: source.retracted,
    purpose,
  });
  const trimmedNotes = command.notes?.trim() ?? "";
  const curator = {
    curatorDecision: checked.curatorDecision,
    curatorReasonCode: checked.curatorReasonCode,
    curatorNotes: command.decision === "RESET" || trimmedNotes.length === 0 ? null : trimmedNotes,
    screenedBy: command.decision === "RESET" ? null : "local-curator",
    screenedAt: command.decision === "RESET" ? null : new Date(),
  };
  await store.literatureScreeningDecision.upsert({
    where: {
      evidenceSourceId_compoundId_domainCode: {
        evidenceSourceId: command.evidenceSourceId,
        compoundId,
        domainCode: SCREENING_DOMAIN,
      },
    },
    create: {
      evidenceSourceId: command.evidenceSourceId,
      compoundId,
      domainCode: SCREENING_DOMAIN,
      searchPurpose: purpose,
      ...curator,
    },
    update: curator,
  });
}
