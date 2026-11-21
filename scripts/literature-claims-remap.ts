/**
 * Re-resolves where stored machine claims point, from the current ontology and the curated
 * synonym table. Reads no paper and calls no model, so it costs nothing and can be re-run.
 *
 *   npm run literature:claims:remap -- --dry-run     prints what would change
 *   npm run literature:claims:remap -- --apply       writes the machine mapping columns
 *
 * It writes `machineMechanismId`, `machineOutcomeId` and `machineMappingState`, and moves the
 * current link only where a curator has not touched the claim. A verified or curator-mapped
 * claim keeps its link and gets a fresh machine suggestion beside it, which is the same rule
 * the extractor follows.
 *
 * Only the model-backed extractor's claims by default. The rule-based extractor's mappings are
 * its own deliberate and narrower decisions -- it leaves estradiol and progesterone unmapped on
 * purpose -- and rewriting them with the model-era vocabulary would spoil the one baseline
 * there is to compare against. `--provider` overrides that for a deliberate re-resolution.
 */
import { PrismaClient } from "../generated/prisma";
import { buildRemapper } from "../src/server/claims/remap";
import { catalogFromRows } from "../src/server/claims/extract";
import { assertClaimDatabase } from "../src/server/claims/cli";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  assertClaimDatabase(process.env.DATABASE_URL);
  const providerIndex = process.argv.indexOf("--provider");
  const provider = providerIndex === -1 ? "anthropic" : process.argv[providerIndex + 1];
  if (!provider) throw new Error("Use --provider with a producer name, or omit it for anthropic.");

  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    const mechanismRows = await db.mechanism.findMany({ select: { id: true, code: true, name: true, scorePolicy: true } });
    const outcomeRows = await db.outcome.findMany({ select: { id: true, code: true, name: true } });
    const remap = buildRemapper({
      mechanisms: mechanismRows,
      outcomes: outcomeRows,
      catalog: catalogFromRows(mechanismRows),
    });
    const mechanismIdByCode = new Map(mechanismRows.map((row) => [row.code, row.id]));
    const outcomeIdByCode = new Map(outcomeRows.map((row) => [row.code, row.id]));

    const claims = await db.mechanisticClaim.findMany({
      where: provider === "all" ? {} : { provider },
      select: {
        id: true,
        objectText: true,
        machineObjectHead: true,
        relation: true,
        curatorVerified: true,
        curatorMappingState: true,
        mechanism: { select: { code: true } },
        outcome: { select: { code: true } },
        machineMechanism: { select: { code: true } },
        machineOutcome: { select: { code: true } },
      },
    });
    console.log(
      `${claims.length} stored claims from ${provider}, ${mechanismRows.length} mechanisms, ${outcomeRows.length} outcomes.`,
    );

    let gained = 0;
    let moved = 0;
    let lost = 0;
    let locked = 0;
    const writes: Array<{ id: string; mechanismId: string | null; outcomeId: string | null; state: "CANDIDATE" | "UNMAPPED"; free: boolean }> = [];
    for (const claim of claims) {
      const result = remap({
        objectText: claim.objectText,
        objectHead: claim.machineObjectHead,
        relation: claim.relation,
        mechanismCode: claim.machineMechanism?.code ?? null,
        outcomeCode: claim.machineOutcome?.code ?? null,
      });
      if (!result.changed) continue;
      const had = Boolean(claim.machineMechanism ?? claim.machineOutcome);
      const has = Boolean(result.mechanismCode ?? result.outcomeCode);
      if (!had && has) gained += 1;
      else if (had && !has) lost += 1;
      else moved += 1;
      const curatorLocked = claim.curatorVerified || claim.curatorMappingState !== null;
      if (curatorLocked) locked += 1;
      console.log(
        `  ${claim.relation} ${claim.objectText.slice(0, 44).padEnd(46)} ` +
          `${(claim.machineMechanism?.code ?? claim.machineOutcome?.code ?? "unmapped").padEnd(26)} -> ` +
          `${result.mechanismCode ?? result.outcomeCode ?? "unmapped"}${result.outcomeCode ? " (outcome)" : ""}` +
          `${curatorLocked ? "  [curator link kept]" : ""}`,
      );
      writes.push({
        id: claim.id,
        mechanismId: result.mechanismCode ? (mechanismIdByCode.get(result.mechanismCode) ?? null) : null,
        outcomeId: result.outcomeCode ? (outcomeIdByCode.get(result.outcomeCode) ?? null) : null,
        state: result.mappingState,
        free: !curatorLocked,
      });
    }

    console.log(`\n${writes.length} claims would change: ${gained} newly mapped, ${moved} remapped, ${lost} unmapped.`);
    if (locked > 0) console.log(`${locked} of them are curator-touched, so only the machine suggestion moves.`);
    if (dryRun) {
      assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
      console.log("Dry run. Nothing was written.");
      return;
    }
    if (writes.length === 0) {
      console.log("Nothing to write.");
      return;
    }

    await db.$transaction(async (tx) => {
      const snapshot = await scientificSnapshot(tx);
      for (const write of writes) {
        await tx.mechanisticClaim.update({
          where: { id: write.id },
          data: {
            machineMechanismId: write.mechanismId,
            machineOutcomeId: write.outcomeId,
            machineMappingState: write.state,
            ...(write.free ? { mechanismId: write.mechanismId, outcomeId: write.outcomeId } : {}),
          },
        });
      }
      assertScientificSnapshotUnchanged(snapshot, await scientificSnapshot(tx));
    });
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
    console.log(`Wrote ${writes.length} mappings. Curator fields were not changed. No findings were written.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Remap failed.");
  process.exitCode = 1;
});
