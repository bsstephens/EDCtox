import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

import { PrismaClient } from "../generated/prisma";
import { parseLiteratureArgs } from "../src/server/literature/cli";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";
import { assertBpaReproductiveTarget } from "../src/server/literature/queries";
import { runBpaReproductiveSearch, type LiteratureRunReport } from "../src/server/literature/runSearch";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnvFile(new URL("../.env", import.meta.url).pathname);

async function confirmApply(host: string) {
  if (host.includes("localhost") || host.includes("127.0.0.1")) return;
  const prompt = createInterface({ input, output });
  const answer = await prompt.question(`This writes candidate sources to ${host}. Type apply to continue: `);
  prompt.close();
  if (answer.trim() !== "apply") {
    console.log("Stopped.");
    process.exit(1);
  }
}

function printReport(report: LiteratureRunReport) {
  console.log(`\n${report.provider} ${report.purpose} ${report.resultWindow} ${report.status}`);
  console.log(`  version ${report.queryVersion}`);
  console.log(`  sort ${report.sortMode}`);
  console.log(`  query ${report.queryText}`);
  if (report.purposeNote) console.log(`  note ${report.purposeNote}`);
  console.log(
    `  reported ${report.providerReportedCount ?? "unknown"} fetched ${report.fetchedCount} passed ${report.passedCount} skipped ${report.relevanceSkipCount} capped ${report.capSkipCount} duplicate ${report.duplicateCount} conflict ${report.conflictCount} would-insert ${report.insertedCount}`,
  );
  if (report.errorText) console.log(`  error ${report.errorText}`);
  for (const hit of report.hits) {
    const abstract = hit.abstractRetained ? "abstract-stored" : "no-abstract";
    const retracted = hit.retracted ? " retracted" : "";
    const signal = hit.studySignal ? ` ${hit.studySignal}` : "";
    const enrich = hit.enrichment ? " enrich" : "";
    console.log(
      `  ${hit.disposition} ${hit.year ?? "?"} pmid ${hit.pmid ?? "-"} doi ${hit.doi ?? "-"} ${abstract}${retracted}${signal}${enrich} ${hit.title}`,
    );
  }
}

async function main() {
  const command = parseLiteratureArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL).host;
  if (!command.dryRun) await confirmApply(host);

  const db = new PrismaClient();
  try {
    const compound = await db.compound.findUnique({
      where: { slug: "bpa" },
      include: { aliases: { select: { name: true } } },
    });
    if (!compound) throw new Error("BPA is not in the database.");
    assertBpaReproductiveTarget({
      slug: compound.slug,
      canonicalName: compound.canonicalName,
      displayName: compound.displayName,
      casNumber: compound.casNumber,
      aliasNames: compound.aliases.map((alias) => alias.name),
    });

    const before = await scientificSnapshot(db);
    const sourcesBefore = await db.evidenceSource.count();
    const existing = await db.evidenceSource.findMany({
      select: { id: true, doi: true, pmid: true, title: true, year: true, pmcid: true, openAccess: true },
    });
    const reports = await runBpaReproductiveSearch({
      compound: { id: compound.id, curationStatus: compound.curationStatus },
      purposes: command.purposes,
      providers: command.providers,
      existing,
      dryRun: command.dryRun,
      store: command.dryRun ? undefined : db,
      ncbiApiKey: process.env.NCBI_API_KEY,
      ncbiEmail: process.env.NCBI_EMAIL,
    });
    for (const report of reports) printReport(report);

    if (command.dryRun) {
      const sourcesAfter = await db.evidenceSource.count();
      if (sourcesAfter !== sourcesBefore) throw new Error("Dry run wrote sources.");
    }
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
    const failed = reports.filter((report) => report.status === "FAILED");
    if (command.dryRun) console.log("\nDry run. No candidate sources were written.");
    else console.log("\nCandidate sources were written. Findings and assessments were not changed.");
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

await main();
