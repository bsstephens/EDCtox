import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { PrismaClient } from "../generated/prisma";
import { applyMachineClaims } from "../src/server/claims/apply";
import { assertClaimDatabase, parseClaimArgs } from "../src/server/claims/cli";
import { CLAIM_MODEL, CLAIM_PROMPT_VERSION, CLAIM_PROVIDER } from "../src/server/claims/constants";
import {
  CLAUDE_CLAIM_MODEL,
  CLAUDE_CLAIM_PROMPT_VERSION,
  apiCompletion,
  createClaimClient,
  createClaudeExtractor,
  readClaimTranscript,
  transcriptCompletion,
  transcriptKey,
  writeClaimTranscript,
  type ClaimTranscript,
} from "../src/server/claims/claude";
import { catalogFromRows, extractMechanisticClaims } from "../src/server/claims/extract";
import { buildMechanismLookup } from "../src/server/claims/mechanismLookup";
import { buildOutcomeLookup, claimDirection } from "../src/server/claims/outcomeLookup";
import { loadClaimPilot, loadIncludedClaimCohort } from "../src/server/claims/load";
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

/** Two passes per paper, which is what the stability measurement settled on. */
const CLAUDE_PASSES = 2;

async function ask(question: string): Promise<string> {
  const prompt = createInterface({ input, output });
  try {
    return (await prompt.question(question)).trim();
  } finally {
    prompt.close();
  }
}

