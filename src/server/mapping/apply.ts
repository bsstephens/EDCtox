import type { ClaimMappingState, Prisma, PrismaClient } from "../../../generated/prisma";

type Store = PrismaClient | Prisma.TransactionClient;

export const MAPPING_ACTOR = "local-curator";

const CLAIM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MappingCommand =
  | { action: "VERIFY"; claimId: string; note: string | null }
  | { action: "REMAP"; claimId: string; mechanismCode: string; note: string | null }
  | { action: "UNMAP"; claimId: string; note: string | null };

function cleanNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 500) : null;
}

export async function applyClaimMapping(store: Store, command: MappingCommand): Promise<void> {
  if (!CLAIM_ID.test(command.claimId)) throw new Error("Claim was not found.");
  const claim = await store.mechanisticClaim.findUnique({
    where: { id: command.claimId },
    select: {
      id: true,
      mechanismId: true,
      machineMappingState: true,
      curatorMappingState: true,
    },
  });
  if (!claim) throw new Error("Claim was not found.");
  const fromState: ClaimMappingState = claim.curatorMappingState ?? claim.machineMappingState;
  const note = cleanNote(command.note);
  const noteUpdate = note ? { curatorNote: note } : {};

  if (command.action === "VERIFY") {
    if (!claim.mechanismId) throw new Error("There is no current mechanism to verify. Choose one, or leave the claim unmapped.");
    await store.mechanisticClaim.update({
      where: { id: claim.id },
      data: { curatorVerified: true, curatorMappingState: "VERIFIED", ...noteUpdate },
    });
    await store.claimMappingEvent.create({
      data: {
        claimId: claim.id,
        action: "VERIFY",
        fromMechanismId: claim.mechanismId,
        toMechanismId: claim.mechanismId,
        fromState,
        toState: "VERIFIED",
        note,
        actor: MAPPING_ACTOR,
      },
    });
    return;
  }

  if (command.action === "UNMAP") {
    await store.mechanisticClaim.update({
      where: { id: claim.id },
      data: { mechanismId: null, curatorVerified: false, curatorMappingState: "UNMAPPED", ...noteUpdate },
    });
    await store.claimMappingEvent.create({
      data: {
        claimId: claim.id,
        action: "UNMAP",
        fromMechanismId: claim.mechanismId,
        toMechanismId: null,
        fromState,
        toState: "UNMAPPED",
        note,
        actor: MAPPING_ACTOR,
      },
    });
    return;
  }

  const code = command.mechanismCode.trim();
  if (!code) throw new Error("Enter a mechanism code from the ontology.");
  const mechanism = await store.mechanism.findUnique({
    where: { code },
    select: { id: true, scorePolicy: true },
  });
  if (!mechanism) throw new Error("That mechanism code is not in the ontology.");
  if (mechanism.scorePolicy === "GROUPING_ONLY") {
    throw new Error("Grouping-only mechanisms are for navigation. Choose a specific mechanism, or leave the claim unmapped.");
  }
  await store.mechanisticClaim.update({
    where: { id: claim.id },
    data: { mechanismId: mechanism.id, curatorVerified: true, curatorMappingState: "VERIFIED", ...noteUpdate },
  });
  await store.claimMappingEvent.create({
    data: {
      claimId: claim.id,
      action: "REMAP",
      fromMechanismId: claim.mechanismId,
      toMechanismId: mechanism.id,
      fromState,
      toState: "VERIFIED",
      note,
      actor: MAPPING_ACTOR,
    },
  });
}
