import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { applyMachineClaims } from "../claims/apply";
import type { ClaimDraft } from "../claims/extract";
import { loadCompoundCoverage } from "../coverage/query";
import { applyClaimMapping } from "./apply";
import { loadFamilyAudit } from "./families";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnvFile(".env");

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function draft(mechanismId: string, overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    subjectType: "CHEMICAL",
    subjectText: "bisphenol A",
    relation: "INCREASES_EXPRESSION",
    objectType: "ENZYME",
    objectText: "aromatase (CYP19A1)",
    machineDirectness: "STRONGLY_SUPPORTED",
    machineConfidence: "HIGH",
    machineRationale: "Fixture edge.",
    machineMappingState: "CANDIDATE",
    mechanismCode: "AROMATASE_CYP19A1",
    mechanismId,
    speciesText: "human",
    tissueText: null,
    cellTypeText: null,
    doseText: null,
    measureType: null,
    measureValue: null,
    measureUnit: null,
    textOrigin: "ABSTRACT",
    sourceSection: "Abstract",
    quotedSupport: "Fixture sentence that must stay unlisted.",
    reviewPriority: "REVIEW_REQUIRED",
    reviewDerived: false,
    ...overrides,
  };
}

test("mapping actions keep the machine suggestion and leave scores and findings unchanged", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { assertScientificSnapshotUnchanged, scientificSnapshot } = await import("../literature/guard");
  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    assert.equal(before.mechanismCount, 71);
    assert.equal(before.findingCount, 2);
    const familiesBefore = await db.mechanismFamily.count();
    const audit = await loadFamilyAudit(db);
    const storedFamilies = new Set((await db.mechanismFamily.findMany({ select: { code: true } })).map((row) => row.code));
    assert.equal(audit.total, await db.mechanism.count());
    assert.ok(audit.familyCodes.every((code) => storedFamilies.has(code)));
    assert.equal(await db.mechanismFamily.count(), familiesBefore);
    const bpa = await db.compound.findUniqueOrThrow({ where: { slug: "bpa" }, select: { id: true } });
    let rolledBack = false;
    try {
      await db.$transaction(
        async (tx) => {
          const findings = await tx.evidenceFinding.count();
          const coverage = await loadCompoundCoverage(tx, "bpa");
          assert.equal(coverage.metrics.verified, 0);
          assert.ok(coverage.metrics.candidate > 0);
          assert.ok(coverage.metrics.unmapped > 0);
          assert.ok(coverage.warnings.some((warning) => warning.includes("machine-extracted")));
          const aromatase = coverage.claims.find((claim) => claim.mechanismCode === "AROMATASE_CYP19A1");
          const estradiol = coverage.claims.find((claim) => claim.objectText === "estradiol");
          assert.ok(aromatase);
          assert.equal(aromatase.state, "CANDIDATE");
          assert.equal(aromatase.machineMechanismCode, "AROMATASE_CYP19A1");
          assert.ok(estradiol);
          assert.equal(estradiol.state, "UNMAPPED");
          assert.equal(estradiol.mechanismCode, null);
          const groupedCodes = coverage.domains.flatMap((domain) => domain.families.flatMap((family) => family.parents.flatMap((parent) => parent.claims.map((claim) => claim.mechanismCode))));
          assert.equal(groupedCodes.includes("REP_STEROIDOGENESIS"), false);
          assert.equal(groupedCodes.includes("AROMATASE_CYP19A1"), true);
          const stored = await tx.mechanisticClaim.findUniqueOrThrow({
            where: { id: aromatase.id },
            select: { mechanismId: true, machineMechanismId: true, evidenceSourceId: true, relation: true, objectText: true },
          });
          assert.equal(stored.machineMechanismId, stored.mechanismId);
          await applyClaimMapping(tx, { action: "VERIFY", claimId: aromatase.id, note: "Workflow check." });
          const verified = await tx.mechanisticClaim.findUniqueOrThrow({
            where: { id: aromatase.id },
            include: { mappingEvents: true, mechanism: { select: { code: true } }, machineMechanism: { select: { code: true } } },
          });
          assert.equal(verified.curatorVerified, true);
          assert.equal(verified.curatorMappingState, "VERIFIED");
          assert.equal(verified.mechanism?.code, "AROMATASE_CYP19A1");
          assert.equal(verified.machineMechanism?.code, "AROMATASE_CYP19A1");
          assert.equal(verified.mechanismId, stored.mechanismId);
          assert.equal(verified.mappingEvents.length, 1);
          assert.equal(verified.mappingEvents[0]?.action, "VERIFY");
          assert.equal(verified.mappingEvents[0]?.fromState, "CANDIDATE");
          assert.equal(verified.mappingEvents[0]?.toState, "VERIFIED");
          await applyClaimMapping(tx, { action: "REMAP", claimId: aromatase.id, mechanismCode: "STAR", note: null });
          const remapped = await tx.mechanisticClaim.findUniqueOrThrow({
            where: { id: aromatase.id },
            include: { mappingEvents: { orderBy: { createdAt: "asc" } }, mechanism: { select: { code: true } }, machineMechanism: { select: { code: true } } },
          });
          assert.equal(remapped.mechanism?.code, "STAR");
          assert.equal(remapped.machineMechanism?.code, "AROMATASE_CYP19A1");
          assert.equal(remapped.machineMechanismId, stored.machineMechanismId);
          assert.equal(remapped.curatorNote, "Workflow check.");
          assert.equal(remapped.mappingEvents.length, 2);
          assert.equal(remapped.mappingEvents[1]?.action, "REMAP");
          assert.equal(remapped.mappingEvents[1]?.fromState, "VERIFIED");
          await applyClaimMapping(tx, { action: "UNMAP", claimId: aromatase.id, note: "Leave for later." });
          const opened = await tx.mechanisticClaim.findUniqueOrThrow({ where: { id: aromatase.id } });
          assert.equal(opened.mechanismId, null);
          assert.equal(opened.machineMechanismId, stored.machineMechanismId);
          assert.equal(opened.curatorVerified, false);
          assert.equal(opened.curatorMappingState, "UNMAPPED");
          const star = await tx.mechanism.findUniqueOrThrow({ where: { code: "STAR" }, select: { id: true } });
          await applyMachineClaims(tx, {
            compoundId: bpa.id,
            papers: [{ evidenceSourceId: stored.evidenceSourceId, title: "Fixture", abstractText: null }],
            extract: () => [draft(star.id, { relation: stored.relation, objectText: stored.objectText })],
          });
          const refreshed = await tx.mechanisticClaim.findUniqueOrThrow({ where: { id: aromatase.id } });
          assert.equal(refreshed.mechanismId, null);
          assert.equal(refreshed.machineMechanismId, star.id);
          assert.equal(refreshed.curatorMappingState, "UNMAPPED");
          assert.equal(await tx.evidenceFinding.count(), findings);
          assert.equal(await tx.mechanismFamily.count(), familiesBefore);
          await assert.rejects(() => applyClaimMapping(tx, { action: "REMAP", claimId: aromatase.id, mechanismCode: "REP_STEROIDOGENESIS", note: null }), /navigation/);
          assertScientificSnapshotUnchanged(before, await scientificSnapshot(tx));
          throw new Error("ROLLBACK");
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ROLLBACK")) throw error;
      rolledBack = true;
    }
    assert.equal(rolledBack, true);
    const after = await loadCompoundCoverage(db, "bpa");
    assert.equal(after.metrics.verified, 0);
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
    assert.equal(await db.mechanismFamily.count(), familiesBefore);
  } finally {
    await db.$disconnect();
  }
});
