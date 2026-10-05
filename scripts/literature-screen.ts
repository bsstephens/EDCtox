import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";
import { applyMachineSuggestions, type SuggestionCandidate } from "../src/server/screening/applySuggestions";
import { suggestDeterministic } from "../src/server/screening/deterministic";
import { assertLocalDatabase, parseScreeningArgs } from "../src/server/screening/cli";
import { loadBpaScreeningQueue, type ScreeningCard } from "../src/server/screening/queue";
import { SCREENING_MODEL, SCREENING_PROMPT_VERSION, SCREENING_PROVIDER } from "../src/server/screening/reasons";
import { selectSuggestionSample } from "../src/server/screening/sample";

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

function toCandidate(card: ScreeningCard): SuggestionCandidate {
  return {
    evidenceSourceId: card.sourceId,
    title: card.title,
    abstractText: card.abstractText,
    retracted: card.retracted,
    purposes: card.purposes,
    publicationStatus: card.publicationStatus,
  };
}

async function main() {
  const command = parseScreeningArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  assertLocalDatabase(process.env.DATABASE_URL);

  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    const queue = await loadBpaScreeningQueue(db);
    const selected = selectSuggestionSample(queue.cards, command.limit);
    console.log(`${SCREENING_PROVIDER} ${SCREENING_MODEL} ${SCREENING_PROMPT_VERSION}`);
    console.log(`localhost BPA reproductive pending suggestions ${selected.length}`);
    for (const card of selected) {
      const suggestion = suggestDeterministic(toCandidate(card));
      console.log(
        `${suggestion.decision} ${suggestion.reasonCode} ${suggestion.confidence} ${card.year ?? "?"} pmid ${card.pmid ?? "-"} ${card.title}`,
      );
    }
    if (command.dryRun) {
      assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
      console.log("Dry run. No screening decisions were written.");
      return;
    }

    const result = await db.$transaction(async (tx) => {
      const snapshot = await scientificSnapshot(tx);
      const written = await applyMachineSuggestions(tx, {
        compoundId: queue.compoundId,
        candidates: selected.map(toCandidate),
      });
      assertScientificSnapshotUnchanged(snapshot, await scientificSnapshot(tx));
      return written;
    });
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
    console.log(`Wrote ${result.written} machine suggestions. Curator decisions were not changed.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Screening failed.";
  console.error(message);
  process.exit(1);
});