async function main() {
  const command = parseClaimArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  assertClaimDatabase(process.env.DATABASE_URL);

  const db = new PrismaClient();
  try {
    const before = await scientificSnapshot(db);
    const cohort =
      command.cohort === "pilot"
        ? { ...(await loadClaimPilot(db, command.limit)), compoundName: "bisphenol A" }
        : await loadIncludedClaimCohort(db, command.limit, command.pmids);
    if (command.cohort === "pilot" && cohort.papers.length !== command.limit) {
      throw new Error(`Expected ${command.limit} pilot papers, found ${cohort.papers.length}.`);
    }
    if (cohort.papers.length === 0) throw new Error("No papers to read.");

    const mechanismRows = await db.mechanism.findMany({ select: { id: true, code: true, name: true, scorePolicy: true } });
    const catalog = catalogFromRows(mechanismRows);
    const lookup = buildMechanismLookup(mechanismRows);
    const outcomes = buildOutcomeLookup(await db.outcome.findMany({ select: { code: true, name: true } }));

    const usingClaude = command.extractor === "claude";
    const provenance = usingClaude
      ? { provider: "anthropic", model: CLAUDE_CLAIM_MODEL, promptVersion: CLAUDE_CLAIM_PROMPT_VERSION }
      : { provider: CLAIM_PROVIDER, model: CLAIM_MODEL, promptVersion: CLAIM_PROMPT_VERSION };
    const transcript: ClaimTranscript = command.transcriptPath
      ? readClaimTranscript(command.transcriptPath)
      : { promptVersion: CLAUDE_CLAIM_PROMPT_VERSION, entries: {} };

    const extract = usingClaude
      ? createClaudeExtractor({
          completion: command.transcriptPath
            ? transcriptCompletion(transcript)
            : apiCompletion(createClaimClient(process.env.ANTHROPIC_API_KEY)),
          compoundNameFor: () => cohort.compoundName,
          mechanismCodeFor: (objectText) => lookup.find(objectText),
          outcomeCodeFor: (objectText, relation) => outcomes.find(objectText, claimDirection(relation)),
          passes: CLAUDE_PASSES,
          onAnswer: (request, raw, pass) => {
            if (!command.recordPath) return;
            transcript.entries[transcriptKey(request.evidenceSourceId, pass)] = {
              title: request.title,
              promptSha256: request.promptSha256,
              model: CLAUDE_CLAIM_MODEL,
              response: raw,
            };
          },
          onPassFailed: (_paper, pass, error) =>
            console.log(`  pass ${pass + 1} failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`),
          onDropped: (_paper, dropped) => {
            for (const row of dropped) console.log(`  dropped ${row.objectText}: ${row.why}`);
          },
        })
      : undefined;

    console.log(`${provenance.provider} ${provenance.model} ${provenance.promptVersion}`);
    console.log(
      `localhost BPA reproductive abstract claims, ${cohort.papers.length} papers, cohort ${command.cohort}` +
        (usingClaude ? `, ${CLAUDE_PASSES} passes each` : ""),
    );

    const papersToRead = command.inspect === null ? cohort.papers : cohort.papers.slice(0, command.inspect);
    if (usingClaude && !command.transcriptPath) {
      const calls = papersToRead.length * CLAUDE_PASSES;
      const answer = await ask(`This makes ${calls} calls to ${CLAUDE_CLAIM_MODEL}, which cost money. Type apply to continue: `);
      if (answer !== "apply") throw new Error("Stopped.");
    }

    type Paper = (typeof cohort.papers)[number];
    const asInput = (paper: Paper) => ({
      evidenceSourceId: paper.evidenceSourceId,
      title: paper.title,
      abstractText: paper.abstractText,
    });
    const extractOne = async (paper: Paper) =>
      extract
        ? await extract(asInput(paper), catalog)
        : extractMechanisticClaims({ title: paper.title, abstractText: paper.abstractText, catalog });

    // Reading happens before the transaction, so a long model run is not held open against the
    // database and can be inspected on the way past.
    const perPaper: Array<{ paper: Paper; drafts: Awaited<ReturnType<typeof extractOne>> }> = [];
    let silent = 0;
    let failed = 0;
    for (const paper of papersToRead) {
      console.log(`\n${paper.year} pmid ${paper.pmid ?? "-"}`);
      console.log(paper.title);
      let drafts: Awaited<ReturnType<typeof extractOne>>;
      try {
        drafts = await extractOne(paper);
      } catch (error) {
        // One unreadable paper must not lose the papers already read, or the money spent on them.
        failed += 1;
        console.log(`  FAILED: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
        continue;
      }
      // Zero claims is a correct answer for an abstract with no mechanism in it, and a common
      // one in a screened cohort. The pilot treated it as a failure because its five were
      // hand-picked to contain one.
      if (drafts.length === 0) silent += 1;
      console.log(`  ${drafts.length} claims`);
      for (const draft of drafts) {
        const seen = draft.machinePassesSeen;
        const run = draft.machinePassesRun;
        const passes = run !== undefined && seen !== undefined && run > 1 ? ` ${seen}/${run} passes` : "";
        console.log(
          `  ${draft.relation} ${draft.objectText} ${draft.machineDirectness} ${draft.machineConfidence} ${draft.machineMappingState} ${draft.mechanismCode ?? draft.outcomeCode ?? "unmapped"}${draft.outcomeCode ? " (outcome)" : ""} ${draft.reviewPriority}${passes}`,
        );
        console.log(`  ${draft.quotedSupport ?? ""}`);
      }
      perPaper.push({ paper, drafts });
    }

    if (command.recordPath) writeClaimTranscript(command.recordPath, transcript);
    const isoforms = lookup.isoformMatches();
    if (isoforms.size > 0) {
      console.log(`\nMapped by dropping an isoform digit, which a curator should confirm:`);
      for (const [term, code] of isoforms) console.log(`  ${term} -> ${code}`);
    }
    const claimTotal = perPaper.reduce((sum, row) => sum + row.drafts.length, 0);
    const mappedTotal = perPaper.reduce((sum, row) => sum + row.drafts.filter((d) => d.mechanismCode).length, 0);
    const outcomeTotal = perPaper.reduce((sum, row) => sum + row.drafts.filter((d) => d.outcomeCode).length, 0);
    const oneReading = perPaper.reduce(
      (sum, row) => sum + row.drafts.filter((d) => d.machinePassesRun && d.machinePassesSeen && d.machinePassesSeen < d.machinePassesRun).length,
      0,
    );
    console.log(
      `\n${perPaper.length} papers read, ${claimTotal} claims, ${mappedTotal} mapped to a mechanism, ` +
        `${outcomeTotal} to an outcome, ` +
        `${silent} papers with no mechanistic claim in the abstract` +
        (usingClaude ? `, ${oneReading} claims read by only one pass` : "") +
        (failed > 0 ? `, ${failed} papers failed` : "") +
        ".",
    );

    if (command.dryRun) {
      assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
      console.log("Dry run. No claims were written.");
      return;
    }

    // The claims are already in hand, so the transaction replays them rather than reading again:
    // a write must store exactly what was printed above, not a fresh and possibly different one.
    const readBack = new Map(perPaper.map((row) => [row.paper.evidenceSourceId, row.drafts]));
    const result = await db.$transaction(async (tx) => {
      const snapshot = await scientificSnapshot(tx);
      const written = await applyMachineClaims(tx, {
        compoundId: cohort.compoundId,
        provenance,
        extract: (paper) => readBack.get(paper.evidenceSourceId) ?? [],
        papers: perPaper.map(({ paper }) => asInput(paper)),
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
