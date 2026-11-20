/**
 * Run the model-backed extractor over the five pilot papers and compare it with the claims the
 * rule-based extractor already stored. Reads the database, writes nothing to it.
 *
 *   npm run literature:claims:compare -- --dry-run      builds the prompts, calls nothing
 *   npm run literature:claims:compare -- --apply        calls the API and prints the comparison
 *   npm run literature:claims:compare -- --apply --transcript <file>   replays, no network
 *
 * Nothing here writes a claim. Looking first is the point: the same approach on the profiler
 * caught two real defects for a fraction of a cent.
 */
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

import { PrismaClient } from "../generated/prisma";
import { type ClaimPaper } from "../src/server/claims/apply";
import {
  CLAUDE_CLAIM_MODEL,
  CLAUDE_CLAIM_PROMPT_VERSION,
  apiCompletion,
  buildClaimRequest,
  createClaimClient,
  createClaudeExtractor,
  readClaimTranscript,
  transcriptCompletion,
  writeClaimTranscript,
  type ClaimTranscript,
} from "../src/server/claims/claude";
import { CLAIM_PILOT_PMIDS } from "../src/server/claims/constants";
import { catalogFromRows, claimNorm } from "../src/server/claims/extract";

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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(new URL("../.env", import.meta.url).pathname);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) {
    console.error("Pass either --dry-run or --apply.");
    process.exit(1);
  }
  const transcriptPath = argument("--transcript");
  const recordPath = argument("--record");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error("Claim extraction runs only against localhost.");
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const sources = await db.evidenceSource.findMany({
      where: { pmid: { in: [...CLAIM_PILOT_PMIDS] } },
      select: { id: true, title: true, abstractText: true, pmid: true },
    });
    const papers: ClaimPaper[] = sources.map((row) => ({
      evidenceSourceId: row.id,
      title: row.title,
      abstractText: row.abstractText,
    }));
    console.log(`${papers.length} pilot papers.`);

    const mechanismRows = await db.mechanism.findMany({ select: { id: true, code: true, name: true, scorePolicy: true } });
    const catalog = catalogFromRows(mechanismRows);
    const byName = new Map<string, string>();
    for (const row of mechanismRows) {
      byName.set(claimNorm(row.name), row.code);
      byName.set(claimNorm(row.code.replace(/_/g, " ")), row.code);
    }
    const mechanismCodeFor = (objectText: string) => byName.get(claimNorm(objectText)) ?? null;

    const stored = await db.mechanisticClaim.findMany({
      where: { evidenceSourceId: { in: sources.map((row) => row.id) } },
      select: { evidenceSourceId: true, relation: true, objectText: true, machineDirectness: true, mechanismId: true },
    });
    console.log(`${stored.length} claims already stored by the rule-based extractor.\n`);

    if (dryRun) {
      const sample = papers[0];
      if (sample) {
        const request = buildClaimRequest(sample, "bisphenol A");
        console.log(`Prompt for "${sample.title.slice(0, 64)}" (sha ${request.promptSha256.slice(0, 12)})`);
        console.log(`System prompt: ${request.system.length} characters. User: ${request.user.length} characters.`);
      }
      const chars = papers.reduce((sum, p) => sum + (p.abstractText?.length ?? 0), 0);
      console.log(
        `\nWould make ${papers.length} calls to ${CLAUDE_CLAIM_MODEL}, about ` +
          `${Math.round((chars + papers.length * 2600) / 4 / 1000)}k input tokens in total.`,
      );
      console.log("Dry run. No API call was made and nothing was written.");
      return;
    }

    const replaying = Boolean(transcriptPath);
    if (!replaying) {
      const prompt = createInterface({ input, output });
      const answer = await prompt.question(
        `This makes ${papers.length} calls to ${CLAUDE_CLAIM_MODEL}, which cost money. Type apply to continue: `,
      );
      prompt.close();
      if (answer.trim() !== "apply") {
        console.log("Stopped.");
        process.exit(1);
      }
    }

    const transcript: ClaimTranscript = transcriptPath
      ? readClaimTranscript(transcriptPath)
      : { promptVersion: CLAUDE_CLAIM_PROMPT_VERSION, entries: {} };
    const extractor = createClaudeExtractor({
      completion: replaying ? transcriptCompletion(transcript) : apiCompletion(createClaimClient(process.env.ANTHROPIC_API_KEY)),
      compoundNameFor: () => "bisphenol A",
      mechanismCodeFor,
      onAnswer: (request, raw) => {
        if (!recordPath) return;
        transcript.entries[request.evidenceSourceId] = {
          title: request.title,
          promptSha256: request.promptSha256,
          model: CLAUDE_CLAIM_MODEL,
          response: raw,
        };
      },
      onDropped: (paper, dropped) => {
        for (const row of dropped) console.log(`  DROPPED on ${paper.title.slice(0, 40)}: ${row.objectText} — ${row.why}`);
      },
    });

    let modelTotal = 0;
    let mappedTotal = 0;
    const failures: string[] = [];
    for (const paper of papers) {
      let drafts;
      try {
        drafts = await extractor(paper, catalog);
      } catch (error) {
        // One paper failing must not lose the other four, and the money already spent on them.
        failures.push(`${paper.title.slice(0, 50)}: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`\n${paper.title.slice(0, 72)}\n  FAILED: ${failures[failures.length - 1]?.split(": ").slice(1).join(": ")}`);
        continue;
      }
      modelTotal += drafts.length;
      mappedTotal += drafts.filter((draft) => draft.mechanismCode).length;
      const previous = stored.filter((row) => row.evidenceSourceId === paper.evidenceSourceId);
      console.log(`\n${paper.title.slice(0, 72)}`);
      console.log(`  rules: ${previous.length} claims   model: ${drafts.length} claims`);
      const before = new Set(previous.map((row) => claimNorm(row.objectText)));
      const after = new Set(drafts.map((draft) => claimNorm(draft.objectText)));
      const onlyRules = [...before].filter((key) => !after.has(key));
      const onlyModel = [...after].filter((key) => !before.has(key));
      if (onlyRules.length > 0) console.log(`  only the rules found: ${onlyRules.join(", ")}`);
      if (onlyModel.length > 0) console.log(`  only the model found: ${onlyModel.join(", ")}`);
      for (const draft of drafts) {
        console.log(
          `    ${draft.relation.padEnd(22)} ${draft.objectText.slice(0, 34).padEnd(34)} ` +
            `${draft.machineDirectness.padEnd(20)} ${draft.mechanismCode ?? "unmapped"}`,
        );
      }
    }

    if (recordPath) writeClaimTranscript(recordPath, transcript);
    console.log(
      `\nModel read ${modelTotal} claims across ${papers.length - failures.length} papers, ${mappedTotal} mapped to a mechanism.` +
        ` The rule-based extractor stored ${stored.length}. Nothing was written.` +
        (failures.length > 0 ? ` ${failures.length} papers failed.` : ""),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
