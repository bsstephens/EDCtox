import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { PrismaClient } from "../generated/prisma";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";
import {
  applyMachineSuggestions,
  DETERMINISTIC_PROVENANCE,
  type SuggestionCandidate,
  type SuggestionProvider,
} from "../src/server/screening/applySuggestions";
import {
  apiCompletion,
  buildClaudeScreeningRequest,
  CLAUDE_SCREENING_PROVENANCE,
  ClaudeScreeningError,
  createClaudeClient,
  createClaudeSuggestionProvider,
  readScreeningTranscript,
  transcriptCompletion,
  writeScreeningTranscript,
  type ClaudeScreeningCompletion,
  type ScreeningTranscript,
} from "../src/server/screening/claude";
import { suggestDeterministic, type MachineSuggestion } from "../src/server/screening/deterministic";
import { assertLocalDatabase, parseScreeningArgs, type ScreeningCommand } from "../src/server/screening/cli";
import { loadBpaScreeningQueue, type ScreeningCard } from "../src/server/screening/queue";
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

function call(decision: string | null, reason: string | null): string {
  if (!decision) return "-";
  return reason ? `${decision} ${reason}` : decision;
}

function percent(agree: number, total: number): string {
  if (total === 0) return "n/a (0 compared)";
  return `${agree}/${total} (${Math.round((agree / total) * 100)}%)`;
}

type ComparisonRow = {
  card: ScreeningCard;
  claude: MachineSuggestion | null;
  error: string | null;
};

function agreement(rows: readonly ComparisonRow[], left: (row: ComparisonRow) => string | null, right: (row: ComparisonRow) => string | null) {
  const compared = rows.filter((row) => left(row) && right(row));
  const agree = compared.filter((row) => left(row) === right(row));
  return { compared: compared.length, agree: agree.length };
}

function printSummary(rows: readonly ComparisonRow[]) {
  const curatorCount = rows.filter((row) => row.card.curatorDecision).length;
  const claudeDecision = (row: ComparisonRow) => row.claude?.decision ?? null;
  const machineDecision = (row: ComparisonRow) => row.card.machineDecision;
  const curatorDecision = (row: ComparisonRow) => row.card.curatorDecision;
  const claudeReason = (row: ComparisonRow) => row.claude?.reasonCode ?? null;
  const machineReason = (row: ComparisonRow) => row.card.machineReason;
  const curatorReason = (row: ComparisonRow) => row.card.curatorReasonCode;
  const cc = agreement(rows, claudeDecision, curatorDecision);
  const mc = agreement(rows, machineDecision, curatorDecision);
  const cm = agreement(rows, claudeDecision, machineDecision);
  const ccReason = agreement(rows, claudeReason, curatorReason);
  const mcReason = agreement(rows, machineReason, curatorReason);
  const cmReason = agreement(rows, claudeReason, machineReason);
  console.log("");
  console.log(`Agreement on decision (INCLUDE / EXCLUDE / UNCERTAIN)`);
  console.log(`  Claude vs curator   ${percent(cc.agree, cc.compared)}`);
  console.log(`  machine vs curator  ${percent(mc.agree, mc.compared)}`);
  console.log(`  Claude vs machine   ${percent(cm.agree, cm.compared)}`);
  console.log(`Agreement on decision and reason code`);
  console.log(`  Claude vs curator   ${percent(ccReason.agree, ccReason.compared)}`);
  console.log(`  machine vs curator  ${percent(mcReason.agree, mcReason.compared)}`);
  console.log(`  Claude vs machine   ${percent(cmReason.agree, cmReason.compared)}`);
  if (curatorCount === 0) {
    console.log("No curator decisions exist in this database, so the curator columns are empty. Decide the papers on /admin/literature to build the gold set.");
  }
  const errors = rows.filter((row) => row.error);
  if (errors.length > 0) console.log(`${errors.length} paper(s) returned an error and were not compared.`);
}

