import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma";
import { applyMachineClaims } from "../src/server/claims/apply";
import { assertClaimDatabase, parseClaimArgs } from "../src/server/claims/cli";
import { CLAIM_MODEL, CLAIM_PROMPT_VERSION, CLAIM_PROVIDER } from "../src/server/claims/constants";
import { catalogFromRows, extractMechanisticClaims } from "../src/server/claims/extract";
import { loadClaimPilot } from "../src/server/claims/load";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";

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

loadEnvFile(new URL("../.env", import.meta.url).pathname);

async function main() {
  const command = parseClaimArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  assertClaimDatabase(process.env.DATABASE_URL);

  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    const pilot = await loadClaimPilot(db, command.limit);
    if (pilot.papers.length !== command.limit) {
      throw new Error(`Expected ${command.limit} pilot papers, found ${pilot.papers.length}.`);
    }
    const catalog = catalogFromRows(await db.mechanism.findMany({ select: { id: true, code: true, scorePolicy: true } }));
    console.log(`${CLAIM_PROVIDER} ${CLAIM_MODEL} ${CLAIM_PROMPT_VERSION}`);
    console.log(`localhost BPA reproductive abstract claims, ${pilot.papers.length} papers`);
    for (const paper of pilot.papers) {
      const drafts = extractMechanisticClaims({ title: paper.title, abstractText: paper.abstractText, catalog });
      if (drafts.length === 0) throw new Error(`No claims for pmid ${paper.pmid ?? "?"}.`);
      console.log(`${paper.year} pmid ${paper.pmid ?? "-"} ${drafts.length} claims`);
      console.log(paper.title);
      for (const draft of drafts) {
        const quote = draft.quotedSupport ?? "";
        console.log(
          `  ${draft.relation} ${draft.objectText} ${draft.machineDirectness} ${draft.machineConfidence} ${draft.machineMappingState} ${draft.mechanismCode ?? "unmapped"} ${draft.reviewPriority} ${draft.sourceSection}`,
        );
        console.log(`  ${quote}`);
      }
    }
    if (command.dryRun) {
      assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
      console.log("Dry run. No claims were written.");
      return;
    }

    const result = await db.$transaction(async (tx) => {
      const snapshot = await scientificSnapshot(tx);
      const written = await applyMachineClaims(tx, {
        compoundId: pilot.compoundId,
        papers: pilot.papers.map((paper) => ({
          evidenceSourceId: paper.evidenceSourceId,
          title: paper.title,
          abstractText: paper.abstractText,
        })),
      });
      assertScientificSnapshotUnchanged(snapshot, await scientificSnapshot(tx));
      return written;
    });
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
    console.log(`Wrote ${result.written} machine claims across ${result.papers} papers. Curator fields were not changed. No findings were written.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Claim extraction failed.");
  process.exitCode = 1;
});
