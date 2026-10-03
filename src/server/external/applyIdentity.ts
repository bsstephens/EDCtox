import { createHash } from "node:crypto";

import type { FieldDecision, ProviderPlan } from "./identity";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DatasetRow = { id: string };
type RunRow = { id: string };

export type IdentityWriteClient = {
  externalDataset: {
    findUnique(args: { where: { code: string } }): Promise<DatasetRow | null>;
  };
  externalImportRun: {
    create(args: { data: Record<string, unknown> }): Promise<RunRow>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  identityResolutionAttempt: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  externalIdentifier: {
    findUnique(args: { where: { stableKey: string } }): Promise<{ id: string } | null>;
    upsert(args: { where: { stableKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
  };
  externalRecord: {
    upsert(args: {
      where: { datasetId_externalId: { datasetId: string; externalId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  compound: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type CompoundWriteTarget = {
  id: string;
  slug: string;
};

function checksum(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function compoundPatch(decisions: FieldDecision[]): Record<string, string | number> {
  const patch: Record<string, string | number> = {};
  for (const decision of decisions) {
    if (decision.action !== "fill" || !decision.incomingValue) continue;
    if (decision.field === "pubChemCid") patch.pubChemCid = Number(decision.incomingValue);
    else patch[decision.field] = decision.incomingValue;
  }
  return patch;
}

function runStatus(plan: ProviderPlan): "SUCCEEDED" | "PARTIAL" | "FAILED" {
  if (plan.skipped || plan.status === "VERIFIED") return "SUCCEEDED";
  if (plan.reason.startsWith("Live source unavailable")) return "FAILED";
  return "PARTIAL";
}

export async function applyIdentityPlans(
  db: IdentityWriteClient,
  compound: CompoundWriteTarget,
  plans: ProviderPlan[],
  now = new Date(),
): Promise<{ runIds: string[]; identifiersWritten: number }> {
  const runIds: string[] = [];
  let identifiersWritten = 0;

  for (const plan of plans) {
    const dataset = await db.externalDataset.findUnique({ where: { code: plan.providerCode } });
    if (!dataset) throw new Error(`External dataset ${plan.providerCode} is not seeded.`);
    const run = await db.externalImportRun.create({
      data: {
        datasetId: dataset.id,
        status: "STARTED",
        notes: `${plan.providerCode} identity resolution for ${compound.slug}.`,
        recordsSeen: 1,
      },
    });
    runIds.push(run.id);

    await db.identityResolutionAttempt.create({
      data: {
        compoundId: compound.id,
        datasetId: dataset.id,
        importRunId: run.id,
        queryType: plan.queryType,
        queryValue: plan.queryValue,
        candidateIds: plan.candidateIds,
        selectedExternalId: plan.selectedExternalId,
        resolutionStatus: plan.status,
        reason: plan.reason,
      },
    });

    let created = 0;
    if (plan.status === "VERIFIED" && !plan.skipped) {
      for (const identifier of plan.identifiers) {
        const stableKey = `${compound.slug}:${identifier.namespace}:${identifier.value}`;
        const existing = await db.externalIdentifier.findUnique({ where: { stableKey } });
        await db.externalIdentifier.upsert({
          where: { stableKey },
          create: {
            stableKey,
            compoundId: compound.id,
            datasetId: dataset.id,
            namespace: identifier.namespace,
            value: identifier.value,
            canonical: true,
            disputed: false,
            resolutionStatus: "VERIFIED",
            verifiedAt: now,
            sourceUrl: identifier.sourceUrl,
            notes: plan.reason,
          },
          update: {
            datasetId: dataset.id,
            canonical: true,
            resolutionStatus: "VERIFIED",
            verifiedAt: now,
            sourceUrl: identifier.sourceUrl,
            notes: plan.reason,
          },
        });
        if (!existing) created += 1;
      }

      const patch = compoundPatch(plan.fieldDecisions);
      if (Object.keys(patch).length > 0) {
        await db.compound.update({ where: { id: compound.id }, data: patch });
      }

      if (plan.cache) {
        const record = {
          compoundId: compound.id,
          importRunId: run.id,
          recordType: plan.cache.recordType,
          externalUrl: plan.canonicalUrl,
          retrievedAt: now,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
          checksum: checksum(plan.cache.payload),
          rawData: plan.cache.payload,
          importStatus: "IMPORTED",
          notes: "Identity cache. This is not an EDCtox finding or score.",
        };
        await db.externalRecord.upsert({
          where: { datasetId_externalId: { datasetId: dataset.id, externalId: plan.cache.externalId } },
          create: { datasetId: dataset.id, externalId: plan.cache.externalId, ...record },
          update: record,
        });
      }
    }

    identifiersWritten += created;
    await db.externalImportRun.update({
      where: { id: run.id },
      data: {
        status: runStatus(plan),
        completedAt: now,
        recordsCreated: created,
        recordsRejected: plan.status === "VERIFIED" ? 0 : 1,
      },
    });
  }

  return { runIds, identifiersWritten };
}