async function runClaudeComparison(db: PrismaClient, command: ScreeningCommand) {
  const before = await scientificSnapshot(db);
  const queue = await loadBpaScreeningQueue(db);
  const decided = queue.cards.filter(
    (card) => card.publicationStatus === "SCREENING_PENDING" && (card.curatorDecision || card.machineDecision),
  );
  const selected = decided.slice(0, command.limit);
  const curatorCount = selected.filter((card) => card.curatorDecision).length;
  const machineCount = selected.filter((card) => card.machineDecision).length;
  console.log(`${CLAUDE_SCREENING_PROVENANCE.provider} ${CLAUDE_SCREENING_PROVENANCE.model} ${CLAUDE_SCREENING_PROVENANCE.promptVersion}`);
  console.log(
    `localhost BPA reproductive comparison set ${selected.length} (curator decisions ${curatorCount}, existing machine suggestions ${machineCount})`,
  );

  if (command.writePrompts) {
    const prompts = Object.fromEntries(
      selected.map((card) => {
        const request = buildClaudeScreeningRequest(toCandidate(card));
        return [card.sourceId, { pmid: card.pmid, title: card.title, promptSha256: request.promptSha256, system: request.system, user: request.user }];
      }),
    );
    mkdirSync(dirname(command.writePrompts), { recursive: true });
    writeFileSync(
      command.writePrompts,
      `${JSON.stringify({ promptVersion: CLAUDE_SCREENING_PROVENANCE.promptVersion, model: CLAUDE_SCREENING_PROVENANCE.model, entries: prompts }, null, 2)}\n`,
    );
    console.log(`Wrote ${selected.length} prompts to ${command.writePrompts}. Nothing was screened.`);
    return;
  }

  const transcript: ScreeningTranscript | null = command.transcript ? readScreeningTranscript(command.transcript) : null;
  let api: ClaudeScreeningCompletion | null = null;
  const completion: ClaudeScreeningCompletion = async (request) => {
    if (transcript?.entries[request.evidenceSourceId]) return transcriptCompletion(transcript)(request);
    api ??= apiCompletion(createClaudeClient(process.env.ANTHROPIC_API_KEY));
    return api(request);
  };
  const provider = createClaudeSuggestionProvider({
    completion,
    onAnswer: (request, raw) => {
      if (!transcript || transcript.entries[request.evidenceSourceId]) return;
      transcript.entries[request.evidenceSourceId] = {
        title: request.title,
        promptSha256: request.promptSha256,
        model: CLAUDE_SCREENING_PROVENANCE.model,
        response: raw,
        recordedAt: new Date().toISOString(),
      };
      if (command.transcript) writeScreeningTranscript(command.transcript, transcript);
    },
  });

  const rows: ComparisonRow[] = [];
  let index = 0;
  for (const card of selected) {
    index += 1;
    let claude: MachineSuggestion | null = null;
    let error: string | null = null;
    try {
      claude = await provider(toCandidate(card));
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    rows.push({ card, claude, error });
    const purpose = card.governingPurpose ?? "-";
    console.log(`\n${index}. pmid ${card.pmid ?? "-"} ${card.year ?? "?"} ${purpose}`);
    console.log(`   ${card.title}`);
    console.log(`   machine  ${call(card.machineDecision, card.machineReason)}${card.machineConfidence ? ` ${card.machineConfidence}` : ""}`);
    console.log(`   claude   ${claude ? `${call(claude.decision, claude.reasonCode)} ${claude.confidence}` : `ERROR ${error}`}`);
    console.log(`   curator  ${call(card.curatorDecision, card.curatorReasonCode)}`);
    if (claude) console.log(`   claude says: ${claude.rationale}`);
  }
  printSummary(rows);
  assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
  console.log("Dry run. No screening decisions were written.");
}

async function runDeterministic(db: PrismaClient, command: ScreeningCommand) {
  const before = await scientificSnapshot(db);
  const queue = await loadBpaScreeningQueue(db);
  const selected = selectSuggestionSample(queue.cards, command.limit);
  console.log(`${DETERMINISTIC_PROVENANCE.provider} ${DETERMINISTIC_PROVENANCE.model} ${DETERMINISTIC_PROVENANCE.promptVersion}`);
  console.log(`localhost BPA reproductive pending suggestions ${selected.length}`);
  const provider: SuggestionProvider = suggestDeterministic;
  for (const card of selected) {
    const suggestion = await provider(toCandidate(card));
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
      provider,
      provenance: DETERMINISTIC_PROVENANCE,
    });
    assertScientificSnapshotUnchanged(snapshot, await scientificSnapshot(tx));
    return written;
  });
  assertScientificSnapshotUnchanged(before, await scientificSnapshot(db));
  console.log(`Wrote ${result.written} machine suggestions. Curator decisions were not changed.`);
}

async function main() {
  const command = parseScreeningArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  assertLocalDatabase(process.env.DATABASE_URL);

  const db = new PrismaClient();
  try {
    if (command.provider === "claude") await runClaudeComparison(db, command);
    else await runDeterministic(db, command);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof ClaudeScreeningError || error instanceof Error ? error.message : "Screening failed.";
  console.error(message);
  process.exit(1);
});
